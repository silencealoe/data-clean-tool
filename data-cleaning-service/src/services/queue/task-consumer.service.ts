import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { QueueManagerService } from './queue-manager.service';
import { ErrorHandlerService, ErrorType } from './error-handler.service';
import { TimeoutManagerService } from './timeout-manager.service';
import { DataCleanerService } from '../data-cleaner.service';
import { FileService } from '../file.service';
import { ProcessingTask, TaskStatus, ProgressInfo } from '../../common/types/queue.types';

/**
 * 任务消费者服务
 * 负责从队列获取任务并执行文件处理
 * 
 * 需求：3.1, 3.2, 3.6, 3.7
 */
@Injectable()
export class TaskConsumerService implements OnModuleDestroy {
    private readonly logger = new Logger(TaskConsumerService.name);
    private isRunning = false;
    private isShuttingDown = false;
    private currentTask: ProcessingTask | null = null;

    constructor(
        private readonly queueManager: QueueManagerService,
        private readonly errorHandler: ErrorHandlerService,
        private readonly timeoutManager: TimeoutManagerService,
        private readonly dataCleanerService: DataCleanerService,
        private readonly fileService: FileService
    ) { }

    async onModuleDestroy() {
        await this.stop();
    }

    /**
     * 启动任务消费者
     * 需求：3.1 - 消费者应作为独立于Web API的单独进程运行
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('Task consumer is already running');
            return;
        }

        this.isRunning = true;
        this.isShuttingDown = false;
        this.logger.log('Task consumer started');

        // 启动处理循环
        this.processLoop().catch(error => {
            this.logger.error('Processing loop failed:', error);
        });
    }

    /**
     * 停止任务消费者（优雅关闭）
     * 需求：3.6 - 消费者应支持优雅关闭而不丢失正在进行的任务
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        this.logger.log('Initiating graceful shutdown...');
        this.isShuttingDown = true;

        // 等待当前任务完成
        if (this.currentTask) {
            this.logger.log(`Waiting for current task ${this.currentTask.taskId} to complete...`);

            // 等待最多5分钟让当前任务完成
            const maxWaitTime = 5 * 60 * 1000; // 5分钟
            const startTime = Date.now();

            while (this.currentTask && (Date.now() - startTime) < maxWaitTime) {
                await this.sleep(1000); // 每秒检查一次
            }

            if (this.currentTask) {
                this.logger.warn(`Current task ${this.currentTask.taskId} did not complete within timeout, marking as abandoned`);
                // 将任务重新标记为pending，以便其他消费者可以处理
                await this.markTaskAsAbandoned(this.currentTask);
            }
        }

        this.isRunning = false;
        this.logger.log('Task consumer stopped gracefully');
    }

    /**
     * 主处理循环
     */
    private async processLoop(): Promise<void> {
        while (this.isRunning && !this.isShuttingDown) {
            try {
                // 阻塞式获取任务，30秒超时
                const task = await this.queueManager.dequeueTask(30);

                if (task && !this.isShuttingDown) {
                    await this.processTask(task);
                }
            } catch (error) {
                this.logger.error('Error in processing loop:', error);

                // 如果是连接错误，等待一段时间后重试
                if (this.isConnectionError(error)) {
                    await this.sleep(5000); // 等待5秒
                } else {
                    await this.sleep(1000); // 其他错误等待1秒
                }
            }
        }

        this.logger.log('Processing loop ended');
    }

    /**
     * 处理单个任务
     * 需求：3.2 - 当消费者检索到任务时，文件处理器应执行数据清洗工作流
     * 需求：3.4 - 当处理成功完成时，消费者应将任务状态更新为"已完成"并存储结果
     * 需求：3.5 - 当处理失败时，消费者应将任务状态更新为"失败"并记录错误详情
     */
    private async processTask(task: ProcessingTask): Promise<void> {
        const { taskId } = task;
        this.currentTask = task;

        try {
            this.logger.log(`Processing task ${taskId}: ${task.originalFileName}`);

            // 启动超时监控
            this.timeoutManager.startTimeout(taskId);

            // 更新状态为处理中
            await this.queueManager.setTaskStatus(taskId, TaskStatus.PROCESSING, {
                startedAt: new Date()
            });

            // 初始化进度
            await this.updateProgress(taskId, {
                taskId,
                progress: 0,
                processedRows: 0,
                totalRows: 0,
                currentPhase: 'starting',
                lastUpdated: new Date()
            });

            // 验证文件是否存在
            if (!await this.fileService.fileExists(task.filePath)) {
                throw new Error(`File not found: ${task.filePath}`);
            }

            // 开始处理文件
            const result = await this.processFileWithProgress(task);

            // 清除超时监控
            this.timeoutManager.clearTimeout(taskId);

            // 更新为完成状态
            await this.queueManager.setTaskStatus(taskId, TaskStatus.COMPLETED, {
                completedAt: new Date(),
                statistics: {
                    totalRows: result.statistics.totalRows,
                    processedRows: result.statistics.processedRows,
                    validRows: result.statistics.processedRows,
                    invalidRows: result.statistics.errorRows || 0,
                    duplicateRows: 0,
                    processingTimeMs: Date.now() - task.createdAt.getTime()
                }
            });

            // 最终进度更新
            await this.updateProgress(taskId, {
                taskId,
                progress: 100,
                processedRows: result.statistics.processedRows,
                totalRows: result.statistics.totalRows,
                currentPhase: 'completed',
                lastUpdated: new Date()
            });

            this.logger.log(`Task ${taskId} completed successfully`);

        } catch (error) {
            this.logger.error(`Task ${taskId} processing failed:`, error);

            // 清除超时监控
            this.timeoutManager.clearTimeout(taskId);

            // 使用错误处理器分类错误并决定是否重试
            const shouldRetry = this.errorHandler.shouldRetry(error, task.retryCount);

            if (shouldRetry) {
                this.logger.log(`Scheduling retry for task ${taskId} (attempt ${task.retryCount + 1})`);
                await this.scheduleRetry(task);
            } else {
                // 处理永久失败
                await this.errorHandler.handlePermanentFailure(task, error);

                // 标记为永久失败
                await this.queueManager.setTaskStatus(taskId, TaskStatus.FAILED, {
                    completedAt: new Date(),
                    errorMessage: error.message,
                    errorType: this.errorHandler.classifyError(error),
                    errorSummary: this.errorHandler.createErrorSummary(error, task)
                });

                this.logger.error(`Task ${taskId} marked as permanently failed: ${error.message}`);
            }

        } finally {
            this.currentTask = null;
        }
    }

    /**
     * 处理文件并更新进度
     */
    private async processFileWithProgress(task: ProcessingTask): Promise<any> {
        // 使用数据清洗服务处理文件
        return await this.dataCleanerService.cleanDataStream(task.filePath, task.taskId);
    }

    /**
     * 更新任务进度
     * 需求：4.2 - 当处理进行时，消费者应定期在状态存储中更新进度信息
     */
    private async updateProgress(taskId: string, progress: ProgressInfo): Promise<void> {
        try {
            await this.queueManager.updateProgress(taskId, progress);
        } catch (error) {
            this.logger.error(`Failed to update progress for task ${taskId}:`, error);
            // 进度更新失败不应该中断任务处理
        }
    }

    /**
     * 安排重试
     * 需求：8.1 - 当Redis连接失败时，系统应使用指数退避算法重试连接直到最大尝试次数
     */
    private async scheduleRetry(task: ProcessingTask): Promise<void> {
        const retryTask: ProcessingTask = {
            ...task,
            retryCount: task.retryCount + 1
        };

        // 使用错误处理器计算重试延迟
        const delay = this.errorHandler.calculateRetryDelay(task.retryCount);

        this.logger.log(`Scheduling retry for task ${task.taskId} in ${delay}ms (attempt ${retryTask.retryCount})`);

        setTimeout(async () => {
            try {
                await this.queueManager.enqueueTask(retryTask);
                this.logger.log(`Task ${task.taskId} requeued for retry`);
            } catch (error) {
                this.logger.error(`Failed to requeue task ${task.taskId} for retry:`, error);
            }
        }, delay);
    }

    /**
     * 标记任务为被遗弃
     * 需求：3.7 - 当消费者进程崩溃时，系统应检测被遗弃的任务并标记为重试
     */
    private async markTaskAsAbandoned(task: ProcessingTask): Promise<void> {
        try {
            // 将任务重新入队，增加重试计数
            const abandonedTask: ProcessingTask = {
                ...task,
                retryCount: task.retryCount + 1
            };

            await this.queueManager.enqueueTask(abandonedTask);
            this.logger.log(`Task ${task.taskId} marked as abandoned and requeued`);
        } catch (error) {
            this.logger.error(`Failed to mark task ${task.taskId} as abandoned:`, error);
        }
    }

    /**
     * 判断是否为连接错误
     */
    private isConnectionError(error: Error): boolean {
        const message = error.message.toLowerCase();
        return message.includes('connection') ||
            message.includes('redis') ||
            message.includes('econnreset') ||
            message.includes('etimedout');
    }

    /**
     * 休眠指定毫秒数
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取消费者状态
     */
    getStatus(): {
        isRunning: boolean;
        isShuttingDown: boolean;
        currentTask: string | null;
    } {
        return {
            isRunning: this.isRunning,
            isShuttingDown: this.isShuttingDown,
            currentTask: this.currentTask?.taskId || null
        };
    }
}
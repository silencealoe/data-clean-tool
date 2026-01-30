import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueManagerService } from './queue-manager.service';
import { TaskStatus, ProcessingTask } from '../../common/types/queue.types';
import * as Redis from 'ioredis';

/**
 * 被遗弃任务信息接口
 */
export interface AbandonedTaskInfo {
    taskId: string;
    status: TaskStatus;
    startedAt?: Date;
    elapsedMs: number;
    originalTask?: ProcessingTask;
}

/**
 * 恢复统计信息接口
 */
export interface RecoveryStats {
    totalTasksChecked: number;
    abandonedTasksFound: number;
    tasksRecovered: number;
    tasksFailedToRecover: number;
    recoveryStartTime: Date;
    recoveryEndTime?: Date;
    recoveryDurationMs?: number;
}

/**
 * 恢复管理器接口
 */
export interface RecoveryManagerInterface {
    performStartupRecovery(): Promise<RecoveryStats>;
    detectAbandonedTasks(): Promise<AbandonedTaskInfo[]>;
    recoverAbandonedTask(taskId: string): Promise<boolean>;
    resetTaskToPending(taskId: string): Promise<void>;
    cleanupExpiredTasks(): Promise<number>;
}

/**
 * 故障恢复管理服务
 * 负责系统启动时的任务恢复和被遗弃任务检测
 * 
 * 需求：7.2, 7.3, 3.7
 */
@Injectable()
export class RecoveryManagerService implements RecoveryManagerInterface, OnModuleInit {
    private readonly logger = new Logger(RecoveryManagerService.name);
    private readonly redis: Redis.Redis;
    private readonly abandonedTaskThresholdMs: number;
    private readonly maxRecoveryAttempts: number;
    private readonly recoveryBatchSize: number;
    private readonly enableAutoRecovery: boolean;
    private readonly recoveryCheckIntervalMs: number;
    private recoveryIntervalHandle?: NodeJS.Timeout;

    constructor(
        private readonly configService: ConfigService,
        private readonly queueManager: QueueManagerService
    ) {
        // 初始化Redis连接（用于扫描任务）
        const redisConfig = this.configService.get('redis');
        this.redis = new Redis.Redis({
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db,
            connectTimeout: redisConfig.connectTimeout,
            commandTimeout: redisConfig.commandTimeout,
            enableReadyCheck: redisConfig.enableReadyCheck,
            maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
            // Enable offline queue to buffer commands when disconnected
            enableOfflineQueue: true,
            // Don't use lazy connect to establish connection immediately
            lazyConnect: false,
        });

        // 从配置获取恢复参数
        const queueConfig = this.configService.get('queue');
        const recoveryConfig = queueConfig?.recovery || {};

        this.abandonedTaskThresholdMs = recoveryConfig.abandonedTaskThresholdMs || 60 * 60 * 1000; // 默认1小时
        this.maxRecoveryAttempts = recoveryConfig.maxRecoveryAttempts || 3;
        this.recoveryBatchSize = recoveryConfig.batchSize || 50;
        this.enableAutoRecovery = recoveryConfig.enableAutoRecovery !== false; // 默认启用
        this.recoveryCheckIntervalMs = recoveryConfig.checkIntervalMs || 10 * 60 * 1000; // 默认10分钟

        this.logger.log('RecoveryManager initialized with config:', {
            abandonedTaskThresholdMs: this.abandonedTaskThresholdMs,
            maxRecoveryAttempts: this.maxRecoveryAttempts,
            recoveryBatchSize: this.recoveryBatchSize,
            enableAutoRecovery: this.enableAutoRecovery,
            recoveryCheckIntervalMs: this.recoveryCheckIntervalMs
        });
    }

    async onModuleInit() {
        // 系统启动时执行恢复
        try {
            this.logger.log('Performing startup recovery...');
            const recoveryStats = await this.performStartupRecovery();
            this.logger.log('Startup recovery completed:', recoveryStats);

            // 启动定期恢复检查
            if (this.enableAutoRecovery) {
                this.startPeriodicRecoveryCheck();
            }
        } catch (error) {
            this.logger.error('Startup recovery failed:', error);
        }
    }

    /**
     * 执行系统启动时的任务恢复
     * 需求：7.2 - 当系统重启时，消费者应从任务队列恢复处理任务
     * 需求：3.7 - 当消费者进程崩溃时，系统应检测被遗弃的任务并标记为重试
     */
    async performStartupRecovery(): Promise<RecoveryStats> {
        const recoveryStats: RecoveryStats = {
            totalTasksChecked: 0,
            abandonedTasksFound: 0,
            tasksRecovered: 0,
            tasksFailedToRecover: 0,
            recoveryStartTime: new Date()
        };

        try {
            this.logger.log('Starting system recovery process...');

            // 检测被遗弃的任务
            const abandonedTasks = await this.detectAbandonedTasks();
            recoveryStats.totalTasksChecked = abandonedTasks.length;
            recoveryStats.abandonedTasksFound = abandonedTasks.length;

            if (abandonedTasks.length === 0) {
                this.logger.log('No abandoned tasks found during startup recovery');
                recoveryStats.recoveryEndTime = new Date();
                recoveryStats.recoveryDurationMs = recoveryStats.recoveryEndTime.getTime() - recoveryStats.recoveryStartTime.getTime();
                return recoveryStats;
            }

            this.logger.log(`Found ${abandonedTasks.length} abandoned tasks, starting recovery...`);

            // 批量恢复被遗弃的任务
            for (let i = 0; i < abandonedTasks.length; i += this.recoveryBatchSize) {
                const batch = abandonedTasks.slice(i, i + this.recoveryBatchSize);

                this.logger.log(`Processing recovery batch ${Math.floor(i / this.recoveryBatchSize) + 1}/${Math.ceil(abandonedTasks.length / this.recoveryBatchSize)} (${batch.length} tasks)`);

                await Promise.allSettled(
                    batch.map(async (abandonedTask) => {
                        try {
                            const recovered = await this.recoverAbandonedTask(abandonedTask.taskId);
                            if (recovered) {
                                recoveryStats.tasksRecovered++;
                                this.logger.debug(`Successfully recovered task ${abandonedTask.taskId}`);
                            } else {
                                recoveryStats.tasksFailedToRecover++;
                                this.logger.warn(`Failed to recover task ${abandonedTask.taskId}`);
                            }
                        } catch (error) {
                            recoveryStats.tasksFailedToRecover++;
                            this.logger.error(`Error recovering task ${abandonedTask.taskId}:`, error);
                        }
                    })
                );

                // 批次间短暂延迟，避免过载
                if (i + this.recoveryBatchSize < abandonedTasks.length) {
                    await this.sleep(100);
                }
            }

            recoveryStats.recoveryEndTime = new Date();
            recoveryStats.recoveryDurationMs = recoveryStats.recoveryEndTime.getTime() - recoveryStats.recoveryStartTime.getTime();

            this.logger.log(`Recovery completed: ${recoveryStats.tasksRecovered} recovered, ${recoveryStats.tasksFailedToRecover} failed`);

        } catch (error) {
            this.logger.error('Error during startup recovery:', error);
            recoveryStats.recoveryEndTime = new Date();
            recoveryStats.recoveryDurationMs = recoveryStats.recoveryEndTime.getTime() - recoveryStats.recoveryStartTime.getTime();
        }

        return recoveryStats;
    }

    /**
     * 检测被遗弃的任务
     * 需求：7.3 - 当消费者在处理期间崩溃时，系统应检测陈旧的"处理中"任务并重置为"待处理"
     */
    async detectAbandonedTasks(): Promise<AbandonedTaskInfo[]> {
        const abandonedTasks: AbandonedTaskInfo[] = [];

        try {
            await this.ensureConnection();

            // 扫描所有任务状态键
            const statusKeys = await this.redis.keys('task:status:*');

            if (statusKeys.length === 0) {
                this.logger.debug('No task status keys found');
                return abandonedTasks;
            }

            this.logger.debug(`Checking ${statusKeys.length} tasks for abandonment`);

            // 批量检查任务状态
            for (let i = 0; i < statusKeys.length; i += this.recoveryBatchSize) {
                const batch = statusKeys.slice(i, i + this.recoveryBatchSize);

                const pipeline = this.redis.pipeline();
                batch.forEach(key => pipeline.hgetall(key));
                const results = await pipeline.exec();

                if (!results) continue;

                for (let j = 0; j < batch.length; j++) {
                    const key = batch[j];
                    const result = results[j];

                    if (!result || result[0] !== null) continue; // 跳过错误结果

                    const statusData = result[1] as Record<string, string>;
                    if (!statusData || Object.keys(statusData).length === 0) continue;

                    const taskId = key.replace('task:status:', '');
                    const status = statusData.status as TaskStatus;
                    const startedAt = statusData.startedAt ? new Date(statusData.startedAt) : undefined;

                    // 检查是否为被遗弃的处理中任务
                    if (status === TaskStatus.PROCESSING && startedAt) {
                        const elapsedMs = Date.now() - startedAt.getTime();

                        if (elapsedMs > this.abandonedTaskThresholdMs) {
                            abandonedTasks.push({
                                taskId,
                                status,
                                startedAt,
                                elapsedMs
                            });

                            this.logger.debug(`Found abandoned task ${taskId}: elapsed ${elapsedMs}ms > threshold ${this.abandonedTaskThresholdMs}ms`);
                        }
                    }
                }
            }

            this.logger.log(`Detected ${abandonedTasks.length} abandoned tasks`);

        } catch (error) {
            this.logger.error('Error detecting abandoned tasks:', error);
        }

        return abandonedTasks;
    }

    /**
     * 恢复被遗弃的任务
     * 需求：3.7 - 当消费者进程崩溃时，系统应检测被遗弃的任务并标记为重试
     */
    async recoverAbandonedTask(taskId: string): Promise<boolean> {
        try {
            this.logger.debug(`Attempting to recover abandoned task ${taskId}`);

            // 获取任务状态信息
            const statusInfo = await this.queueManager.getTaskStatus(taskId);

            if (statusInfo.status !== TaskStatus.PROCESSING) {
                this.logger.debug(`Task ${taskId} is no longer in processing state (${statusInfo.status}), skipping recovery`);
                return false;
            }

            // 检查任务是否确实被遗弃
            const startedAt = statusInfo.startedAt;
            if (!startedAt) {
                this.logger.warn(`Task ${taskId} has no startedAt timestamp, marking as failed`);
                await this.markTaskAsFailed(taskId, 'No start timestamp found during recovery');
                return false;
            }

            const elapsedMs = Date.now() - startedAt.getTime();
            if (elapsedMs < this.abandonedTaskThresholdMs) {
                this.logger.debug(`Task ${taskId} is not abandoned yet (elapsed: ${elapsedMs}ms < threshold: ${this.abandonedTaskThresholdMs}ms)`);
                return false;
            }

            // 尝试重置任务为待处理状态
            await this.resetTaskToPending(taskId);

            // 尝试重新入队（如果有原始任务信息）
            const originalTask = await this.reconstructTask(taskId, statusInfo);
            if (originalTask) {
                // 增加重试计数
                const recoveredTask: ProcessingTask = {
                    ...originalTask,
                    retryCount: originalTask.retryCount + 1
                };

                await this.queueManager.enqueueTask(recoveredTask);
                this.logger.log(`Task ${taskId} recovered and requeued (retry count: ${recoveredTask.retryCount})`);
                return true;
            } else {
                this.logger.warn(`Could not reconstruct task ${taskId}, marking as failed`);
                await this.markTaskAsFailed(taskId, 'Could not reconstruct task during recovery');
                return false;
            }

        } catch (error) {
            this.logger.error(`Error recovering task ${taskId}:`, error);

            try {
                await this.markTaskAsFailed(taskId, `Recovery failed: ${error.message}`);
            } catch (markError) {
                this.logger.error(`Failed to mark task ${taskId} as failed:`, markError);
            }

            return false;
        }
    }

    /**
     * 重置任务为待处理状态
     */
    async resetTaskToPending(taskId: string): Promise<void> {
        await this.queueManager.setTaskStatus(taskId, TaskStatus.PENDING, {
            recoveredAt: new Date(),
            recoveryReason: 'Task was abandoned and recovered'
        });

        // 重置进度信息
        await this.queueManager.updateProgress(taskId, {
            taskId,
            progress: 0,
            processedRows: 0,
            totalRows: 0,
            currentPhase: 'recovered',
            lastUpdated: new Date()
        });

        this.logger.debug(`Task ${taskId} reset to pending state`);
    }

    /**
     * 清理过期任务
     * 清理TTL已过期但仍存在的任务数据
     */
    async cleanupExpiredTasks(): Promise<number> {
        let cleanedCount = 0;

        try {
            await this.ensureConnection();

            // 获取所有任务状态键
            const statusKeys = await this.redis.keys('task:status:*');
            const progressKeys = await this.redis.keys('task:progress:*');

            // 检查状态键的TTL
            for (const key of statusKeys) {
                const ttl = await this.redis.ttl(key);
                if (ttl === -1) { // 没有TTL的键
                    const taskId = key.replace('task:status:', '');
                    this.logger.warn(`Found task status without TTL: ${taskId}, setting TTL`);

                    const taskTtlSeconds = this.configService.get('queue.taskTtlSeconds') || 7 * 24 * 60 * 60; // 7天
                    await this.redis.expire(key, taskTtlSeconds);
                }
            }

            // 检查进度键的TTL
            for (const key of progressKeys) {
                const ttl = await this.redis.ttl(key);
                if (ttl === -1) { // 没有TTL的键
                    const taskId = key.replace('task:progress:', '');
                    this.logger.warn(`Found task progress without TTL: ${taskId}, setting TTL`);

                    const taskTtlSeconds = this.configService.get('queue.taskTtlSeconds') || 7 * 24 * 60 * 60; // 7天
                    await this.redis.expire(key, taskTtlSeconds);
                }
            }

            this.logger.log(`Cleanup completed: checked ${statusKeys.length} status keys and ${progressKeys.length} progress keys`);

        } catch (error) {
            this.logger.error('Error during cleanup:', error);
        }

        return cleanedCount;
    }

    /**
     * 启动定期恢复检查
     */
    private startPeriodicRecoveryCheck(): void {
        if (this.recoveryIntervalHandle) {
            return; // 已经启动
        }

        this.recoveryIntervalHandle = setInterval(async () => {
            try {
                this.logger.debug('Performing periodic recovery check...');

                const abandonedTasks = await this.detectAbandonedTasks();
                if (abandonedTasks.length > 0) {
                    this.logger.log(`Periodic check found ${abandonedTasks.length} abandoned tasks`);

                    // 恢复被遗弃的任务
                    let recovered = 0;
                    for (const task of abandonedTasks) {
                        try {
                            const success = await this.recoverAbandonedTask(task.taskId);
                            if (success) recovered++;
                        } catch (error) {
                            this.logger.error(`Error in periodic recovery for task ${task.taskId}:`, error);
                        }
                    }

                    this.logger.log(`Periodic recovery completed: ${recovered}/${abandonedTasks.length} tasks recovered`);
                }

                // 执行清理
                await this.cleanupExpiredTasks();

            } catch (error) {
                this.logger.error('Error during periodic recovery check:', error);
            }
        }, this.recoveryCheckIntervalMs);

        this.logger.log(`Periodic recovery check started (interval: ${this.recoveryCheckIntervalMs}ms)`);
    }

    /**
     * 停止定期恢复检查
     */
    private stopPeriodicRecoveryCheck(): void {
        if (this.recoveryIntervalHandle) {
            clearInterval(this.recoveryIntervalHandle);
            this.recoveryIntervalHandle = undefined;
            this.logger.log('Periodic recovery check stopped');
        }
    }

    /**
     * 重构任务对象
     */
    private async reconstructTask(taskId: string, statusInfo: any): Promise<ProcessingTask | null> {
        try {
            // 尝试从Redis获取更多任务信息
            await this.ensureConnection();
            const taskKey = `task:data:${taskId}`;
            const taskData = await this.redis.get(taskKey);

            if (taskData) {
                return JSON.parse(taskData);
            }

            // 如果没有完整任务数据，尝试从状态信息重构
            if (statusInfo.originalFileName && statusInfo.filePath) {
                return {
                    taskId,
                    fileId: statusInfo.fileId || taskId,
                    filePath: statusInfo.filePath,
                    originalFileName: statusInfo.originalFileName,
                    fileSize: statusInfo.fileSize || 0,
                    createdAt: statusInfo.createdAt || new Date(),
                    retryCount: statusInfo.retryCount || 0
                };
            }

            return null;
        } catch (error) {
            this.logger.error(`Error reconstructing task ${taskId}:`, error);
            return null;
        }
    }

    /**
     * 标记任务为失败
     */
    private async markTaskAsFailed(taskId: string, reason: string): Promise<void> {
        await this.queueManager.setTaskStatus(taskId, TaskStatus.FAILED, {
            completedAt: new Date(),
            errorMessage: reason,
            failureReason: 'recovery_failed'
        });
    }

    /**
     * 确保Redis连接
     */
    private async ensureConnection(): Promise<void> {
        if (this.redis.status !== 'ready') {
            try {
                await this.redis.ping();
            } catch (error) {
                this.logger.error('Failed to establish Redis connection for recovery:', error);
                throw new Error('Redis connection unavailable for recovery operations');
            }
        }
    }

    /**
     * 休眠指定毫秒数
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取恢复管理器状态
     */
    getRecoveryStatus(): {
        abandonedTaskThresholdMs: number;
        maxRecoveryAttempts: number;
        recoveryBatchSize: number;
        enableAutoRecovery: boolean;
        recoveryCheckIntervalMs: number;
        isPeriodicCheckActive: boolean;
    } {
        return {
            abandonedTaskThresholdMs: this.abandonedTaskThresholdMs,
            maxRecoveryAttempts: this.maxRecoveryAttempts,
            recoveryBatchSize: this.recoveryBatchSize,
            enableAutoRecovery: this.enableAutoRecovery,
            recoveryCheckIntervalMs: this.recoveryCheckIntervalMs,
            isPeriodicCheckActive: !!this.recoveryIntervalHandle
        };
    }

    /**
     * 手动触发恢复检查
     */
    async triggerManualRecovery(): Promise<RecoveryStats> {
        this.logger.log('Manual recovery triggered');
        return await this.performStartupRecovery();
    }

    /**
     * 停止恢复管理器
     */
    async stop(): Promise<void> {
        this.stopPeriodicRecoveryCheck();
        await this.redis.quit();
        this.logger.log('RecoveryManager stopped');
    }
}
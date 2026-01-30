import { Injectable, Logger, Inject } from '@nestjs/common';
import { QueueManagerInterface } from '../common/types/queue.types';
import { ProgressInfo } from '../common/types/queue.types';

/**
 * ProgressTracker Service for Async Queue Processing
 * 
 * 管理任务进度信息的组件，负责：
 * - 进度计算和存储逻辑
 * - 预估时间计算功能
 * - 与QueueManager集成进行进度更新
 * 
 * 验证需求：4.1, 4.2, 4.4, 4.5
 */
@Injectable()
export class ProgressTrackerService {
    private readonly logger = new Logger(ProgressTrackerService.name);
    private readonly taskStartTimes = new Map<string, Date>();

    constructor(
        @Inject('QueueManagerInterface')
        private readonly queueManager: QueueManagerInterface
    ) { }

    /**
     * 更新任务进度
     * @param taskId - 任务ID
     * @param progress - 部分进度信息
     */
    async updateProgress(taskId: string, progress: Partial<ProgressInfo>): Promise<void> {
        try {
            // 获取当前进度信息
            const currentProgress = await this.queueManager.getProgress(taskId);

            // 记录任务开始时间（如果是第一次更新）
            if (!this.taskStartTimes.has(taskId) && progress.processedRows && progress.processedRows > 0) {
                this.taskStartTimes.set(taskId, new Date());
            }

            // 合并进度信息
            const updatedProgress: ProgressInfo = {
                ...currentProgress,
                ...progress,
                taskId,
                lastUpdated: new Date()
            };

            // 计算进度百分比（如果提供了行数信息）
            if (progress.processedRows !== undefined && updatedProgress.totalRows !== undefined && updatedProgress.totalRows > 0) {
                // 防止进度倒退：只有在处理行数确实超过总行数时才调整总行数
                if (progress.processedRows > updatedProgress.totalRows) {
                    // 当实际处理行数超过估算时，适度增加总行数估算
                    const newTotalRows = Math.max(updatedProgress.totalRows, progress.processedRows * 1.05);
                    updatedProgress.totalRows = Math.floor(newTotalRows);
                    this.logger.debug(`调整总行数估算: ${updatedProgress.totalRows} (实际处理: ${progress.processedRows})`);
                }

                const calculatedProgress = Math.round((progress.processedRows / updatedProgress.totalRows) * 100);
                // 限制进度在0-100%之间，并确保进度不会倒退
                const newProgress = Math.min(100, Math.max(0, calculatedProgress));

                // 防止进度倒退：新进度不能小于当前进度（除非是重置）
                if (currentProgress.progress !== undefined && newProgress < currentProgress.progress && currentProgress.progress < 100) {
                    this.logger.warn(`防止进度倒退: 保持进度 ${currentProgress.progress}% (计算值: ${newProgress}%)`);
                    updatedProgress.progress = currentProgress.progress;
                } else {
                    updatedProgress.progress = newProgress;
                }
            }

            // 计算预估剩余时间
            if (progress.processedRows && updatedProgress.totalRows && progress.processedRows > 0) {
                updatedProgress.estimatedTimeRemaining = this.calculateETA(
                    progress.processedRows,
                    updatedProgress.totalRows,
                    this.taskStartTimes.get(taskId)
                );
            }

            // 更新进度到Redis
            await this.queueManager.updateProgress(taskId, updatedProgress);

            this.logger.debug(
                `Task ${taskId} progress updated: ${updatedProgress.progress}% ` +
                `(${updatedProgress.processedRows}/${updatedProgress.totalRows}) ` +
                `Phase: ${updatedProgress.currentPhase}`
            );

            // 记录重要的进度里程碑
            this.logProgressMilestones(taskId, updatedProgress.progress);

        } catch (error) {
            this.logger.error(`Failed to update progress for task ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * 获取任务进度信息
     * @param taskId - 任务ID
     * @returns 进度信息
     */
    async getProgress(taskId: string): Promise<ProgressInfo> {
        try {
            return await this.queueManager.getProgress(taskId);
        } catch (error) {
            this.logger.error(`Failed to get progress for task ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * 初始化任务进度
     * @param taskId - 任务ID
     * @param totalRows - 总行数
     * @param currentPhase - 当前阶段
     */
    async initializeProgress(taskId: string, totalRows: number, currentPhase: string = 'initializing'): Promise<void> {
        const initialProgress: ProgressInfo = {
            taskId,
            progress: 0,
            processedRows: 0,
            totalRows,
            currentPhase,
            lastUpdated: new Date()
        };

        await this.queueManager.updateProgress(taskId, initialProgress);
        this.logger.log(`Progress initialized for task ${taskId}: ${totalRows} total rows`);
    }

    /**
     * 更新处理阶段
     * @param taskId - 任务ID
     * @param phase - 新阶段名称
     * @param processedRows - 可选的已处理行数
     */
    async updatePhase(taskId: string, phase: string, processedRows?: number): Promise<void> {
        const updateData: Partial<ProgressInfo> = {
            currentPhase: phase
        };

        if (processedRows !== undefined) {
            updateData.processedRows = processedRows;
        }

        await this.updateProgress(taskId, updateData);
        this.logger.debug(`Task ${taskId} phase updated to: ${phase}`);
    }

    /**
     * 标记任务完成
     * @param taskId - 任务ID
     * @param finalStatistics - 最终统计信息（可选，用于日志记录）
     */
    async markCompleted(taskId: string, finalStatistics?: any): Promise<void> {
        const currentProgress = await this.queueManager.getProgress(taskId);

        const completedProgress: ProgressInfo = {
            ...currentProgress,
            progress: 100,
            processedRows: currentProgress.totalRows,
            currentPhase: 'completed',
            estimatedTimeRemaining: 0,
            lastUpdated: new Date()
        };

        await this.queueManager.updateProgress(taskId, completedProgress);

        // 清理任务开始时间记录
        this.taskStartTimes.delete(taskId);

        if (finalStatistics) {
            this.logger.log(`Task ${taskId} marked as completed (100%) with statistics:`, finalStatistics);
        } else {
            this.logger.log(`Task ${taskId} marked as completed (100%)`);
        }
    }

    /**
     * 标记任务失败
     * @param taskId - 任务ID
     * @param errorMessage - 错误信息
     */
    async markFailed(taskId: string, errorMessage: string): Promise<void> {
        const currentProgress = await this.queueManager.getProgress(taskId);

        const failedProgress: ProgressInfo = {
            ...currentProgress,
            currentPhase: 'failed',
            estimatedTimeRemaining: 0,
            lastUpdated: new Date()
        };

        await this.queueManager.updateProgress(taskId, failedProgress);

        // 清理任务开始时间记录
        this.taskStartTimes.delete(taskId);

        this.logger.warn(`Task ${taskId} marked as failed: ${errorMessage}`);
    }

    /**
     * 计算预估剩余时间（毫秒）
     * @param processedRows - 已处理行数
     * @param totalRows - 总行数
     * @param startedAt - 开始时间
     * @returns 预估剩余时间（毫秒），如果无法计算则返回undefined
     */
    private calculateETA(
        processedRows: number,
        totalRows: number,
        startedAt?: Date
    ): number | undefined {
        if (!startedAt || processedRows === 0 || processedRows >= totalRows) {
            return undefined;
        }

        const elapsedMs = Date.now() - startedAt.getTime();
        const rowsPerMs = processedRows / elapsedMs;
        const remainingRows = totalRows - processedRows;

        if (rowsPerMs <= 0) {
            return undefined;
        }

        const estimatedRemainingMs = Math.round(remainingRows / rowsPerMs);

        // 确保预估时间为正数且合理（不超过24小时）
        const maxEtaMs = 24 * 60 * 60 * 1000; // 24小时
        return Math.min(Math.max(0, estimatedRemainingMs), maxEtaMs);
    }

    /**
     * 记录进度里程碑
     * @param taskId - 任务ID
     * @param progress - 当前进度百分比
     */
    private logProgressMilestones(taskId: string, progress: number): void {
        const milestones = [25, 50, 75, 90, 100];

        for (const milestone of milestones) {
            // 检查是否刚好达到或超过里程碑
            if (progress >= milestone) {
                // 使用简单的方式避免重复日志（可以后续优化为更精确的跟踪）
                if (milestone === 100) {
                    this.logger.log(`🎉 Task ${taskId} completed (${progress}%)`);
                } else if (progress < milestone + 5) { // 在里程碑附近的小范围内记录
                    this.logger.log(`📊 Task ${taskId} reached ${milestone}% milestone (current: ${progress}%)`);
                }
                break; // 只记录第一个达到的里程碑
            }
        }
    }

    /**
     * 获取任务处理速率统计
     * @param taskId - 任务ID
     * @returns 处理速率信息
     */
    async getProcessingRate(taskId: string): Promise<{
        rowsPerSecond: number;
        elapsedSeconds: number;
        estimatedTotalSeconds?: number;
    } | null> {
        try {
            const progress = await this.getProgress(taskId);
            const startTime = this.taskStartTimes.get(taskId);

            if (!startTime || progress.processedRows === 0) {
                return null;
            }

            const elapsedMs = Date.now() - startTime.getTime();
            const elapsedSeconds = elapsedMs / 1000;
            const rowsPerSecond = progress.processedRows / elapsedSeconds;

            let estimatedTotalSeconds: number | undefined;
            if (progress.totalRows > 0 && rowsPerSecond > 0) {
                estimatedTotalSeconds = progress.totalRows / rowsPerSecond;
            }

            return {
                rowsPerSecond: Math.round(rowsPerSecond * 100) / 100, // 保留2位小数
                elapsedSeconds: Math.round(elapsedSeconds),
                estimatedTotalSeconds: estimatedTotalSeconds ? Math.round(estimatedTotalSeconds) : undefined
            };
        } catch (error) {
            this.logger.error(`Failed to get processing rate for task ${taskId}:`, error);
            return null;
        }
    }

    /**
     * 清理任务相关的内存数据
     * @param taskId - 任务ID
     */
    cleanup(taskId: string): void {
        this.taskStartTimes.delete(taskId);
        this.logger.debug(`Cleaned up progress tracking data for task ${taskId}`);
    }

    /**
     * 获取所有活跃任务的进度摘要
     * @returns 活跃任务进度摘要
     */
    getActiveTasksSummary(): {
        taskId: string;
        startTime: Date;
        elapsedMinutes: number;
    }[] {
        const summary: {
            taskId: string;
            startTime: Date;
            elapsedMinutes: number;
        }[] = [];

        for (const [taskId, startTime] of this.taskStartTimes.entries()) {
            const elapsedMs = Date.now() - startTime.getTime();
            const elapsedMinutes = Math.round(elapsedMs / (1000 * 60));

            summary.push({
                taskId,
                startTime,
                elapsedMinutes
            });
        }

        return summary.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }
}
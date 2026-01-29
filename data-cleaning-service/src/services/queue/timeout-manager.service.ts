import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueManagerService } from './queue-manager.service';
import { TaskStatus } from '../../common/types/queue.types';

/**
 * 超时任务信息接口
 */
export interface TimeoutTaskInfo {
    taskId: string;
    startTime: Date;
    timeoutMs: number;
    timeoutHandle?: NodeJS.Timeout;
}

/**
 * 超时管理器接口
 */
export interface TimeoutManagerInterface {
    startTimeout(taskId: string, timeoutMs?: number): void;
    clearTimeout(taskId: string): void;
    checkTimeouts(): Promise<string[]>;
    getActiveTimeouts(): TimeoutTaskInfo[];
    isTaskTimedOut(taskId: string): boolean;
}

/**
 * 超时管理服务
 * 负责任务超时检测和处理
 * 
 * 需求：7.4, 7.5
 */
@Injectable()
export class TimeoutManagerService implements TimeoutManagerInterface, OnModuleDestroy {
    private readonly logger = new Logger(TimeoutManagerService.name);
    private readonly timeouts = new Map<string, TimeoutTaskInfo>();
    private readonly maxProcessingTime: number;
    private readonly checkInterval: number;
    private checkIntervalHandle?: NodeJS.Timeout;

    constructor(
        private readonly configService: ConfigService,
        private readonly queueManager: QueueManagerService
    ) {
        // 从配置获取超时参数
        const queueConfig = this.configService.get('queue');
        this.maxProcessingTime = queueConfig?.maxProcessingTimeMs || 30 * 60 * 1000; // 默认30分钟
        this.checkInterval = queueConfig?.timeoutCheckIntervalMs || 60 * 1000; // 默认1分钟检查一次

        // 启动定期超时检查
        this.startPeriodicTimeoutCheck();
    }

    async onModuleDestroy() {
        this.stopPeriodicTimeoutCheck();
        this.clearAllTimeouts();
    }

    /**
     * 开始任务超时监控
     * 需求：7.4 - 系统应实现任务超时检测以处理挂起的处理操作
     */
    startTimeout(taskId: string, timeoutMs?: number): void {
        // 如果任务已经有超时监控，先清除
        if (this.timeouts.has(taskId)) {
            this.clearTimeout(taskId);
        }

        const timeout = timeoutMs || this.maxProcessingTime;
        const startTime = new Date();

        // 创建超时处理器
        const timeoutHandle = setTimeout(async () => {
            await this.handleTimeout(taskId);
        }, timeout);

        // 存储超时信息
        const timeoutInfo: TimeoutTaskInfo = {
            taskId,
            startTime,
            timeoutMs: timeout,
            timeoutHandle
        };

        this.timeouts.set(taskId, timeoutInfo);

        this.logger.debug(`Timeout monitoring started for task ${taskId} (${timeout}ms)`);
    }

    /**
     * 清除任务超时监控
     */
    clearTimeout(taskId: string): void {
        const timeoutInfo = this.timeouts.get(taskId);
        if (timeoutInfo) {
            if (timeoutInfo.timeoutHandle) {
                clearTimeout(timeoutInfo.timeoutHandle);
            }
            this.timeouts.delete(taskId);
            this.logger.debug(`Timeout monitoring cleared for task ${taskId}`);
        }
    }

    /**
     * 检查所有超时任务
     * 需求：7.5 - 当任务超过最大处理时间时，系统应将其标记为"失败"并显示超时错误
     */
    async checkTimeouts(): Promise<string[]> {
        const now = new Date();
        const timedOutTasks: string[] = [];

        for (const [taskId, timeoutInfo] of this.timeouts.entries()) {
            const elapsed = now.getTime() - timeoutInfo.startTime.getTime();

            if (elapsed > timeoutInfo.timeoutMs) {
                timedOutTasks.push(taskId);
                this.logger.warn(`Task ${taskId} has timed out (elapsed: ${elapsed}ms, limit: ${timeoutInfo.timeoutMs}ms)`);
            }
        }

        // 处理所有超时的任务
        for (const taskId of timedOutTasks) {
            await this.handleTimeout(taskId);
        }

        return timedOutTasks;
    }

    /**
     * 获取所有活跃的超时监控
     */
    getActiveTimeouts(): TimeoutTaskInfo[] {
        return Array.from(this.timeouts.values()).map(info => ({
            taskId: info.taskId,
            startTime: info.startTime,
            timeoutMs: info.timeoutMs
            // 不返回timeoutHandle，因为它不能序列化
        }));
    }

    /**
     * 检查任务是否已超时
     */
    isTaskTimedOut(taskId: string): boolean {
        const timeoutInfo = this.timeouts.get(taskId);
        if (!timeoutInfo) {
            return false;
        }

        const elapsed = Date.now() - timeoutInfo.startTime.getTime();
        return elapsed > timeoutInfo.timeoutMs;
    }

    /**
     * 处理超时任务
     * 需求：7.5 - 当任务超过最大处理时间时，系统应将其标记为"失败"并显示超时错误
     */
    private async handleTimeout(taskId: string): Promise<void> {
        try {
            const timeoutInfo = this.timeouts.get(taskId);
            if (!timeoutInfo) {
                return;
            }

            const elapsed = Date.now() - timeoutInfo.startTime.getTime();
            const errorMessage = `Task timed out after ${elapsed}ms (limit: ${timeoutInfo.timeoutMs}ms)`;

            // 标记任务为超时失败
            await this.queueManager.setTaskStatus(taskId, TaskStatus.TIMEOUT, {
                completedAt: new Date(),
                errorMessage,
                timeoutMs: timeoutInfo.timeoutMs,
                elapsedMs: elapsed
            });

            // 清理超时监控
            this.clearTimeout(taskId);

            this.logger.error(`Task ${taskId} marked as timed out: ${errorMessage}`);

        } catch (error) {
            this.logger.error(`Failed to handle timeout for task ${taskId}:`, error);
        }
    }

    /**
     * 启动定期超时检查
     */
    private startPeriodicTimeoutCheck(): void {
        if (this.checkIntervalHandle) {
            return; // 已经启动
        }

        this.checkIntervalHandle = setInterval(async () => {
            try {
                const timedOutTasks = await this.checkTimeouts();
                if (timedOutTasks.length > 0) {
                    this.logger.log(`Periodic timeout check found ${timedOutTasks.length} timed out tasks`);
                }
            } catch (error) {
                this.logger.error('Error during periodic timeout check:', error);
            }
        }, this.checkInterval);

        this.logger.log(`Periodic timeout check started (interval: ${this.checkInterval}ms)`);
    }

    /**
     * 停止定期超时检查
     */
    private stopPeriodicTimeoutCheck(): void {
        if (this.checkIntervalHandle) {
            clearInterval(this.checkIntervalHandle);
            this.checkIntervalHandle = undefined;
            this.logger.log('Periodic timeout check stopped');
        }
    }

    /**
     * 清除所有超时监控
     */
    private clearAllTimeouts(): void {
        for (const taskId of this.timeouts.keys()) {
            this.clearTimeout(taskId);
        }
        this.logger.log('All timeout monitoring cleared');
    }

    /**
     * 获取超时统计信息
     */
    getTimeoutStats(): {
        activeTimeouts: number;
        maxProcessingTime: number;
        checkInterval: number;
        timeoutTasks: Array<{
            taskId: string;
            elapsedMs: number;
            remainingMs: number;
            progress: number; // 0-100
        }>;
    } {
        const now = Date.now();
        const timeoutTasks = Array.from(this.timeouts.values()).map(info => {
            const elapsedMs = now - info.startTime.getTime();
            const remainingMs = Math.max(0, info.timeoutMs - elapsedMs);
            const progress = Math.min(100, (elapsedMs / info.timeoutMs) * 100);

            return {
                taskId: info.taskId,
                elapsedMs,
                remainingMs,
                progress: Math.round(progress)
            };
        });

        return {
            activeTimeouts: this.timeouts.size,
            maxProcessingTime: this.maxProcessingTime,
            checkInterval: this.checkInterval,
            timeoutTasks
        };
    }

    /**
     * 扩展任务超时时间
     */
    extendTimeout(taskId: string, additionalMs: number): boolean {
        const timeoutInfo = this.timeouts.get(taskId);
        if (!timeoutInfo) {
            this.logger.warn(`Cannot extend timeout for task ${taskId}: not found`);
            return false;
        }

        // 清除当前超时
        if (timeoutInfo.timeoutHandle) {
            clearTimeout(timeoutInfo.timeoutHandle);
        }

        // 计算新的超时时间
        const elapsed = Date.now() - timeoutInfo.startTime.getTime();
        const newTimeoutMs = elapsed + additionalMs;

        // 创建新的超时处理器
        const newTimeoutHandle = setTimeout(async () => {
            await this.handleTimeout(taskId);
        }, additionalMs);

        // 更新超时信息
        timeoutInfo.timeoutMs = newTimeoutMs;
        timeoutInfo.timeoutHandle = newTimeoutHandle;

        this.logger.log(`Timeout extended for task ${taskId} by ${additionalMs}ms (new limit: ${newTimeoutMs}ms)`);
        return true;
    }

    /**
     * 批量清除超时监控
     */
    clearTimeouts(taskIds: string[]): void {
        for (const taskId of taskIds) {
            this.clearTimeout(taskId);
        }
        this.logger.debug(`Cleared timeout monitoring for ${taskIds.length} tasks`);
    }

    /**
     * 获取任务剩余时间
     */
    getRemainingTime(taskId: string): number | null {
        const timeoutInfo = this.timeouts.get(taskId);
        if (!timeoutInfo) {
            return null;
        }

        const elapsed = Date.now() - timeoutInfo.startTime.getTime();
        const remaining = timeoutInfo.timeoutMs - elapsed;
        return Math.max(0, remaining);
    }
}
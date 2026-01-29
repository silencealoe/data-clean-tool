import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
    ProcessingTask,
    TaskStatus,
    TaskStatusInfo,
    ProgressInfo,
    QueueStats,
    QueueManagerInterface,
} from '../../common/types/queue.types';

@Injectable()
export class QueueManagerService implements QueueManagerInterface, OnModuleDestroy {
    private readonly logger = new Logger(QueueManagerService.name);
    private readonly redis: Redis;
    private readonly queueName: string;
    private readonly taskTtlSeconds: number;
    private readonly maxRetries: number;
    private readonly baseRetryDelay: number;
    private retryCount: number = 0;

    constructor(private readonly configService: ConfigService) {
        // Initialize Redis connection
        const redisConfig = this.configService.get('redis');
        this.maxRetries = 5; // Maximum retry attempts
        this.baseRetryDelay = 1000; // Base delay in milliseconds (1 second)

        this.redis = new Redis({
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db,
            connectTimeout: redisConfig.connectTimeout,
            commandTimeout: redisConfig.commandTimeout,
            enableReadyCheck: redisConfig.enableReadyCheck,
            maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
            // Enable automatic retry
            enableOfflineQueue: false,
            lazyConnect: true,
        });

        // Get queue configuration
        const queueConfig = this.configService.get('queue');
        this.queueName = queueConfig.queueName;
        this.taskTtlSeconds = queueConfig.taskTtlSeconds;

        // Setup Redis event listeners
        this.setupRedisEventListeners();
    }

    async onModuleDestroy() {
        await this.redis.quit();
    }

    private setupRedisEventListeners(): void {
        this.redis.on('connect', () => {
            this.logger.log('Redis connected successfully');
            this.retryCount = 0; // Reset retry count on successful connection
        });

        this.redis.on('error', (error) => {
            this.logger.error('Redis connection error:', error);
            this.handleConnectionError(error);
        });

        this.redis.on('close', () => {
            this.logger.warn('Redis connection closed');
        });

        this.redis.on('reconnecting', () => {
            this.logger.log('Redis reconnecting...');
        });

        this.redis.on('end', () => {
            this.logger.warn('Redis connection ended');
            this.attemptReconnection();
        });
    }

    private handleConnectionError(error: Error): void {
        if (this.retryCount < this.maxRetries) {
            const delay = this.calculateRetryDelay(this.retryCount);
            this.logger.log(`Attempting to reconnect in ${delay}ms (attempt ${this.retryCount + 1}/${this.maxRetries})`);

            setTimeout(() => {
                this.retryCount++;
                this.attemptReconnection();
            }, delay);
        } else {
            this.logger.error(`Max retry attempts (${this.maxRetries}) reached. Redis connection failed permanently.`);
        }
    }

    private calculateRetryDelay(retryCount: number): number {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        return this.baseRetryDelay * Math.pow(2, retryCount);
    }

    private async attemptReconnection(): Promise<void> {
        try {
            await this.redis.connect();
        } catch (error) {
            this.logger.error('Reconnection attempt failed:', error);
        }
    }

    async enqueueTask(task: ProcessingTask): Promise<string> {
        try {
            await this.ensureConnection();
            const taskData = JSON.stringify(task);

            // Push task to the left of the list (FIFO: LPUSH + BRPOP)
            await this.redis.lpush(this.queueName, taskData);

            // Initialize task status
            await this.setTaskStatus(task.taskId, TaskStatus.PENDING, {
                createdAt: task.createdAt,
            });

            // Initialize progress
            await this.updateProgress(task.taskId, {
                taskId: task.taskId,
                progress: 0,
                processedRows: 0,
                totalRows: 0,
                currentPhase: 'queued',
                lastUpdated: new Date(),
            });

            // Update queue statistics
            await this.incrementQueueStat('totalEnqueued');

            this.logger.log(`Task ${task.taskId} enqueued successfully`);
            return task.taskId;
        } catch (error) {
            this.logger.error(`Failed to enqueue task ${task.taskId}:`, error);
            throw error;
        }
    }

    async dequeueTask(timeout: number = 30): Promise<ProcessingTask | null> {
        try {
            await this.ensureConnection();
            // Blocking right pop with timeout (FIFO)
            const result = await this.redis.brpop(this.queueName, timeout);

            if (!result) {
                return null; // Timeout occurred
            }

            const [, taskData] = result;
            const task: ProcessingTask = JSON.parse(taskData);

            this.logger.log(`Task ${task.taskId} dequeued successfully`);
            return task;
        } catch (error) {
            this.logger.error('Failed to dequeue task:', error);
            throw error;
        }
    }

    private async ensureConnection(): Promise<void> {
        if (this.redis.status !== 'ready') {
            try {
                // For ioredis, we don't need to explicitly call connect() 
                // if lazyConnect is true, it will connect automatically on first command
                // Just check if we can ping
                await this.redis.ping();
            } catch (error) {
                this.logger.error('Failed to establish Redis connection:', error);
                throw new Error('Redis connection unavailable');
            }
        }
    }

    async setTaskStatus(taskId: string, status: TaskStatus, data?: any): Promise<void> {
        try {
            await this.ensureConnection();
            const statusKey = `task:status:${taskId}`;
            const statusData = {
                status,
                ...data,
            };

            // Store status with TTL
            await this.redis.hmset(statusKey, statusData);
            await this.redis.expire(statusKey, this.taskTtlSeconds);

            this.logger.debug(`Task ${taskId} status updated to ${status}`);
        } catch (error) {
            this.logger.error(`Failed to set status for task ${taskId}:`, error);
            throw error;
        }
    }

    async getTaskStatus(taskId: string): Promise<TaskStatusInfo> {
        try {
            await this.ensureConnection();
            const statusKey = `task:status:${taskId}`;
            const statusData = await this.redis.hgetall(statusKey);

            if (!statusData || Object.keys(statusData).length === 0) {
                throw new Error(`Task ${taskId} not found`);
            }

            return {
                taskId,
                status: statusData.status as TaskStatus,
                progress: parseFloat(statusData.progress) || 0,
                createdAt: statusData.createdAt ? new Date(statusData.createdAt) : new Date(),
                startedAt: statusData.startedAt ? new Date(statusData.startedAt) : undefined,
                completedAt: statusData.completedAt ? new Date(statusData.completedAt) : undefined,
                errorMessage: statusData.errorMessage,
                statistics: statusData.statistics ? JSON.parse(statusData.statistics) : undefined,
            };
        } catch (error) {
            this.logger.error(`Failed to get status for task ${taskId}:`, error);
            throw error;
        }
    }

    async updateProgress(taskId: string, progress: ProgressInfo): Promise<void> {
        try {
            await this.ensureConnection();
            const progressKey = `task:progress:${taskId}`;
            const progressData = {
                ...progress,
                lastUpdated: new Date().toISOString(),
            };

            // Store progress with TTL
            await this.redis.hmset(progressKey, progressData);
            await this.redis.expire(progressKey, this.taskTtlSeconds);

            this.logger.debug(`Task ${taskId} progress updated to ${progress.progress}%`);
        } catch (error) {
            this.logger.error(`Failed to update progress for task ${taskId}:`, error);
            throw error;
        }
    }

    async getProgress(taskId: string): Promise<ProgressInfo> {
        try {
            await this.ensureConnection();
            const progressKey = `task:progress:${taskId}`;
            const progressData = await this.redis.hgetall(progressKey);

            if (!progressData || Object.keys(progressData).length === 0) {
                // Return default progress if not found
                return {
                    taskId,
                    progress: 0,
                    processedRows: 0,
                    totalRows: 0,
                    currentPhase: 'unknown',
                    lastUpdated: new Date(),
                };
            }

            return {
                taskId,
                progress: parseFloat(progressData.progress) || 0,
                processedRows: parseInt(progressData.processedRows, 10) || 0,
                totalRows: parseInt(progressData.totalRows, 10) || 0,
                currentPhase: progressData.currentPhase || 'unknown',
                estimatedTimeRemaining: progressData.estimatedTimeRemaining
                    ? parseInt(progressData.estimatedTimeRemaining, 10)
                    : undefined,
                lastUpdated: progressData.lastUpdated ? new Date(progressData.lastUpdated) : new Date(),
            };
        } catch (error) {
            this.logger.error(`Failed to get progress for task ${taskId}:`, error);
            throw error;
        }
    }

    async isHealthy(): Promise<boolean> {
        try {
            await this.ensureConnection();
            const result = await this.redis.ping();
            return result === 'PONG';
        } catch (error) {
            this.logger.error('Redis health check failed:', error);
            return false;
        }
    }

    async getQueueStats(): Promise<QueueStats> {
        try {
            await this.ensureConnection();
            const queueLength = await this.redis.llen(this.queueName);
            const statsKey = 'queue:stats';
            const stats = await this.redis.hgetall(statsKey);

            return {
                queueLength,
                totalEnqueued: parseInt(stats.totalEnqueued, 10) || 0,
                totalProcessed: parseInt(stats.totalProcessed, 10) || 0,
                totalFailed: parseInt(stats.totalFailed, 10) || 0,
                activeWorkers: parseInt(stats.activeWorkers, 10) || 0,
            };
        } catch (error) {
            this.logger.error('Failed to get queue stats:', error);
            throw error;
        }
    }

    private async incrementQueueStat(statName: string): Promise<void> {
        try {
            await this.ensureConnection();
            const statsKey = 'queue:stats';
            await this.redis.hincrby(statsKey, statName, 1);
        } catch (error) {
            this.logger.error(`Failed to increment stat ${statName}:`, error);
        }
    }

    // Additional utility methods for queue management
    async clearQueue(): Promise<void> {
        try {
            await this.ensureConnection();
            await this.redis.del(this.queueName);
            this.logger.log('Queue cleared successfully');
        } catch (error) {
            this.logger.error('Failed to clear queue:', error);
            throw error;
        }
    }

    async getQueueLength(): Promise<number> {
        try {
            await this.ensureConnection();
            return await this.redis.llen(this.queueName);
        } catch (error) {
            this.logger.error('Failed to get queue length:', error);
            throw error;
        }
    }

    async removeTask(taskId: string): Promise<void> {
        try {
            await this.ensureConnection();
            const statusKey = `task:status:${taskId}`;
            const progressKey = `task:progress:${taskId}`;

            await Promise.all([
                this.redis.del(statusKey),
                this.redis.del(progressKey),
            ]);

            this.logger.log(`Task ${taskId} removed successfully`);
        } catch (error) {
            this.logger.error(`Failed to remove task ${taskId}:`, error);
            throw error;
        }
    }
}
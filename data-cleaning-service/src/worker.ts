#!/usr/bin/env node

/**
 * 独立的Worker进程启动脚本
 * 
 * 该脚本创建一个独立的NestJS应用实例，专门用于运行TaskConsumer服务
 * 与主Web API进程分离，确保文件处理不会影响API响应性能
 * 
 * 需求：3.1 - 消费者应作为独立于Web API的单独进程运行
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkerModule } from './worker.module';
import { TaskConsumerService } from './services/queue/task-consumer.service';

/**
 * Worker进程管理器
 * 负责启动、监控和优雅关闭Worker进程
 */
class WorkerProcessManager {
    private readonly logger = new Logger(WorkerProcessManager.name);
    private app: any;
    private taskConsumer: TaskConsumerService;
    private isShuttingDown = false;
    private healthCheckInterval: NodeJS.Timeout;
    private startTime: Date;
    private processedTasks = 0;

    /**
     * 启动Worker进程
     */
    async start(): Promise<void> {
        try {
            this.startTime = new Date();
            this.logger.log('Starting Worker process...');

            // 创建NestJS应用实例
            this.app = await NestFactory.createApplicationContext(WorkerModule, {
                logger: ['error', 'warn', 'log', 'debug', 'verbose'],
            });

            // 获取配置服务
            const configService = this.app.get(ConfigService);
            this.logConfiguration(configService);

            // 获取TaskConsumer服务
            this.taskConsumer = this.app.get(TaskConsumerService);

            // 设置进程信号处理
            this.setupSignalHandlers();

            // 启动健康检查
            this.startHealthCheck();

            // 启动任务消费者
            await this.taskConsumer.start();

            this.logger.log('Worker process started successfully');
            this.logger.log(`Process ID: ${process.pid}`);
            this.logger.log(`Started at: ${this.startTime.toISOString()}`);

        } catch (error) {
            this.logger.error('Failed to start Worker process:', error);
            process.exit(1);
        }
    }

    /**
     * 记录配置信息
     */
    private logConfiguration(configService: ConfigService): void {
        const redisConfig = {
            host: configService.get('redis.host'),
            port: configService.get('redis.port'),
            db: configService.get('redis.db'),
        };

        const queueConfig = {
            queueName: configService.get('queue.queueName'),
            maxRetryAttempts: configService.get('queue.maxRetryAttempts'),
            taskTimeoutMs: configService.get('queue.taskTimeoutMs'),
        };

        this.logger.log('Worker Configuration:');
        this.logger.log(`Redis: ${redisConfig.host}:${redisConfig.port}/${redisConfig.db}`);
        this.logger.log(`Queue: ${queueConfig.queueName}`);
        this.logger.log(`Max Retries: ${queueConfig.maxRetryAttempts}`);
        this.logger.log(`Task Timeout: ${queueConfig.taskTimeoutMs}ms`);
    }

    /**
     * 设置进程信号处理器
     * 确保优雅关闭
     */
    private setupSignalHandlers(): void {
        // 优雅关闭信号
        const gracefulShutdownSignals = ['SIGTERM', 'SIGINT'];

        gracefulShutdownSignals.forEach(signal => {
            process.on(signal, async () => {
                this.logger.log(`Received ${signal}, initiating graceful shutdown...`);
                await this.shutdown();
            });
        });

        // 处理未捕获的异常
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught Exception:', error);
            this.shutdown().then(() => process.exit(1));
        });

        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.shutdown().then(() => process.exit(1));
        });
    }

    /**
     * 启动健康检查
     * 定期监控Worker状态和性能
     */
    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // 每30秒检查一次

        this.logger.log('Health check started (interval: 30s)');
    }

    /**
     * 执行健康检查
     */
    private performHealthCheck(): void {
        try {
            const uptime = Date.now() - this.startTime.getTime();
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            // 获取TaskConsumer状态
            const consumerStatus = this.taskConsumer.getStatus();

            // 计算内存使用率（MB）
            const memUsageMB = {
                rss: Math.round(memUsage.rss / 1024 / 1024),
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024),
            };

            // 记录健康状态
            this.logger.debug('Health Check Report:');
            this.logger.debug(`Uptime: ${Math.round(uptime / 1000)}s`);
            this.logger.debug(`Memory: RSS=${memUsageMB.rss}MB, Heap=${memUsageMB.heapUsed}/${memUsageMB.heapTotal}MB`);
            this.logger.debug(`Consumer Status: Running=${consumerStatus.isRunning}, Current Task=${consumerStatus.currentTask || 'none'}`);
            this.logger.debug(`Processed Tasks: ${this.processedTasks}`);

            // 检查内存使用是否过高（超过1GB发出警告）
            if (memUsageMB.rss > 1024) {
                this.logger.warn(`High memory usage detected: ${memUsageMB.rss}MB RSS`);
            }

            // 检查TaskConsumer是否正常运行
            if (!consumerStatus.isRunning && !this.isShuttingDown) {
                this.logger.error('TaskConsumer is not running, attempting to restart...');
                this.restartTaskConsumer();
            }

        } catch (error) {
            this.logger.error('Health check failed:', error);
        }
    }

    /**
     * 重启TaskConsumer
     */
    private async restartTaskConsumer(): Promise<void> {
        try {
            this.logger.log('Restarting TaskConsumer...');
            await this.taskConsumer.stop();
            await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
            await this.taskConsumer.start();
            this.logger.log('TaskConsumer restarted successfully');
        } catch (error) {
            this.logger.error('Failed to restart TaskConsumer:', error);
        }
    }

    /**
     * 优雅关闭Worker进程
     */
    private async shutdown(): Promise<void> {
        if (this.isShuttingDown) {
            this.logger.warn('Shutdown already in progress...');
            return;
        }

        this.isShuttingDown = true;
        this.logger.log('Shutting down Worker process...');

        try {
            // 停止健康检查
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.logger.log('Health check stopped');
            }

            // 停止TaskConsumer（优雅关闭）
            if (this.taskConsumer) {
                this.logger.log('Stopping TaskConsumer...');
                await this.taskConsumer.stop();
                this.logger.log('TaskConsumer stopped');
            }

            // 关闭NestJS应用
            if (this.app) {
                this.logger.log('Closing NestJS application...');
                await this.app.close();
                this.logger.log('NestJS application closed');
            }

            // 记录运行统计
            const uptime = Date.now() - this.startTime.getTime();
            this.logger.log('Worker Process Statistics:');
            this.logger.log(`Total uptime: ${Math.round(uptime / 1000)}s`);
            this.logger.log(`Processed tasks: ${this.processedTasks}`);
            this.logger.log('Worker process shutdown completed');

            process.exit(0);

        } catch (error) {
            this.logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }

    /**
     * 增加已处理任务计数
     */
    incrementProcessedTasks(): void {
        this.processedTasks++;
    }

    /**
     * 获取Worker状态
     */
    getStatus(): {
        isRunning: boolean;
        uptime: number;
        processedTasks: number;
        memoryUsage: NodeJS.MemoryUsage;
        consumerStatus: any;
    } {
        const memUsage = process.memoryUsage();
        const uptime = Date.now() - this.startTime.getTime();
        const consumerStatus = this.taskConsumer?.getStatus() || { isRunning: false, isShuttingDown: false, currentTask: null };

        return {
            isRunning: !this.isShuttingDown,
            uptime,
            processedTasks: this.processedTasks,
            memoryUsage: memUsage,
            consumerStatus,
        };
    }
}

/**
 * 主函数
 * 启动Worker进程管理器
 */
async function main(): Promise<void> {
    const workerManager = new WorkerProcessManager();

    // 设置进程标题
    process.title = 'data-cleaning-worker';

    // 启动Worker进程
    await workerManager.start();
}

// 如果直接运行此文件，启动Worker进程
if (require.main === module) {
    main().catch((error) => {
        console.error('Failed to start Worker process:', error);
        process.exit(1);
    });
}

export { WorkerProcessManager };
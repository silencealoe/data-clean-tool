import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';

export interface QueueMetrics {
  queueLength: number;
  totalEnqueued: number;
  totalProcessed: number;
  totalFailed: number;
  totalRetried: number;
  activeWorkers: number;
  averageProcessingTime: number;
  throughputPerMinute: number;
  errorRate: number;
  lastUpdated: Date;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  redisConnections: number;
  redisMemoryUsage: number;
  lastUpdated: Date;
}

export interface PerformanceMetrics {
  processingTimes: number[];
  queueWaitTimes: number[];
  errorCounts: Map<string, number>;
  throughputHistory: Array<{ timestamp: Date; count: number }>;
  peakQueueLength: number;
  averageQueueLength: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private redis: Redis;
  private metricsCache: Map<string, any> = new Map();
  private performanceData: PerformanceMetrics = {
    processingTimes: [],
    queueWaitTimes: [],
    errorCounts: new Map(),
    throughputHistory: [],
    peakQueueLength: 0,
    averageQueueLength: 0,
  };

  private readonly METRICS_KEY = 'queue:metrics';
  private readonly PERFORMANCE_KEY = 'queue:performance';
  private readonly CACHE_TTL = 30; // 30 seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    if (process.env.NODE_ENV !== 'test') {
      this.initializeRedis();
      this.startMetricsCollection();
    }
  }

  private initializeRedis(): void {
    const redisConfig = this.configService.get('redis');
    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      connectTimeout: redisConfig.connectTimeout,
      commandTimeout: redisConfig.commandTimeout,
      maxRetriesPerRequest: 3,
      // Enable offline queue to buffer commands when disconnected
      enableOfflineQueue: true,
      // Don't use lazy connect to establish connection immediately
      lazyConnect: false,
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error in metrics service', error);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully in metrics service');
    });

    this.redis.on('ready', () => {
      this.logger.log('Redis ready in metrics service');
    });
  }

  private startMetricsCollection(): void {
    // Collect metrics every 30 seconds
    setInterval(async () => {
      await this.collectAndStoreMetrics();
    }, 30000);

    // Clean up old performance data every 5 minutes
    setInterval(() => {
      this.cleanupPerformanceData();
    }, 300000);
  }

  async getQueueMetrics(): Promise<QueueMetrics> {
    const cached = this.metricsCache.get('queue');
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL * 1000) {
      return cached.data;
    }

    try {
      const queueName = this.configService.get('queue.queueName');
      const pipeline = this.redis.pipeline();

      // Get queue length
      pipeline.llen(`queue:${queueName}`);

      // Get metrics from Redis hash
      pipeline.hmget(this.METRICS_KEY,
        'totalEnqueued', 'totalProcessed', 'totalFailed', 'totalRetried',
        'activeWorkers', 'averageProcessingTime', 'throughputPerMinute', 'errorRate'
      );

      const results = await pipeline.exec();
      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }
      const queueLength = results[0][1] as number;
      const metricsData = results[1][1] as string[];

      const metrics: QueueMetrics = {
        queueLength,
        totalEnqueued: parseInt(metricsData[0] || '0'),
        totalProcessed: parseInt(metricsData[1] || '0'),
        totalFailed: parseInt(metricsData[2] || '0'),
        totalRetried: parseInt(metricsData[3] || '0'),
        activeWorkers: parseInt(metricsData[4] || '0'),
        averageProcessingTime: parseFloat(metricsData[5] || '0'),
        throughputPerMinute: parseFloat(metricsData[6] || '0'),
        errorRate: parseFloat(metricsData[7] || '0'),
        lastUpdated: new Date(),
      };

      // Cache the result
      this.metricsCache.set('queue', {
        data: metrics,
        timestamp: Date.now(),
      });

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get queue metrics', error);
      throw error;
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const cached = this.metricsCache.get('system');
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL * 1000) {
      return cached.data;
    }

    try {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      // Get Redis info
      const redisInfo = await this.redis.info('memory');
      const redisMemoryMatch = redisInfo.match(/used_memory:(\d+)/);
      const redisMemoryUsage = redisMemoryMatch ? parseInt(redisMemoryMatch[1]) : 0;

      // Get Redis connection count
      const redisClients = await this.redis.info('clients');
      const clientsMatch = redisClients.match(/connected_clients:(\d+)/);
      const redisConnections = clientsMatch ? parseInt(clientsMatch[1]) : 0;

      const metrics: SystemMetrics = {
        uptime,
        memoryUsage,
        cpuUsage: await this.getCpuUsage(),
        redisConnections,
        redisMemoryUsage,
        lastUpdated: new Date(),
      };

      // Cache the result
      this.metricsCache.set('system', {
        data: metrics,
        timestamp: Date.now(),
      });

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get system metrics', error);
      throw error;
    }
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return { ...this.performanceData };
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = endUsage.user + endUsage.system;
        const cpuPercent = (totalUsage / 1000000) * 100; // Convert to percentage
        resolve(Math.min(cpuPercent, 100));
      }, 100);
    });
  }

  private async collectAndStoreMetrics(): Promise<void> {
    try {
      const queueMetrics = await this.getQueueMetrics();
      const systemMetrics = await this.getSystemMetrics();

      // Update peak queue length
      if (queueMetrics.queueLength > this.performanceData.peakQueueLength) {
        this.performanceData.peakQueueLength = queueMetrics.queueLength;
      }

      // Update throughput history
      this.performanceData.throughputHistory.push({
        timestamp: new Date(),
        count: queueMetrics.throughputPerMinute,
      });

      // Keep only last 24 hours of throughput data
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      this.performanceData.throughputHistory = this.performanceData.throughputHistory
        .filter(entry => entry.timestamp > oneDayAgo);

      // Calculate average queue length
      const recentThroughput = this.performanceData.throughputHistory.slice(-60); // Last hour
      if (recentThroughput.length > 0) {
        this.performanceData.averageQueueLength =
          recentThroughput.reduce((sum, entry) => sum + entry.count, 0) / recentThroughput.length;
      }

      // Store performance data in Redis using individual field sets
      const performanceData = {
        peakQueueLength: this.performanceData.peakQueueLength.toString(),
        averageQueueLength: this.performanceData.averageQueueLength.toString(),
        lastUpdated: new Date().toISOString(),
      };

      for (const [field, value] of Object.entries(performanceData)) {
        await this.redis.hset(this.PERFORMANCE_KEY, field, value);
      }

      this.logger.debug('Metrics collected and stored successfully');
    } catch (error) {
      this.logger.error('Failed to collect metrics', error);
    }
  }

  private cleanupPerformanceData(): void {
    const maxEntries = 1000;

    // Keep only recent processing times
    if (this.performanceData.processingTimes.length > maxEntries) {
      this.performanceData.processingTimes = this.performanceData.processingTimes.slice(-maxEntries);
    }

    // Keep only recent queue wait times
    if (this.performanceData.queueWaitTimes.length > maxEntries) {
      this.performanceData.queueWaitTimes = this.performanceData.queueWaitTimes.slice(-maxEntries);
    }

    // Reset error counts periodically
    if (this.performanceData.errorCounts.size > 100) {
      this.performanceData.errorCounts.clear();
    }
  }

  // Event handlers for real-time metrics updates
  @OnEvent('task.enqueued')
  async handleTaskEnqueued(): Promise<void> {
    await this.incrementMetric('totalEnqueued');
  }

  @OnEvent('task.processing.started')
  async handleTaskProcessingStarted(data: { taskId: string; enqueuedAt: Date }): Promise<void> {
    const waitTime = Date.now() - data.enqueuedAt.getTime();
    this.performanceData.queueWaitTimes.push(waitTime);
    await this.incrementMetric('activeWorkers');
  }

  @OnEvent('task.processing.completed')
  async handleTaskProcessingCompleted(data: { taskId: string; startedAt: Date; processingTime: number }): Promise<void> {
    this.performanceData.processingTimes.push(data.processingTime);
    await this.incrementMetric('totalProcessed');
    await this.decrementMetric('activeWorkers');
    await this.updateAverageProcessingTime();
    await this.updateThroughput();
  }

  @OnEvent('task.processing.failed')
  async handleTaskProcessingFailed(data: { taskId: string; error: string; isRetry: boolean }): Promise<void> {
    await this.incrementMetric('totalFailed');
    await this.decrementMetric('activeWorkers');

    if (data.isRetry) {
      await this.incrementMetric('totalRetried');
    }

    // Track error types
    const errorType = this.classifyError(data.error);
    const currentCount = this.performanceData.errorCounts.get(errorType) || 0;
    this.performanceData.errorCounts.set(errorType, currentCount + 1);

    await this.updateErrorRate();
  }

  private async incrementMetric(metric: string): Promise<void> {
    try {
      await this.redis.hincrby(this.METRICS_KEY, metric, 1);
    } catch (error) {
      this.logger.error(`Failed to increment metric ${metric}`, error);
    }
  }

  private async decrementMetric(metric: string): Promise<void> {
    try {
      await this.redis.hincrby(this.METRICS_KEY, metric, -1);
    } catch (error) {
      this.logger.error(`Failed to decrement metric ${metric}`, error);
    }
  }

  private async updateAverageProcessingTime(): Promise<void> {
    if (this.performanceData.processingTimes.length === 0) return;

    const recent = this.performanceData.processingTimes.slice(-100); // Last 100 tasks
    const average = recent.reduce((sum, time) => sum + time, 0) / recent.length;

    try {
      await this.redis.hset(this.METRICS_KEY, 'averageProcessingTime', average.toFixed(2));
    } catch (error) {
      this.logger.error('Failed to update average processing time', error);
    }
  }

  private async updateThroughput(): Promise<void> {
    try {
      const oneMinuteAgo = Date.now() - 60000;
      const recentCompletions = this.performanceData.throughputHistory
        .filter(entry => entry.timestamp.getTime() > oneMinuteAgo).length;

      await this.redis.hset(this.METRICS_KEY, 'throughputPerMinute', recentCompletions.toString());
    } catch (error) {
      this.logger.error('Failed to update throughput', error);
    }
  }

  private async updateErrorRate(): Promise<void> {
    try {
      const totalProcessed = await this.redis.hget(this.METRICS_KEY, 'totalProcessed');
      const totalFailed = await this.redis.hget(this.METRICS_KEY, 'totalFailed');

      const processed = parseInt(totalProcessed || '0');
      const failed = parseInt(totalFailed || '0');
      const total = processed + failed;

      const errorRate = total > 0 ? (failed / total) * 100 : 0;
      await this.redis.hset(this.METRICS_KEY, 'errorRate', errorRate.toFixed(2));
    } catch (error) {
      this.logger.error('Failed to update error rate', error);
    }
  }

  private classifyError(errorMessage: string): string {
    if (errorMessage.includes('timeout')) return 'timeout';
    if (errorMessage.includes('connection')) return 'connection';
    if (errorMessage.includes('memory')) return 'memory';
    if (errorMessage.includes('validation')) return 'validation';
    if (errorMessage.includes('file')) return 'file_error';
    return 'unknown';
  }

  async resetMetrics(): Promise<void> {
    try {
      await this.redis.del(this.METRICS_KEY);
      await this.redis.del(this.PERFORMANCE_KEY);
      this.metricsCache.clear();

      // Reset performance data
      this.performanceData = {
        processingTimes: [],
        queueWaitTimes: [],
        errorCounts: new Map(),
        throughputHistory: [],
        peakQueueLength: 0,
        averageQueueLength: 0,
      };

      this.logger.log('Metrics reset successfully');
    } catch (error) {
      this.logger.error('Failed to reset metrics', error);
      throw error;
    }
  }

  async getMetricsSummary(): Promise<any> {
    const queueMetrics = await this.getQueueMetrics();
    const systemMetrics = await this.getSystemMetrics();
    const performanceMetrics = await this.getPerformanceMetrics();

    return {
      queue: queueMetrics,
      system: systemMetrics,
      performance: {
        peakQueueLength: performanceMetrics.peakQueueLength,
        averageQueueLength: performanceMetrics.averageQueueLength,
        recentProcessingTimes: performanceMetrics.processingTimes.slice(-10),
        errorBreakdown: Object.fromEntries(performanceMetrics.errorCounts),
        throughputTrend: performanceMetrics.throughputHistory.slice(-12), // Last 12 data points
      },
      timestamp: new Date(),
    };
  }
}
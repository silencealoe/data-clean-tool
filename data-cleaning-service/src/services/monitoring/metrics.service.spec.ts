import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let configService: ConfigService;
  let eventEmitter: EventEmitter2;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'redis': {
          host: 'localhost',
          port: 6379,
          password: undefined,
          db: 0,
        },
        'queue': {
          queueName: 'test-queue',
        },
        'queue.queueName': 'test-queue',
      };
      return config[key];
    }),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
    configService = module.get<ConfigService>(ConfigService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getQueueMetrics', () => {
    it('should return queue metrics with default values when Redis is empty', async () => {
      // Mock Redis operations to return empty results
      const mockRedis = {
        pipeline: jest.fn(() => ({
          llen: jest.fn(),
          hmget: jest.fn(),
          exec: jest.fn().mockResolvedValue([
            [null, 0], // queue length
            [null, ['0', '0', '0', '0', '0', '0', '0', '0']], // metrics
          ]),
        })),
      };

      // Replace the Redis instance
      (service as any).redis = mockRedis;

      const metrics = await service.getQueueMetrics();

      expect(metrics).toEqual({
        queueLength: 0,
        totalEnqueued: 0,
        totalProcessed: 0,
        totalFailed: 0,
        totalRetried: 0,
        activeWorkers: 0,
        averageProcessingTime: 0,
        throughputPerMinute: 0,
        errorRate: 0,
        lastUpdated: expect.any(Date),
      });
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics', async () => {
      // Mock Redis info responses
      const mockRedis = {
        info: jest.fn()
          .mockResolvedValueOnce('used_memory:1048576\r\n') // memory info
          .mockResolvedValueOnce('connected_clients:5\r\n'), // clients info
      };

      (service as any).redis = mockRedis;

      const metrics = await service.getSystemMetrics();

      expect(metrics).toEqual({
        uptime: expect.any(Number),
        memoryUsage: expect.any(Object),
        cpuUsage: expect.any(Number),
        redisConnections: 5,
        redisMemoryUsage: 1048576,
        lastUpdated: expect.any(Date),
      });
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      const metrics = await service.getPerformanceMetrics();

      expect(metrics).toEqual({
        processingTimes: expect.any(Array),
        queueWaitTimes: expect.any(Array),
        errorCounts: expect.any(Map),
        throughputHistory: expect.any(Array),
        peakQueueLength: expect.any(Number),
        averageQueueLength: expect.any(Number),
      });
    });
  });

  describe('event handlers', () => {
    it('should handle task enqueued event', async () => {
      const mockRedis = {
        hincrby: jest.fn().mockResolvedValue(1),
      };

      (service as any).redis = mockRedis;

      await service.handleTaskEnqueued();

      expect(mockRedis.hincrby).toHaveBeenCalledWith('queue:metrics', 'totalEnqueued', 1);
    });

    it('should handle task processing started event', async () => {
      const mockRedis = {
        hincrby: jest.fn().mockResolvedValue(1),
      };

      (service as any).redis = mockRedis;

      const eventData = {
        taskId: 'test-task',
        enqueuedAt: new Date(Date.now() - 5000), // 5 seconds ago
      };

      await service.handleTaskProcessingStarted(eventData);

      expect(mockRedis.hincrby).toHaveBeenCalledWith('queue:metrics', 'activeWorkers', 1);
      expect((service as any).performanceData.queueWaitTimes).toContain(expect.any(Number));
    });

    it('should handle task processing completed event', async () => {
      const mockRedis = {
        hincrby: jest.fn().mockResolvedValue(1),
        hset: jest.fn().mockResolvedValue('OK'),
        hget: jest.fn().mockResolvedValue('10'),
      };

      (service as any).redis = mockRedis;

      const eventData = {
        taskId: 'test-task',
        startedAt: new Date(Date.now() - 10000), // 10 seconds ago
        processingTime: 8000,
      };

      await service.handleTaskProcessingCompleted(eventData);

      expect(mockRedis.hincrby).toHaveBeenCalledWith('queue:metrics', 'totalProcessed', 1);
      expect(mockRedis.hincrby).toHaveBeenCalledWith('queue:metrics', 'activeWorkers', -1);
      expect((service as any).performanceData.processingTimes).toContain(8000);
    });

    it('should handle task processing failed event', async () => {
      const mockRedis = {
        hincrby: jest.fn().mockResolvedValue(1),
        hget: jest.fn().mockResolvedValue('5'),
        hset: jest.fn().mockResolvedValue('OK'),
      };

      (service as any).redis = mockRedis;

      const eventData = {
        taskId: 'test-task',
        error: 'Connection timeout',
        isRetry: false,
      };

      await service.handleTaskProcessingFailed(eventData);

      expect(mockRedis.hincrby).toHaveBeenCalledWith('queue:metrics', 'totalFailed', 1);
      expect(mockRedis.hincrby).toHaveBeenCalledWith('queue:metrics', 'activeWorkers', -1);
      expect((service as any).performanceData.errorCounts.get('timeout')).toBe(1);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics', async () => {
      const mockRedis = {
        del: jest.fn().mockResolvedValue(1),
      };

      (service as any).redis = mockRedis;

      await service.resetMetrics();

      expect(mockRedis.del).toHaveBeenCalledWith('queue:metrics');
      expect(mockRedis.del).toHaveBeenCalledWith('queue:performance');
      expect((service as any).metricsCache.size).toBe(0);
    });
  });
});
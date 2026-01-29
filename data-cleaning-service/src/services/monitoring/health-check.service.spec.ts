import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Connection } from 'typeorm';
import { HealthCheckService } from './health-check.service';

describe('HealthCheckService', () => {
  let service: HealthCheckService;
  let configService: ConfigService;
  let connection: Connection;

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

  const mockConnection = {
    isConnected: true,
    query: jest.fn().mockResolvedValue([{ test: 1 }]),
    options: {
      type: 'mysql',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthCheckService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: Connection,
          useValue: mockConnection,
        },
      ],
    }).compile();

    service = module.get<HealthCheckService>(HealthCheckService);
    configService = module.get<ConfigService>(ConfigService);
    connection = module.get<Connection>(Connection);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealthStatus', () => {
    it('should return overall health status', async () => {
      // Mock Redis operations
      const mockRedis = {
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue('test'),
        del: jest.fn().mockResolvedValue(1),
        info: jest.fn().mockResolvedValue('redis_version:6.2.0\r\n'),
        llen: jest.fn().mockResolvedValue(5),
        hlen: jest.fn().mockResolvedValue(2),
      };

      (service as any).redis = mockRedis;

      const healthStatus = await service.getHealthStatus();

      expect(healthStatus).toEqual({
        status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        timestamp: expect.any(Date),
        uptime: expect.any(Number),
        version: expect.any(String),
        components: expect.arrayContaining([
          expect.objectContaining({
            name: 'redis',
            status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          }),
          expect.objectContaining({
            name: 'database',
            status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          }),
          expect.objectContaining({
            name: 'queue',
            status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          }),
          expect.objectContaining({
            name: 'memory',
            status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          }),
          expect.objectContaining({
            name: 'disk',
            status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          }),
        ]),
      });
    });
  });

  describe('isHealthy', () => {
    it('should return true when system is healthy', async () => {
      // Mock all components as healthy
      jest.spyOn(service as any, 'checkRedisHealth').mockResolvedValue({
        name: 'redis',
        status: 'healthy',
        responseTime: 50,
      });

      jest.spyOn(service as any, 'checkDatabaseHealth').mockResolvedValue({
        name: 'database',
        status: 'healthy',
        responseTime: 100,
      });

      jest.spyOn(service as any, 'checkQueueHealth').mockResolvedValue({
        name: 'queue',
        status: 'healthy',
        responseTime: 30,
      });

      jest.spyOn(service as any, 'checkMemoryHealth').mockResolvedValue({
        name: 'memory',
        status: 'healthy',
        responseTime: 5,
      });

      jest.spyOn(service as any, 'checkDiskHealth').mockResolvedValue({
        name: 'disk',
        status: 'healthy',
        responseTime: 20,
      });

      const isHealthy = await service.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should return false when any component is unhealthy', async () => {
      // Mock Redis as unhealthy
      jest.spyOn(service as any, 'checkRedisHealth').mockResolvedValue({
        name: 'redis',
        status: 'unhealthy',
        responseTime: 5000,
        error: 'Connection failed',
      });

      jest.spyOn(service as any, 'checkDatabaseHealth').mockResolvedValue({
        name: 'database',
        status: 'healthy',
        responseTime: 100,
      });

      jest.spyOn(service as any, 'checkQueueHealth').mockResolvedValue({
        name: 'queue',
        status: 'healthy',
        responseTime: 30,
      });

      jest.spyOn(service as any, 'checkMemoryHealth').mockResolvedValue({
        name: 'memory',
        status: 'healthy',
        responseTime: 5,
      });

      jest.spyOn(service as any, 'checkDiskHealth').mockResolvedValue({
        name: 'disk',
        status: 'healthy',
        responseTime: 20,
      });

      const isHealthy = await service.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });

  describe('waitForHealthy', () => {
    it('should return true when system becomes healthy', async () => {
      let callCount = 0;
      jest.spyOn(service, 'isHealthy').mockImplementation(async () => {
        callCount++;
        return callCount >= 2; // Become healthy on second call
      });

      const result = await service.waitForHealthy(5000);
      expect(result).toBe(true);
    });

    it('should return false when timeout is reached', async () => {
      jest.spyOn(service, 'isHealthy').mockResolvedValue(false);

      const result = await service.waitForHealthy(1000); // 1 second timeout
      expect(result).toBe(false);
    });
  });

  describe('getDetailedHealthReport', () => {
    it('should return detailed health report with system information', async () => {
      // Mock Redis operations
      const mockRedis = {
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue('test'),
        del: jest.fn().mockResolvedValue(1),
        info: jest.fn().mockResolvedValue('redis_version:6.2.0\r\n'),
        llen: jest.fn().mockResolvedValue(5),
        hlen: jest.fn().mockResolvedValue(2),
      };

      (service as any).redis = mockRedis;

      const report = await service.getDetailedHealthReport();

      expect(report).toEqual({
        status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        timestamp: expect.any(Date),
        uptime: expect.any(Number),
        version: expect.any(String),
        components: expect.any(Array),
        system: {
          nodeVersion: expect.any(String),
          platform: expect.any(String),
          architecture: expect.any(String),
          environment: expect.any(String),
          processId: expect.any(Number),
          parentProcessId: expect.any(Number),
          workingDirectory: expect.any(String),
        },
      });
    });
  });
});
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfigValidationService } from './config-validation.service';

describe('ConfigValidationService', () => {
  let service: ConfigValidationService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'redis': {
          host: 'localhost',
          port: 6379,
          password: undefined,
          db: 0,
          connectTimeout: 5000,
          commandTimeout: 3000,
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
        },
        'queue': {
          queueName: 'test-queue',
          maxRetryAttempts: 3,
          taskTimeoutMs: 1800000,
          taskTtlSeconds: 604800,
          progressUpdateIntervalMs: 2000,
          maxProcessingTimeMs: 1800000,
          timeoutCheckIntervalMs: 60000,
          baseRetryDelay: 1000,
          recovery: {
            abandonedTaskThresholdMs: 3600000,
            maxRecoveryAttempts: 3,
            batchSize: 50,
            enableAutoRecovery: true,
            checkIntervalMs: 600000,
          },
        },
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigValidationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ConfigValidationService>(ConfigValidationService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateRedisConfig', () => {
    it('should validate valid Redis config', () => {
      const config = {
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
        connectTimeout: 5000,
        commandTimeout: 3000,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      };

      const result = service.validateRedisConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid Redis config', () => {
      const config = {
        host: '',
        port: 99999, // Invalid port
        password: undefined,
        db: 20, // Invalid db number
        connectTimeout: 5000,
        commandTimeout: 3000,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      };

      const result = service.validateRedisConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateQueueConfig', () => {
    it('should validate valid queue config', () => {
      const config = {
        queueName: 'test-queue',
        maxRetryAttempts: 3,
        taskTimeoutMs: 1800000,
        taskTtlSeconds: 604800,
        progressUpdateIntervalMs: 2000,
        maxProcessingTimeMs: 1800000,
        timeoutCheckIntervalMs: 60000,
        baseRetryDelay: 1000,
        recovery: {
          abandonedTaskThresholdMs: 3600000,
          maxRecoveryAttempts: 3,
          batchSize: 50,
          enableAutoRecovery: true,
          checkIntervalMs: 600000,
        },
      };

      const result = service.validateQueueConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject queue config with timeout greater than max processing time', () => {
      const config = {
        queueName: 'test-queue',
        maxRetryAttempts: 3,
        taskTimeoutMs: 2000000, // Greater than maxProcessingTimeMs
        taskTtlSeconds: 604800,
        progressUpdateIntervalMs: 2000,
        maxProcessingTimeMs: 1800000,
        timeoutCheckIntervalMs: 60000,
        baseRetryDelay: 1000,
        recovery: {
          abandonedTaskThresholdMs: 3600000,
          maxRecoveryAttempts: 3,
          batchSize: 50,
          enableAutoRecovery: true,
          checkIntervalMs: 600000,
        },
      };

      const result = service.validateQueueConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task timeout cannot be greater than max processing time');
    });
  });

  describe('validateAllConfigs', () => {
    it('should validate all configurations', () => {
      const result = service.validateAllConfigs();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Joi from 'joi';

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  connectTimeout: number;
  commandTimeout: number;
  enableReadyCheck: boolean;
  maxRetriesPerRequest: number;
}

export interface QueueConfig {
  queueName: string;
  maxRetryAttempts: number;
  taskTimeoutMs: number;
  taskTtlSeconds: number;
  progressUpdateIntervalMs: number;
  maxProcessingTimeMs: number;
  timeoutCheckIntervalMs: number;
  baseRetryDelay: number;
  recovery: {
    abandonedTaskThresholdMs: number;
    maxRecoveryAttempts: number;
    batchSize: number;
    enableAutoRecovery: boolean;
    checkIntervalMs: number;
  };
}

@Injectable()
export class ConfigValidationService {
  private readonly logger = new Logger(ConfigValidationService.name);

  private readonly redisSchema = Joi.object({
    host: Joi.string().hostname().required(),
    port: Joi.number().port().required(),
    password: Joi.string().optional(),
    db: Joi.number().integer().min(0).max(15).required(),
    connectTimeout: Joi.number().integer().min(1000).max(30000).required(),
    commandTimeout: Joi.number().integer().min(1000).max(30000).required(),
    enableReadyCheck: Joi.boolean().required(),
    maxRetriesPerRequest: Joi.number().integer().min(0).max(10).required(),
  });

  private readonly queueSchema = Joi.object({
    queueName: Joi.string().min(1).max(100).required(),
    maxRetryAttempts: Joi.number().integer().min(0).max(10).required(),
    taskTimeoutMs: Joi.number().integer().min(60000).max(7200000).required(), // 1min to 2hours
    taskTtlSeconds: Joi.number().integer().min(3600).max(2592000).required(), // 1hour to 30days
    progressUpdateIntervalMs: Joi.number().integer().min(500).max(10000).required(),
    maxProcessingTimeMs: Joi.number().integer().min(60000).max(7200000).required(),
    timeoutCheckIntervalMs: Joi.number().integer().min(10000).max(600000).required(),
    baseRetryDelay: Joi.number().integer().min(100).max(10000).required(),
    recovery: Joi.object({
      abandonedTaskThresholdMs: Joi.number().integer().min(300000).max(86400000).required(), // 5min to 24hours
      maxRecoveryAttempts: Joi.number().integer().min(1).max(10).required(),
      batchSize: Joi.number().integer().min(1).max(1000).required(),
      enableAutoRecovery: Joi.boolean().required(),
      checkIntervalMs: Joi.number().integer().min(60000).max(3600000).required(), // 1min to 1hour
    }).required(),
  });

  constructor(private readonly configService: ConfigService) {}

  validateRedisConfig(config: RedisConfig): ConfigValidationResult {
    const { error, warning } = this.redisSchema.validate(config, {
      abortEarly: false,
      allowUnknown: false,
    });

    const result: ConfigValidationResult = {
      isValid: !error,
      errors: error ? error.details.map(detail => detail.message) : [],
      warnings: [],
    };

    // Add custom warnings
    if (config.connectTimeout < 3000) {
      result.warnings.push('Redis connect timeout is less than 3 seconds, may cause connection issues');
    }

    if (config.maxRetriesPerRequest === 0) {
      result.warnings.push('Redis max retries is 0, operations may fail immediately on network issues');
    }

    return result;
  }

  validateQueueConfig(config: QueueConfig): ConfigValidationResult {
    const { error } = this.queueSchema.validate(config, {
      abortEarly: false,
      allowUnknown: false,
    });

    const result: ConfigValidationResult = {
      isValid: !error,
      errors: error ? error.details.map(detail => detail.message) : [],
      warnings: [],
    };

    // Add custom warnings and cross-field validations
    if (config.taskTimeoutMs > config.maxProcessingTimeMs) {
      result.errors.push('Task timeout cannot be greater than max processing time');
      result.isValid = false;
    }

    if (config.progressUpdateIntervalMs > config.taskTimeoutMs / 10) {
      result.warnings.push('Progress update interval is too large compared to task timeout');
    }

    if (config.recovery.abandonedTaskThresholdMs < config.maxProcessingTimeMs * 2) {
      result.warnings.push('Abandoned task threshold should be at least 2x max processing time');
    }

    if (config.baseRetryDelay * Math.pow(2, config.maxRetryAttempts) > 60000) {
      result.warnings.push('Maximum retry delay (with exponential backoff) exceeds 1 minute');
    }

    return result;
  }

  validateAllConfigs(): ConfigValidationResult {
    const redisConfig = this.configService.get<RedisConfig>('redis');
    const queueConfig = this.configService.get<QueueConfig>('queue');

    if (!redisConfig || !queueConfig) {
      return {
        isValid: false,
        errors: ['Missing required configuration sections'],
        warnings: [],
      };
    }

    const redisValidation = this.validateRedisConfig(redisConfig);
    const queueValidation = this.validateQueueConfig(queueConfig);

    return {
      isValid: redisValidation.isValid && queueValidation.isValid,
      errors: [...redisValidation.errors, ...queueValidation.errors],
      warnings: [...redisValidation.warnings, ...queueValidation.warnings],
    };
  }

  logValidationResults(result: ConfigValidationResult): void {
    if (result.isValid) {
      this.logger.log('Configuration validation passed');
    } else {
      this.logger.error('Configuration validation failed:');
      result.errors.forEach(error => this.logger.error(`  - ${error}`));
    }

    if (result.warnings.length > 0) {
      this.logger.warn('Configuration warnings:');
      result.warnings.forEach(warning => this.logger.warn(`  - ${warning}`));
    }
  }
}
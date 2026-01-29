import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { 
  ConfigValidationService, 
  ConfigValidationResult, 
  RedisConfig, 
  QueueConfig 
} from './config-validation.service';

export interface ConfigChangeEvent {
  section: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

export interface ConfigSnapshot {
  redis: RedisConfig;
  queue: QueueConfig;
  timestamp: Date;
  version: string;
}

@Injectable()
export class ConfigManagerService implements OnModuleInit {
  private readonly logger = new Logger(ConfigManagerService.name);
  private configSnapshot: ConfigSnapshot;
  private fileWatchers: fs.FSWatcher[] = [];
  private readonly configFiles = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'src/config/redis.config.ts'),
    path.join(process.cwd(), 'src/config/queue.config.ts'),
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly configValidation: ConfigValidationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    // Create initial snapshot
    await this.createSnapshot();
    
    // Validate initial configuration
    const validation = this.configValidation.validateAllConfigs();
    this.configValidation.logValidationResults(validation);
    
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Setup file watchers for hot reload
    this.setupFileWatchers();
    
    this.logger.log('Configuration manager initialized');
  }

  private async createSnapshot(): Promise<void> {
    const redis = this.configService.get<RedisConfig>('redis');
    const queue = this.configService.get<QueueConfig>('queue');
    
    this.configSnapshot = {
      redis,
      queue,
      timestamp: new Date(),
      version: this.generateVersion(),
    };
  }

  private generateVersion(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getCurrentSnapshot(): ConfigSnapshot {
    return { ...this.configSnapshot };
  }

  getRedisConfig(): RedisConfig {
    return { ...this.configSnapshot.redis };
  }

  getQueueConfig(): QueueConfig {
    return { ...this.configSnapshot.queue };
  }

  async reloadConfiguration(): Promise<ConfigValidationResult> {
    this.logger.log('Reloading configuration...');
    
    try {
      // Create new snapshot
      const oldSnapshot = { ...this.configSnapshot };
      await this.createSnapshot();
      
      // Validate new configuration
      const validation = this.configValidation.validateAllConfigs();
      
      if (!validation.isValid) {
        // Rollback to old snapshot
        this.configSnapshot = oldSnapshot;
        this.logger.error('Configuration reload failed, rolled back to previous version');
        return validation;
      }

      // Emit change events for modified sections
      await this.emitConfigChanges(oldSnapshot, this.configSnapshot);
      
      this.logger.log(`Configuration reloaded successfully (version: ${this.configSnapshot.version})`);
      return validation;
      
    } catch (error) {
      this.logger.error('Failed to reload configuration', error);
      return {
        isValid: false,
        errors: [`Configuration reload failed: ${error.message}`],
        warnings: [],
      };
    }
  }

  private async emitConfigChanges(oldSnapshot: ConfigSnapshot, newSnapshot: ConfigSnapshot): Promise<void> {
    // Check Redis config changes
    if (JSON.stringify(oldSnapshot.redis) !== JSON.stringify(newSnapshot.redis)) {
      const changeEvent: ConfigChangeEvent = {
        section: 'redis',
        oldValue: oldSnapshot.redis,
        newValue: newSnapshot.redis,
        timestamp: new Date(),
      };
      
      this.eventEmitter.emit('config.changed', changeEvent);
      this.eventEmitter.emit('config.redis.changed', changeEvent);
      this.logger.log('Redis configuration changed');
    }

    // Check Queue config changes
    if (JSON.stringify(oldSnapshot.queue) !== JSON.stringify(newSnapshot.queue)) {
      const changeEvent: ConfigChangeEvent = {
        section: 'queue',
        oldValue: oldSnapshot.queue,
        newValue: newSnapshot.queue,
        timestamp: new Date(),
      };
      
      this.eventEmitter.emit('config.changed', changeEvent);
      this.eventEmitter.emit('config.queue.changed', changeEvent);
      this.logger.log('Queue configuration changed');
    }
  }

  private setupFileWatchers(): void {
    if (process.env.NODE_ENV === 'test') {
      // Skip file watching in test environment
      return;
    }

    this.configFiles.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const watcher = fs.watchFile(filePath, { interval: 5000 }, () => {
          this.logger.log(`Configuration file changed: ${filePath}`);
          this.reloadConfiguration();
        });
        
        this.fileWatchers.push(watcher);
        this.logger.log(`Watching configuration file: ${filePath}`);
      }
    });
  }

  async validateCurrentConfig(): Promise<ConfigValidationResult> {
    return this.configValidation.validateAllConfigs();
  }

  async updateRedisConfig(updates: Partial<RedisConfig>): Promise<ConfigValidationResult> {
    const currentConfig = this.getRedisConfig();
    const newConfig = { ...currentConfig, ...updates };
    
    const validation = this.configValidation.validateRedisConfig(newConfig);
    
    if (validation.isValid) {
      const oldSnapshot = { ...this.configSnapshot };
      this.configSnapshot.redis = newConfig;
      this.configSnapshot.timestamp = new Date();
      this.configSnapshot.version = this.generateVersion();
      
      await this.emitConfigChanges(oldSnapshot, this.configSnapshot);
      this.logger.log('Redis configuration updated programmatically');
    }
    
    return validation;
  }

  async updateQueueConfig(updates: Partial<QueueConfig>): Promise<ConfigValidationResult> {
    const currentConfig = this.getQueueConfig();
    const newConfig = { ...currentConfig, ...updates };
    
    const validation = this.configValidation.validateQueueConfig(newConfig);
    
    if (validation.isValid) {
      const oldSnapshot = { ...this.configSnapshot };
      this.configSnapshot.queue = newConfig;
      this.configSnapshot.timestamp = new Date();
      this.configSnapshot.version = this.generateVersion();
      
      await this.emitConfigChanges(oldSnapshot, this.configSnapshot);
      this.logger.log('Queue configuration updated programmatically');
    }
    
    return validation;
  }

  getConfigSummary(): any {
    return {
      version: this.configSnapshot.version,
      timestamp: this.configSnapshot.timestamp,
      redis: {
        host: this.configSnapshot.redis.host,
        port: this.configSnapshot.redis.port,
        db: this.configSnapshot.redis.db,
        hasPassword: !!this.configSnapshot.redis.password,
      },
      queue: {
        queueName: this.configSnapshot.queue.queueName,
        maxRetryAttempts: this.configSnapshot.queue.maxRetryAttempts,
        taskTimeoutMs: this.configSnapshot.queue.taskTimeoutMs,
        recoveryEnabled: this.configSnapshot.queue.recovery.enableAutoRecovery,
      },
    };
  }

  onModuleDestroy() {
    // Clean up file watchers
    this.fileWatchers.forEach(watcher => {
      if (typeof watcher.close === 'function') {
        watcher.close();
      }
    });
    this.fileWatchers = [];
    this.logger.log('Configuration manager destroyed');
  }
}
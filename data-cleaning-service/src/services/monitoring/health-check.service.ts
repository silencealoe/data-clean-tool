import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Connection } from 'typeorm';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  components: ComponentHealth[];
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  details?: any;
}

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  private redis: Redis;
  private readonly startTime = Date.now();

  constructor(
    private readonly configService: ConfigService,
    private readonly connection: Connection,
  ) {
    if (process.env.NODE_ENV !== 'test') {
      this.initializeRedis();
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
      enableOfflineQueue: true,
      lazyConnect: false,
    });
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const components = await Promise.all([
      this.checkRedisHealth(),
      this.checkDatabaseHealth(),
      this.checkQueueHealth(),
      this.checkMemoryHealth(),
      this.checkDiskHealth(),
    ]);

    const overallStatus = this.determineOverallStatus(components);
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      status: overallStatus,
      timestamp: new Date(),
      uptime,
      version: process.env.npm_package_version || '1.0.0',
      components,
    };
  }

  private async checkRedisHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // Test basic Redis operations
      const testKey = `health:check:${Date.now()}`;
      await this.redis.set(testKey, 'test', 'EX', 10);
      const result = await this.redis.get(testKey);
      await this.redis.del(testKey);

      if (result !== 'test') {
        throw new Error('Redis read/write test failed');
      }

      // Get Redis info
      const info = await this.redis.info('server');
      const versionMatch = info.match(/redis_version:([^\r\n]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      const responseTime = Date.now() - startTime;

      return {
        name: 'redis',
        status: responseTime > 1000 ? 'degraded' : 'healthy',
        responseTime,
        details: {
          version,
          connected: true,
        },
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: {
          connected: false,
        },
      };
    }
  }

  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // Test database connection
      const result = await this.connection.query('SELECT 1 as test');

      if (!result || result[0]?.test !== 1) {
        throw new Error('Database query test failed');
      }

      const responseTime = Date.now() - startTime;

      return {
        name: 'database',
        status: responseTime > 2000 ? 'degraded' : 'healthy',
        responseTime,
        details: {
          connected: this.connection.isConnected,
          driver: this.connection.options.type,
        },
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: {
          connected: this.connection.isConnected,
        },
      };
    }
  }

  private async checkQueueHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const queueName = this.configService.get('queue.queueName');
      const queueKey = `queue:${queueName}`;

      // Check queue accessibility
      const queueLength = await this.redis.llen(queueKey);

      // Check if there are any stuck tasks
      const processingTasks = await this.redis.hlen('task:status:*');

      const responseTime = Date.now() - startTime;

      // Determine status based on queue conditions
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (queueLength > 1000) {
        status = 'degraded'; // Queue is getting large
      }

      if (responseTime > 1000) {
        status = 'degraded'; // Slow response
      }

      return {
        name: 'queue',
        status,
        responseTime,
        details: {
          queueLength,
          processingTasks,
          queueName,
        },
      };
    } catch (error) {
      return {
        name: 'queue',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async checkMemoryHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
      const usedMemory = memoryUsage.heapUsed;
      const memoryUtilization = (usedMemory / totalMemory) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (memoryUtilization > 90) {
        status = 'unhealthy';
      } else if (memoryUtilization > 75) {
        status = 'degraded';
      }

      return {
        name: 'memory',
        status,
        responseTime: Date.now() - startTime,
        details: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
          utilization: Math.round(memoryUtilization),
        },
      };
    } catch (error) {
      return {
        name: 'memory',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async checkDiskHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const fs = require('fs');
      const path = require('path');

      // Check if we can write to temp directory
      const tempDir = path.join(process.cwd(), 'temp');
      const testFile = path.join(tempDir, `health-check-${Date.now()}.tmp`);

      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Test write operation
      fs.writeFileSync(testFile, 'health check test');
      const content = fs.readFileSync(testFile, 'utf8');
      fs.unlinkSync(testFile);

      if (content !== 'health check test') {
        throw new Error('Disk read/write test failed');
      }

      // Get disk space info (simplified)
      const stats = fs.statSync(process.cwd());

      return {
        name: 'disk',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          writable: true,
          tempDirectory: tempDir,
        },
      };
    } catch (error) {
      return {
        name: 'disk',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: {
          writable: false,
        },
      };
    }
  }

  private determineOverallStatus(components: ComponentHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyComponents = components.filter(c => c.status === 'unhealthy');
    const degradedComponents = components.filter(c => c.status === 'degraded');

    if (unhealthyComponents.length > 0) {
      return 'unhealthy';
    }

    if (degradedComponents.length > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  async getDetailedHealthReport(): Promise<any> {
    const healthStatus = await this.getHealthStatus();

    // Add additional system information
    const additionalInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      environment: process.env.NODE_ENV || 'development',
      processId: process.pid,
      parentProcessId: process.ppid,
      workingDirectory: process.cwd(),
    };

    return {
      ...healthStatus,
      system: additionalInfo,
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      const status = await this.getHealthStatus();
      return status.status === 'healthy';
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  async waitForHealthy(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (await this.isHealthy()) {
        return true;
      }

      // Wait 1 second before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
  }
}
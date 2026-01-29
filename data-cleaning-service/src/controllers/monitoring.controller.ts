import { Controller, Get, Post, HttpStatus, HttpCode, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MetricsService } from '../services/monitoring/metrics.service';
import { HealthCheckService } from '../services/monitoring/health-check.service';
import { ConfigManagerService } from '../config/config-manager.service';

@ApiTags('monitoring')
@Controller('api/monitoring')
export class MonitoringController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly healthCheckService: HealthCheckService,
    private readonly configManager: ConfigManagerService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: '获取系统健康状态' })
  @ApiResponse({ status: 200, description: '健康检查成功' })
  @ApiResponse({ status: 503, description: '系统不健康' })
  async getHealth() {
    const healthStatus = await this.healthCheckService.getHealthStatus();
    
    // Return appropriate HTTP status based on health
    const httpStatus = healthStatus.status === 'healthy' ? HttpStatus.OK : 
                      healthStatus.status === 'degraded' ? HttpStatus.OK : 
                      HttpStatus.SERVICE_UNAVAILABLE;

    return {
      status: healthStatus.status,
      timestamp: healthStatus.timestamp,
      uptime: healthStatus.uptime,
      version: healthStatus.version,
      components: healthStatus.components,
      httpStatus,
    };
  }

  @Get('health/detailed')
  @ApiOperation({ summary: '获取详细健康报告' })
  @ApiResponse({ status: 200, description: '详细健康报告' })
  async getDetailedHealth() {
    return await this.healthCheckService.getDetailedHealthReport();
  }

  @Get('health/ready')
  @ApiOperation({ summary: '就绪检查 - 用于Kubernetes readiness probe' })
  @ApiResponse({ status: 200, description: '服务就绪' })
  @ApiResponse({ status: 503, description: '服务未就绪' })
  @HttpCode(HttpStatus.OK)
  async getReadiness() {
    const isHealthy = await this.healthCheckService.isHealthy();
    
    if (!isHealthy) {
      throw new Error('Service not ready');
    }
    
    return { status: 'ready', timestamp: new Date() };
  }

  @Get('health/live')
  @ApiOperation({ summary: '存活检查 - 用于Kubernetes liveness probe' })
  @ApiResponse({ status: 200, description: '服务存活' })
  @HttpCode(HttpStatus.OK)
  async getLiveness() {
    // Simple liveness check - just return OK if the service is running
    return { status: 'alive', timestamp: new Date(), uptime: process.uptime() };
  }

  @Get('metrics')
  @ApiOperation({ summary: '获取系统指标' })
  @ApiResponse({ status: 200, description: '系统指标数据' })
  async getMetrics() {
    return await this.metricsService.getMetricsSummary();
  }

  @Get('metrics/queue')
  @ApiOperation({ summary: '获取队列指标' })
  @ApiResponse({ status: 200, description: '队列指标数据' })
  async getQueueMetrics() {
    return await this.metricsService.getQueueMetrics();
  }

  @Get('metrics/system')
  @ApiOperation({ summary: '获取系统资源指标' })
  @ApiResponse({ status: 200, description: '系统资源指标' })
  async getSystemMetrics() {
    return await this.metricsService.getSystemMetrics();
  }

  @Get('metrics/performance')
  @ApiOperation({ summary: '获取性能指标' })
  @ApiResponse({ status: 200, description: '性能指标数据' })
  async getPerformanceMetrics() {
    return await this.metricsService.getPerformanceMetrics();
  }

  @Post('metrics/reset')
  @ApiOperation({ summary: '重置指标数据' })
  @ApiResponse({ status: 200, description: '指标重置成功' })
  @HttpCode(HttpStatus.OK)
  async resetMetrics() {
    await this.metricsService.resetMetrics();
    return { message: 'Metrics reset successfully', timestamp: new Date() };
  }

  @Get('config')
  @ApiOperation({ summary: '获取配置摘要' })
  @ApiResponse({ status: 200, description: '配置信息' })
  async getConfig() {
    return this.configManager.getConfigSummary();
  }

  @Get('config/validate')
  @ApiOperation({ summary: '验证当前配置' })
  @ApiResponse({ status: 200, description: '配置验证结果' })
  async validateConfig() {
    const validation = await this.configManager.validateCurrentConfig();
    return {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      timestamp: new Date(),
    };
  }

  @Post('config/reload')
  @ApiOperation({ summary: '重新加载配置' })
  @ApiResponse({ status: 200, description: '配置重载成功' })
  @ApiResponse({ status: 400, description: '配置重载失败' })
  @HttpCode(HttpStatus.OK)
  async reloadConfig() {
    const result = await this.configManager.reloadConfiguration();
    
    if (!result.isValid) {
      return {
        success: false,
        message: 'Configuration reload failed',
        errors: result.errors,
        warnings: result.warnings,
        timestamp: new Date(),
      };
    }

    return {
      success: true,
      message: 'Configuration reloaded successfully',
      warnings: result.warnings,
      timestamp: new Date(),
    };
  }

  @Get('status')
  @ApiOperation({ summary: '获取服务状态概览' })
  @ApiResponse({ status: 200, description: '服务状态概览' })
  async getStatus() {
    const [health, metrics, config] = await Promise.all([
      this.healthCheckService.getHealthStatus(),
      this.metricsService.getQueueMetrics(),
      this.configManager.getConfigSummary(),
    ]);

    return {
      service: {
        name: 'data-cleaning-service',
        version: config.version,
        environment: process.env.NODE_ENV || 'development',
        uptime: health.uptime,
      },
      health: {
        status: health.status,
        components: health.components.map(c => ({
          name: c.name,
          status: c.status,
          responseTime: c.responseTime,
        })),
      },
      queue: {
        length: metrics.queueLength,
        activeWorkers: metrics.activeWorkers,
        throughput: metrics.throughputPerMinute,
        errorRate: metrics.errorRate,
      },
      config: {
        version: config.version,
        lastUpdated: config.timestamp,
      },
      timestamp: new Date(),
    };
  }

  @Get('prometheus')
  @ApiOperation({ summary: '获取Prometheus格式的指标' })
  @ApiResponse({ status: 200, description: 'Prometheus指标格式' })
  @ApiQuery({ name: 'format', required: false, description: '输出格式 (prometheus|json)' })
  async getPrometheusMetrics(@Query('format') format: string = 'prometheus') {
    const metrics = await this.metricsService.getMetricsSummary();
    
    if (format === 'json') {
      return metrics;
    }

    // Convert to Prometheus format
    const prometheusMetrics = this.convertToPrometheusFormat(metrics);
    
    return prometheusMetrics;
  }

  private convertToPrometheusFormat(metrics: any): string {
    const lines: string[] = [];
    const timestamp = Date.now();

    // Queue metrics
    lines.push(`# HELP queue_length Current number of tasks in queue`);
    lines.push(`# TYPE queue_length gauge`);
    lines.push(`queue_length ${metrics.queue.queueLength} ${timestamp}`);

    lines.push(`# HELP queue_total_enqueued Total number of tasks enqueued`);
    lines.push(`# TYPE queue_total_enqueued counter`);
    lines.push(`queue_total_enqueued ${metrics.queue.totalEnqueued} ${timestamp}`);

    lines.push(`# HELP queue_total_processed Total number of tasks processed`);
    lines.push(`# TYPE queue_total_processed counter`);
    lines.push(`queue_total_processed ${metrics.queue.totalProcessed} ${timestamp}`);

    lines.push(`# HELP queue_total_failed Total number of tasks failed`);
    lines.push(`# TYPE queue_total_failed counter`);
    lines.push(`queue_total_failed ${metrics.queue.totalFailed} ${timestamp}`);

    lines.push(`# HELP queue_active_workers Number of active workers`);
    lines.push(`# TYPE queue_active_workers gauge`);
    lines.push(`queue_active_workers ${metrics.queue.activeWorkers} ${timestamp}`);

    lines.push(`# HELP queue_throughput_per_minute Tasks processed per minute`);
    lines.push(`# TYPE queue_throughput_per_minute gauge`);
    lines.push(`queue_throughput_per_minute ${metrics.queue.throughputPerMinute} ${timestamp}`);

    lines.push(`# HELP queue_error_rate Error rate percentage`);
    lines.push(`# TYPE queue_error_rate gauge`);
    lines.push(`queue_error_rate ${metrics.queue.errorRate} ${timestamp}`);

    lines.push(`# HELP queue_average_processing_time Average processing time in milliseconds`);
    lines.push(`# TYPE queue_average_processing_time gauge`);
    lines.push(`queue_average_processing_time ${metrics.queue.averageProcessingTime} ${timestamp}`);

    // System metrics
    lines.push(`# HELP system_uptime System uptime in seconds`);
    lines.push(`# TYPE system_uptime counter`);
    lines.push(`system_uptime ${metrics.system.uptime} ${timestamp}`);

    lines.push(`# HELP system_memory_heap_used Heap memory used in bytes`);
    lines.push(`# TYPE system_memory_heap_used gauge`);
    lines.push(`system_memory_heap_used ${metrics.system.memoryUsage.heapUsed} ${timestamp}`);

    lines.push(`# HELP system_memory_heap_total Total heap memory in bytes`);
    lines.push(`# TYPE system_memory_heap_total gauge`);
    lines.push(`system_memory_heap_total ${metrics.system.memoryUsage.heapTotal} ${timestamp}`);

    lines.push(`# HELP system_cpu_usage CPU usage percentage`);
    lines.push(`# TYPE system_cpu_usage gauge`);
    lines.push(`system_cpu_usage ${metrics.system.cpuUsage} ${timestamp}`);

    lines.push(`# HELP redis_connections Number of Redis connections`);
    lines.push(`# TYPE redis_connections gauge`);
    lines.push(`redis_connections ${metrics.system.redisConnections} ${timestamp}`);

    lines.push(`# HELP redis_memory_usage Redis memory usage in bytes`);
    lines.push(`# TYPE redis_memory_usage gauge`);
    lines.push(`redis_memory_usage ${metrics.system.redisMemoryUsage} ${timestamp}`);

    return lines.join('\n') + '\n';
  }
}
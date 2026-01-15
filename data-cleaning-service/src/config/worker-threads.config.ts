/**
 * Worker Threads 配置管理
 * 
 * 从环境变量读取配置，设置默认值，并进行验证
 */

import { WorkerThreadsConfig } from '../services/parallel/types';

/**
 * 从环境变量读取布尔值
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * 从环境变量读取数字
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 获取 Worker Threads 配置
 */
export function getWorkerThreadsConfig(): WorkerThreadsConfig {
  const config: WorkerThreadsConfig = {
    // 并行处理设置
    enableParallelProcessing: getEnvBoolean('ENABLE_PARALLEL_PROCESSING', true),
    workerCount: getEnvNumber('WORKER_COUNT', 4),
    parallelBatchSize: getEnvNumber('PARALLEL_BATCH_SIZE', 10000),
    
    // 资源限制
    maxMemoryMB: getEnvNumber('MAX_MEMORY_MB', 1800),
    workerTimeoutMs: getEnvNumber('WORKER_TIMEOUT_MS', 300000), // 5 分钟
    
    // 性能调优
    minRecordsForParallel: getEnvNumber('MIN_RECORDS_FOR_PARALLEL', 1000),
    chunkOverlapRows: getEnvNumber('CHUNK_OVERLAP_ROWS', 0),
    
    // 监控
    enableProgressTracking: getEnvBoolean('ENABLE_PROGRESS_TRACKING', true),
    progressUpdateInterval: getEnvNumber('PROGRESS_UPDATE_INTERVAL_MS', 1000),
    enablePerformanceMonitoring: getEnvBoolean('ENABLE_PERFORMANCE_MONITORING', true),
    performanceSampleInterval: getEnvNumber('PERFORMANCE_SAMPLE_INTERVAL_MS', 1000),
  };
  
  // 验证配置
  validateConfig(config);
  
  return config;
}

/**
 * 验证配置
 */
function validateConfig(config: WorkerThreadsConfig): void {
  const errors: string[] = [];
  
  // 验证工作线程数量
  if (config.workerCount < 1) {
    errors.push('WORKER_COUNT 必须 >= 1');
  }
  if (config.workerCount > 32) {
    errors.push('WORKER_COUNT 不应超过 32（建议 2-8）');
  }
  
  // 验证批处理大小
  if (config.parallelBatchSize < 100) {
    errors.push('PARALLEL_BATCH_SIZE 必须 >= 100');
  }
  if (config.parallelBatchSize > 100000) {
    errors.push('PARALLEL_BATCH_SIZE 不应超过 100000');
  }
  
  // 验证内存限制
  if (config.maxMemoryMB < 512) {
    errors.push('MAX_MEMORY_MB 必须 >= 512');
  }
  if (config.maxMemoryMB > 8192) {
    errors.push('MAX_MEMORY_MB 不应超过 8192');
  }
  
  // 验证超时时间
  if (config.workerTimeoutMs < 10000) {
    errors.push('WORKER_TIMEOUT_MS 必须 >= 10000 (10秒)');
  }
  if (config.workerTimeoutMs > 3600000) {
    errors.push('WORKER_TIMEOUT_MS 不应超过 3600000 (1小时)');
  }
  
  // 验证最小并行记录数
  if (config.minRecordsForParallel < 100) {
    errors.push('MIN_RECORDS_FOR_PARALLEL 必须 >= 100');
  }
  
  // 验证采样间隔
  if (config.progressUpdateInterval < 100) {
    errors.push('PROGRESS_UPDATE_INTERVAL_MS 必须 >= 100');
  }
  if (config.performanceSampleInterval < 100) {
    errors.push('PERFORMANCE_SAMPLE_INTERVAL_MS 必须 >= 100');
  }
  
  // 如果有错误，抛出异常
  if (errors.length > 0) {
    throw new Error(
      `Worker Threads 配置验证失败:\n${errors.map(e => `  - ${e}`).join('\n')}`,
    );
  }
}

/**
 * 获取配置摘要（用于日志）
 */
export function getConfigSummary(config: WorkerThreadsConfig): string {
  return [
    '=== Worker Threads 配置 ===',
    `并行处理: ${config.enableParallelProcessing ? '启用' : '禁用'}`,
    `工作线程数: ${config.workerCount}`,
    `批处理大小: ${config.parallelBatchSize}`,
    `最大内存: ${config.maxMemoryMB} MB`,
    `工作线程超时: ${config.workerTimeoutMs / 1000} 秒`,
    `最小并行记录数: ${config.minRecordsForParallel}`,
    `进度跟踪: ${config.enableProgressTracking ? '启用' : '禁用'}`,
    `性能监控: ${config.enablePerformanceMonitoring ? '启用' : '禁用'}`,
    '===========================',
  ].join('\n');
}

/**
 * 检查是否应该使用并行处理
 */
export function shouldUseParallelProcessing(
  config: WorkerThreadsConfig,
  recordCount: number,
): boolean {
  // 如果并行处理被禁用，返回 false
  if (!config.enableParallelProcessing) {
    return false;
  }
  
  // 如果记录数小于最小阈值，返回 false
  if (recordCount < config.minRecordsForParallel) {
    return false;
  }
  
  return true;
}

/**
 * 获取推荐的工作线程数量
 */
export function getRecommendedWorkerCount(
  config: WorkerThreadsConfig,
  recordCount: number,
): number {
  // 如果记录数很少，减少工作线程数
  if (recordCount < 10000) {
    return Math.min(2, config.workerCount);
  }
  
  if (recordCount < 100000) {
    return Math.min(4, config.workerCount);
  }
  
  // 对于大文件，使用配置的工作线程数
  return config.workerCount;
}

// 导出默认配置实例
export const workerThreadsConfig = getWorkerThreadsConfig();

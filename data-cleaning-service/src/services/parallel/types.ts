/**
 * Worker Threads 并行处理类型定义
 * 
 * 本文件定义了并行处理系统中使用的所有接口和类型
 */

// ==================== 配置类型 ====================

/**
 * 并行处理配置
 */
export interface ProcessingConfig {
  /** 工作线程数量（默认：4） */
  workerCount: number;
  
  /** 每批记录数（默认：10000） */
  batchSize: number;
  
  /** 工作线程超时时间（毫秒，默认：300000 = 5分钟） */
  timeoutMs: number;
  
  /** 启用进度跟踪 */
  enableProgressTracking: boolean;
  
  /** 启用性能监控 */
  enablePerformanceMonitoring?: boolean;
  
  /** 性能采样间隔（毫秒，默认：1000） */
  performanceSampleInterval?: number;
}

/**
 * Worker Threads 完整配置
 */
export interface WorkerThreadsConfig {
  // 并行处理设置
  enableParallelProcessing: boolean;  // 默认：true
  workerCount: number;                // 默认：4
  parallelBatchSize: number;          // 默认：10000
  
  // 资源限制
  maxMemoryMB: number;                // 默认：1800
  workerTimeoutMs: number;            // 默认：300000 (5 分钟)
  
  // 性能调优
  minRecordsForParallel: number;      // 默认：1000
  chunkOverlapRows: number;           // 默认：0
  
  // 监控
  enableProgressTracking: boolean;    // 默认：true
  progressUpdateInterval: number;     // 默认：1000 (毫秒)
  enablePerformanceMonitoring: boolean; // 默认：true
  performanceSampleInterval: number;  // 默认：1000 (毫秒)
}

// ==================== 任务和结果类型 ====================

/**
 * 工作线程任务
 */
export interface WorkerTask {
  /** CSV 文件路径 */
  filePath: string;
  
  /** 起始行索引 */
  startRow: number;
  
  /** 要处理的行数 */
  rowCount: number;
  
  /** 批处理大小 */
  batchSize: number;
  
  /** 工作线程 ID */
  workerId: number;
  
  /** 任务 ID */
  jobId: string;
  
  /** 超时时间（毫秒，可选） */
  timeoutMs?: number;
  
  /** 数据库配置 */
  dbConfig?: DatabaseConfig;
}

/**
 * 工作线程结果
 */
export interface WorkerResult {
  /** 工作线程 ID */
  workerId: number;
  
  /** 成功记录数 */
  successCount: number;
  
  /** 错误记录数 */
  errorCount: number;
  
  /** 处理时间（毫秒） */
  processingTimeMs: number;
  
  /** 错误详情（如果有） */
  errors?: WorkerError[];
}

/**
 * 工作线程错误
 */
export interface WorkerError {
  /** 错误消息 */
  message: string;
  
  /** 错误堆栈 */
  stack?: string;
  
  /** 错误发生的行号 */
  rowNumber?: number;
}

/**
 * 处理结果
 */
export interface ProcessingResult {
  /** 总记录数 */
  totalRecords: number;
  
  /** 成功清洗的记录数 */
  successCount: number;
  
  /** 错误记录数 */
  errorCount: number;
  
  /** 处理时间（毫秒） */
  processingTimeMs: number;
  
  /** 各工作线程结果 */
  workerResults: WorkerResult[];
  
  /** 性能摘要（可选） */
  performanceSummary?: PerformanceSummary;
}

// ==================== 数据块类型 ====================

/**
 * 数据块描述符
 */
export interface ChunkDescriptor {
  /** 数据块 ID */
  chunkId: number;
  
  /** 起始行（包含） */
  startRow: number;
  
  /** 结束行（不包含） */
  endRow: number;
  
  /** 行数 */
  rowCount: number;
  
  /** 估计大小（字节） */
  estimatedSizeBytes: number;
}

// ==================== 消息类型 ====================

/**
 * 主线程到工作线程的消息类型
 */
export type MainToWorkerMessage = StartMessage | TerminateMessage;

/**
 * 工作线程到主线程的消息类型
 */
export type WorkerToMainMessage = 
  | ProgressMessage 
  | CompleteMessage 
  | ErrorMessage
  | MetricsMessage;

/**
 * 启动消息
 */
export interface StartMessage {
  type: 'START';
  payload: WorkerTask;
}

/**
 * 终止消息
 */
export interface TerminateMessage {
  type: 'TERMINATE';
}

/**
 * 进度消息
 */
export interface ProgressMessage {
  type: 'PROGRESS';
  payload: {
    workerId: number;
    processedRows: number;
    totalRows: number;
    percentage: number;
  };
}

/**
 * 完成消息
 */
export interface CompleteMessage {
  type: 'COMPLETE';
  payload: WorkerResult;
}

/**
 * 错误消息
 */
export interface ErrorMessage {
  type: 'ERROR';
  payload: {
    workerId: number;
    error: string;
    stack?: string;
  };
}

/**
 * 性能指标消息
 */
export interface MetricsMessage {
  type: 'METRICS';
  payload: WorkerMetrics;
}

// ==================== 工作线程池类型 ====================

/**
 * 工作线程池状态
 */
export interface PoolStatus {
  /** 总工作线程数 */
  totalWorkers: number;
  
  /** 活跃工作线程数 */
  activeWorkers: number;
  
  /** 空闲工作线程数 */
  idleWorkers: number;
  
  /** 失败工作线程数 */
  failedWorkers: number;
}

// ==================== 性能监控类型 ====================

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 时间戳 */
  timestamp: number;
  
  /** CPU 使用情况 */
  cpuUsage: CPUMetrics;
  
  /** 内存使用情况 */
  memoryUsage: MemoryMetrics;
  
  /** 各工作线程指标 */
  workerMetrics: WorkerMetrics[];
  
  /** 当前吞吐量（行/秒） */
  throughput: number;
}

/**
 * CPU 指标
 */
export interface CPUMetrics {
  /** 总体 CPU 使用率 (0-100) */
  overall: number;
  
  /** 每个核心使用率 */
  perCore: number[];
  
  /** 用户态 CPU 时间百分比 */
  user: number;
  
  /** 系统态 CPU 时间百分比 */
  system: number;
}

/**
 * 内存指标
 */
export interface MemoryMetrics {
  /** 已使用堆内存（字节） */
  heapUsed: number;
  
  /** 总堆内存（字节） */
  heapTotal: number;
  
  /** 外部内存（字节） */
  external: number;
  
  /** 常驻集大小（字节） */
  rss: number;
  
  /** 已使用堆内存（MB） */
  heapUsedMB: number;
  
  /** 总堆内存（MB） */
  heapTotalMB: number;
  
  /** 常驻集大小（MB） */
  rssMB: number;
  
  /** 内存使用百分比 */
  usagePercentage: number;
}

/**
 * 工作线程指标
 */
export interface WorkerMetrics {
  /** 工作线程 ID */
  workerId: number;
  
  /** CPU 使用率 */
  cpuUsage: number;
  
  /** 内存使用（MB） */
  memoryUsage: number;
  
  /** 已处理行数 */
  processedRows: number;
  
  /** 吞吐量（行/秒） */
  throughput: number;
  
  /** 状态 */
  status: 'idle' | 'running' | 'completed' | 'failed';
  
  /** 时间戳（可选） */
  timestamp?: number;
}

/**
 * 性能报告
 */
export interface PerformanceReport {
  /** 任务 ID */
  jobId: string;
  
  /** 总处理时间（毫秒） */
  duration: number;
  
  // CPU 指标
  /** 平均 CPU 使用率 */
  avgCpuUsage: number;
  
  /** 峰值 CPU 使用率 */
  peakCpuUsage: number;
  
  /** CPU 利用率（相对于可用核心） */
  cpuUtilization: number;
  
  // 内存指标
  /** 平均内存使用（MB） */
  avgMemoryUsage: number;
  
  /** 峰值内存使用（MB） */
  peakMemoryUsage: number;
  
  /** 内存利用率百分比 */
  memoryUtilization: number;
  
  // 吞吐量指标
  /** 总行数 */
  totalRows: number;
  
  /** 平均吞吐量（行/秒） */
  avgThroughput: number;
  
  /** 峰值吞吐量（行/秒） */
  peakThroughput: number;
  
  // 工作线程指标
  /** 各工作线程报告 */
  workerReports: WorkerReport[];
  
  // 时间线数据（用于图表）
  /** 性能快照时间线 */
  timeline: PerformanceSnapshot[];
}

/**
 * 工作线程报告
 */
export interface WorkerReport {
  /** 工作线程 ID */
  workerId: number;
  
  /** 平均 CPU 使用率 */
  avgCpuUsage: number;
  
  /** 峰值 CPU 使用率 */
  peakCpuUsage: number;
  
  /** 平均内存使用（MB） */
  avgMemoryUsage: number;
  
  /** 峰值内存使用（MB） */
  peakMemoryUsage: number;
  
  /** 已处理行数 */
  processedRows: number;
  
  /** 平均吞吐量（行/秒） */
  avgThroughput: number;
  
  /** 处理时间（毫秒） */
  duration: number;
}

/**
 * 性能快照
 */
export interface PerformanceSnapshot {
  /** 时间戳 */
  timestamp: number;
  
  /** CPU 使用率 */
  cpuUsage: number;
  
  /** 内存使用（MB） */
  memoryUsage: number;
  
  /** 已处理行数 */
  processedRows: number;
  
  /** 吞吐量（行/秒） */
  throughput: number;
}

/**
 * 性能摘要（包含在处理结果中）
 */
export interface PerformanceSummary {
  /** 平均 CPU 使用率 */
  avgCpuUsage: number;
  
  /** 峰值 CPU 使用率 */
  peakCpuUsage: number;
  
  /** 平均内存使用（MB） */
  avgMemoryUsage: number;
  
  /** 峰值内存使用（MB） */
  peakMemoryUsage: number;
  
  /** 平均吞吐量（行/秒） */
  avgThroughput: number;
  
  /** 峰值吞吐量（行/秒） */
  peakThroughput: number;
}

// ==================== 数据库配置类型 ====================

/**
 * 数据库配置
 */
export interface DatabaseConfig {
  /** 数据库主机 */
  host: string;
  
  /** 数据库端口 */
  port: number;
  
  /** 数据库用户名 */
  username: string;
  
  /** 数据库密码 */
  password: string;
  
  /** 数据库名称 */
  database: string;
}

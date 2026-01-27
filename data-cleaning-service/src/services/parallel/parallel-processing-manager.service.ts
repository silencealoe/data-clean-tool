/**
 * ParallelProcessingManager Service
 * 
 * 主协调器，管理整个并行处理流程
 * 
 * 职责：
 * - 初始化工作线程池
 * - 将 CSV 文件分割成数据块
 * - 分配数据块给工作线程
 * - 收集和聚合结果
 * - 管理进度跟踪
 * - 监控性能指标
 * - 处理错误和超时
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChunkSplitterService } from './chunk-splitter.service';
import { WorkerPoolService } from './worker-pool.service';
import { ResultCollectorService } from './result-collector.service';
import { ProgressTrackerService } from './progress-tracker.service';
import { PerformanceMonitorService } from './performance-monitor.service';
import { ResourceMonitorService } from './resource-monitor.service';
import {
  ProcessingConfig,
  ProcessingResult,
  WorkerTask,
  WorkerToMainMessage,
  PerformanceMetrics,
} from './types';

@Injectable()
export class ParallelProcessingManagerService {
  private readonly logger = new Logger(ParallelProcessingManagerService.name);

  // 组件依赖
  private readonly chunkSplitter: ChunkSplitterService;
  private readonly workerPool: WorkerPoolService;
  private readonly resultCollector: ResultCollectorService;
  private readonly progressTracker: ProgressTrackerService;
  private readonly performanceMonitor: PerformanceMonitorService;
  private readonly resourceMonitor: ResourceMonitorService;

  // 处理状态
  private isProcessing: boolean = false;
  private currentJobId: string = '';

  constructor() {
    this.chunkSplitter = new ChunkSplitterService();
    this.workerPool = new WorkerPoolService();
    this.resultCollector = new ResultCollectorService();
    this.progressTracker = new ProgressTrackerService();
    this.performanceMonitor = new PerformanceMonitorService();
    this.resourceMonitor = new ResourceMonitorService();
  }

  /**
   * 使用并行工作线程处理 CSV 文件
   * @param filePath - CSV 文件路径
   * @param jobId - 任务 ID
   * @param config - 处理配置
   * @returns 处理结果
   */
  async processFile(
    filePath: string,
    jobId: string,
    config: ProcessingConfig,
  ): Promise<ProcessingResult> {
    if (this.isProcessing) {
      throw new Error('并行处理管理器已在运行中');
    }

    this.isProcessing = true;
    this.currentJobId = jobId;

    const startTime = Date.now();

    this.logger.log(
      `开始并行处理: jobId=${jobId}, 文件=${filePath}, 工作线程数=${config.workerCount}`,
    );

    try {
      // 1. 分割文件成数据块
      this.logger.log('步骤 1/5: 分割文件...');
      const chunks = await this.chunkSplitter.splitFile(filePath, config.workerCount);
      const totalRows = chunks.reduce((sum, chunk) => sum + chunk.rowCount, 0);

      this.logger.log(
        `文件已分割: 总行数=${totalRows}, 数据块数=${chunks.length}`,
      );

      // 2. 初始化所有组件
      this.logger.log('步骤 2/5: 初始化组件...');
      await this.initializeComponents(jobId, totalRows, config);

      // 3. 创建工作线程任务
      this.logger.log('步骤 3/5: 创建工作线程任务...');
      const tasks: WorkerTask[] = chunks.map((chunk, index) => ({
        filePath,
        startRow: chunk.startRow,
        rowCount: chunk.rowCount,
        batchSize: config.batchSize,
        workerId: index,
        jobId,
        timeoutMs: config.timeoutMs,
      }));

      // 4. 并行执行所有任务
      this.logger.log('步骤 4/5: 执行并行处理...');
      await this.executeTasksInParallel(tasks, config.timeoutMs);

      // 5. 收集结果并生成报告
      this.logger.log('步骤 5/5: 收集结果...');
      const result = this.collectFinalResult();

      const processingTimeMs = Date.now() - startTime;

      this.logger.log(
        `并行处理完成: 总记录=${result.totalRecords}, 成功=${result.successCount}, 错误=${result.errorCount}, 耗时=${processingTimeMs}ms`,
      );

      return result;

    } catch (error) {
      this.logger.error(`并行处理失败: ${error.message}`, error.stack);

      // 尝试收集部分结果
      const partialResult = this.collectPartialResult();

      throw new Error(
        `并行处理失败: ${error.message}. 已处理 ${partialResult.successCount + partialResult.errorCount}/${partialResult.totalRecords} 行`,
      );

    } finally {
      // 清理资源
      await this.cleanup();
      this.isProcessing = false;
    }
  }

  /**
   * 初始化所有组件
   */
  private async initializeComponents(
    jobId: string,
    totalRows: number,
    config: ProcessingConfig,
  ): Promise<void> {
    // 配置并启动资源监控
    this.resourceMonitor.configureLimits({
      maxMemoryMB: 1800, // 默认最大内存 1800MB
      maxCpuUsage: 95,   // 默认最大 CPU 95%
      memoryWarningThresholdMB: 1500, // 警告阈值 1500MB
    });
    this.resourceMonitor.startMonitoring(1000); // 每秒检查一次

    // 初始化工作线程池
    await this.workerPool.initialize(config.workerCount);

    // 设置worker pool的消息处理回调
    this.workerPool.setMessageHandler((message) => {
      this.handleWorkerMessage(message);
    });

    // 初始化结果收集器
    this.resultCollector.initialize(config.workerCount, totalRows);

    // 初始化进度跟踪器
    if (config.enableProgressTracking) {
      this.progressTracker.initialize(totalRows, config.workerCount);
    }

    // 启动性能监控
    if (config.enablePerformanceMonitoring) {
      this.performanceMonitor.startMonitoring(
        jobId,
        config.performanceSampleInterval || 1000,
      );
    }

    this.logger.log('所有组件已初始化');
  }

  /**
   * 并行执行所有任务
   */
  private async executeTasksInParallel(
    tasks: WorkerTask[],
    timeoutMs: number,
  ): Promise<void> {
    const taskPromises: Promise<void>[] = [];

    // 逐个启动任务，检查资源限制
    for (const task of tasks) {
      // 检查是否应该暂停工作线程创建
      if (this.resourceMonitor.shouldPauseWorkerCreation()) {
        this.logger.warn(
          `资源使用过高，暂停创建 Worker ${task.workerId}，等待内存释放...`,
        );

        // 等待内存释放（最多 30 秒）
        const released = await this.resourceMonitor.waitForMemoryRelease(30000);

        if (!released) {
          this.logger.error(
            `等待内存释放超时，无法创建 Worker ${task.workerId}`,
          );
          throw new Error('资源不足：内存使用持续超限，无法继续创建工作线程');
        }

        this.logger.log('内存已释放，继续创建工作线程');
      }

      // 记录当前资源使用情况
      const resourceUsage = this.resourceMonitor.getCurrentUsage();
      if (resourceUsage) {
        this.logger.debug(
          `创建 Worker ${task.workerId} 前资源状态: ` +
          `内存=${resourceUsage.memoryUsageMB.toFixed(1)}MB, ` +
          `CPU=${resourceUsage.cpuUsage.toFixed(1)}%`,
        );
      }

      // 启动任务
      taskPromises.push(this.executeTaskWithMonitoring(task, timeoutMs));
    }

    // 等待所有任务完成（或超时）
    const results = await Promise.allSettled(taskPromises);

    // 检查是否有任务失败
    const failedTasks = results.filter(r => r.status === 'rejected');

    if (failedTasks.length > 0) {
      this.logger.warn(
        `${failedTasks.length}/${tasks.length} 个工作线程任务失败`,
      );

      // 记录失败详情
      failedTasks.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.logger.error(
            `任务 ${index} 失败: ${result.reason}`,
          );
        }
      });

      // 如果所有任务都失败，抛出错误
      if (failedTasks.length === tasks.length) {
        throw new Error('所有工作线程任务都失败了');
      }
    }
  }

  /**
   * 执行单个任务并监控
   */
  private async executeTaskWithMonitoring(
    task: WorkerTask,
    timeoutMs: number,
  ): Promise<void> {
    this.logger.log(
      `启动 Worker ${task.workerId}: 行 ${task.startRow}-${task.startRow + task.rowCount - 1}`,
    );

    try {
      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Worker ${task.workerId} 超时 (${timeoutMs}ms)`));
        }, timeoutMs);
      });

      // 执行任务
      const taskPromise = this.workerPool.executeTask(task);

      // 竞速：任务完成 vs 超时
      const result = await Promise.race([taskPromise, timeoutPromise]);

      // 记录结果
      this.resultCollector.addResult(result);

      this.logger.log(
        `Worker ${task.workerId} 完成: 成功=${result.successCount}, 错误=${result.errorCount}, 耗时=${result.processingTimeMs}ms`,
      );

    } catch (error) {
      this.logger.error(
        `Worker ${task.workerId} 失败: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 收集最终结果
   */
  private collectFinalResult(): ProcessingResult {
    // 获取聚合结果
    const result = this.resultCollector.getFinalResult();

    // 停止性能监控并获取报告
    const performanceReport = this.performanceMonitor.stopMonitoring();

    // 添加性能摘要到结果
    result.performanceSummary = {
      avgCpuUsage: performanceReport.avgCpuUsage,
      peakCpuUsage: performanceReport.peakCpuUsage,
      avgMemoryUsage: performanceReport.avgMemoryUsage,
      peakMemoryUsage: performanceReport.peakMemoryUsage,
      avgThroughput: performanceReport.avgThroughput,
      peakThroughput: performanceReport.peakThroughput,
    };

    return result;
  }

  /**
   * 收集部分结果（用于错误恢复）
   */
  private collectPartialResult(): ProcessingResult {
    this.logger.warn('收集部分结果...');

    const partialResult = this.resultCollector.getPartialResult();

    // 尝试停止性能监控
    try {
      const performanceReport = this.performanceMonitor.stopMonitoring();
      partialResult.performanceSummary = {
        avgCpuUsage: performanceReport.avgCpuUsage,
        peakCpuUsage: performanceReport.peakCpuUsage,
        avgMemoryUsage: performanceReport.avgMemoryUsage,
        peakMemoryUsage: performanceReport.peakMemoryUsage,
        avgThroughput: performanceReport.avgThroughput,
        peakThroughput: performanceReport.peakThroughput,
      };
    } catch (error) {
      this.logger.warn('无法获取性能报告');
    }

    return partialResult;
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    this.logger.log('清理资源...');

    try {
      // 停止资源监控
      this.resourceMonitor.stopMonitoring();

      // 终止工作线程池
      await this.workerPool.terminate();

      // 重置组件
      this.resultCollector.reset();
      this.progressTracker.reset();

    } catch (error) {
      this.logger.error(`清理资源失败: ${error.message}`);
    }
  }

  /**
   * 获取当前处理进度
   * @returns 进度百分比 (0-100)
   */
  getProgress(): number {
    if (!this.isProcessing) {
      return 0;
    }

    return this.progressTracker.getOverallProgress();
  }

  /**
   * 获取当前性能指标
   * @returns 实时性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics | null {
    if (!this.isProcessing) {
      return null;
    }

    try {
      return this.performanceMonitor.getCurrentMetrics();
    } catch (error) {
      this.logger.warn(`无法获取性能指标: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取进度统计
   */
  getProgressStats(): any {
    if (!this.isProcessing) {
      return null;
    }

    return this.progressTracker.getProgressStats();
  }

  /**
   * 优雅关闭所有工作线程
   */
  async shutdown(): Promise<void> {
    this.logger.log('关闭并行处理管理器...');

    if (this.isProcessing) {
      this.logger.warn('处理正在进行中，强制关闭...');
    }

    await this.cleanup();

    this.isProcessing = false;
    this.currentJobId = '';

    this.logger.log('并行处理管理器已关闭');
  }

  /**
   * 获取管理器状态
   */
  getStatus(): {
    isProcessing: boolean;
    currentJobId: string;
    progress: number;
    workerPoolStatus: any;
    resultCollectorStatus: any;
    progressTrackerStatus: any;
    performanceMonitorStatus: any;
    resourceMonitorStatus: any;
  } {
    return {
      isProcessing: this.isProcessing,
      currentJobId: this.currentJobId,
      progress: this.getProgress(),
      workerPoolStatus: this.workerPool.getStatus(),
      resultCollectorStatus: this.resultCollector.getStatus(),
      progressTrackerStatus: this.progressTracker.getStatus(),
      performanceMonitorStatus: this.performanceMonitor.getStatus(),
      resourceMonitorStatus: this.resourceMonitor.getStatus(),
    };
  }

  /**
   * 获取资源使用情况
   * @returns 当前资源使用情况
   */
  getResourceUsage(): any {
    return this.resourceMonitor.getCurrentUsage();
  }

  /**
   * 处理工作线程消息（用于进度和性能监控）
   */
  handleWorkerMessage(message: WorkerToMainMessage): void {
    switch (message.type) {
      case 'PROGRESS':
        // 更新进度
        this.progressTracker.updateProgress(
          message.payload.workerId,
          message.payload.processedRows,
          message.payload.totalRows,
        );
        break;

      case 'METRICS':
        // 记录性能指标
        this.performanceMonitor.recordWorkerMetrics(message.payload);
        break;

      case 'COMPLETE':
        // 工作线程完成（已在 executeTaskWithMonitoring 中处理）
        break;

      case 'ERROR':
        // 工作线程错误（已在 executeTaskWithMonitoring 中处理）
        this.logger.error(
          `Worker ${message.payload.workerId} 报告错误: ${message.payload.error}`,
        );
        break;
    }
  }
}

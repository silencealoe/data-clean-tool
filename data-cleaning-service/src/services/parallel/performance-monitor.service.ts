/**
 * PerformanceMonitor Service
 * 
 * 监控系统性能指标，包括 CPU、内存使用情况和吞吐量
 * 
 * 职责：
 * - 实时收集 CPU 使用率
 * - 实时收集内存使用情况
 * - 监控每个工作线程的资源使用
 * - 计算吞吐量和处理速度
 * - 记录峰值指标
 * - 提供性能报告
 */

import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';
import {
  PerformanceMetrics,
  PerformanceReport,
  CPUMetrics,
  MemoryMetrics,
  WorkerMetrics,
  WorkerReport,
  PerformanceSnapshot,
} from './types';

@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name);
  
  // 监控状态
  private isMonitoring: boolean = false;
  private jobId: string = '';
  private startTime: number = 0;
  
  // 采样间隔定时器
  private samplingInterval: NodeJS.Timeout | null = null;
  private samplingIntervalMs: number = 1000; // 默认每秒采样一次
  
  // CPU 基线（用于计算 CPU 使用率）
  private baselineCpuUsage: NodeJS.CpuUsage | null = null;
  private lastCpuCheck: number = 0;
  
  // 性能数据存储
  private snapshots: PerformanceSnapshot[] = [];
  private workerMetricsHistory: Map<number, WorkerMetrics[]> = new Map();
  
  // 峰值记录
  private peakCpuUsage: number = 0;
  private peakMemoryUsage: number = 0;
  private peakThroughput: number = 0;
  
  // 累计数据（用于计算平均值）
  private totalCpuUsage: number = 0;
  private totalMemoryUsage: number = 0;
  private totalThroughput: number = 0;
  private sampleCount: number = 0;
  
  // 工作线程数据
  private currentWorkerMetrics: Map<number, WorkerMetrics> = new Map();
  private totalProcessedRows: number = 0;

  /**
   * 开始性能监控
   * @param jobId - 任务 ID
   * @param samplingIntervalMs - 采样间隔（毫秒），默认 1000
   */
  startMonitoring(jobId: string, samplingIntervalMs: number = 1000): void {
    if (this.isMonitoring) {
      this.logger.warn(`性能监控已在运行中 (jobId: ${this.jobId})`);
      return;
    }
    
    this.jobId = jobId;
    this.samplingIntervalMs = samplingIntervalMs;
    this.startTime = Date.now();
    this.isMonitoring = true;
    
    // 重置所有数据
    this.resetData();
    
    // 设置 CPU 基线
    this.baselineCpuUsage = process.cpuUsage();
    this.lastCpuCheck = Date.now();
    
    // 开始定期采样
    this.samplingInterval = setInterval(() => {
      this.collectSample();
    }, this.samplingIntervalMs);
    
    this.logger.log(
      `性能监控已启动: jobId=${jobId}, 采样间隔=${samplingIntervalMs}ms`,
    );
  }

  /**
   * 停止性能监控并生成报告
   * @returns 性能报告
   */
  stopMonitoring(): PerformanceReport {
    if (!this.isMonitoring) {
      this.logger.warn('性能监控未运行');
      return this.generateEmptyReport();
    }
    
    // 停止采样
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
      this.samplingInterval = null;
    }
    
    // 收集最后一次样本
    this.collectSample();
    
    const duration = Date.now() - this.startTime;
    this.isMonitoring = false;
    
    // 生成报告
    const report = this.generateReport(duration);
    
    this.logger.log(
      `性能监控已停止: 持续时间=${duration}ms, 平均CPU=${report.avgCpuUsage.toFixed(1)}%, 峰值内存=${report.peakMemoryUsage.toFixed(1)}MB`,
    );
    
    return report;
  }

  /**
   * 获取当前性能指标
   * @returns 实时性能指标
   */
  getCurrentMetrics(): PerformanceMetrics {
    const cpuMetrics = this.collectCPUMetrics();
    const memoryMetrics = this.collectMemoryMetrics();
    const throughput = this.calculateCurrentThroughput();
    
    return {
      timestamp: Date.now(),
      cpuUsage: cpuMetrics,
      memoryUsage: memoryMetrics,
      workerMetrics: Array.from(this.currentWorkerMetrics.values()),
      throughput,
    };
  }

  /**
   * 记录工作线程指标
   * @param metrics - 工作线程指标
   */
  recordWorkerMetrics(metrics: WorkerMetrics): void {
    const workerId = metrics.workerId;
    
    // 更新当前指标
    this.currentWorkerMetrics.set(workerId, metrics);
    
    // 添加到历史记录
    if (!this.workerMetricsHistory.has(workerId)) {
      this.workerMetricsHistory.set(workerId, []);
    }
    this.workerMetricsHistory.get(workerId)!.push({
      ...metrics,
      timestamp: Date.now(),
    });
    
    // 更新总处理行数
    this.updateTotalProcessedRows();
    
    this.logger.debug(
      `记录 Worker ${workerId} 指标: CPU=${metrics.cpuUsage.toFixed(1)}%, 内存=${metrics.memoryUsage.toFixed(1)}MB, 已处理=${metrics.processedRows}`,
    );
  }

  /**
   * 收集性能样本
   */
  private collectSample(): void {
    const cpuMetrics = this.collectCPUMetrics();
    const memoryMetrics = this.collectMemoryMetrics();
    const throughput = this.calculateCurrentThroughput();
    
    // 创建快照
    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      cpuUsage: cpuMetrics.overall,
      memoryUsage: memoryMetrics.rssMB,
      processedRows: this.totalProcessedRows,
      throughput,
    };
    
    this.snapshots.push(snapshot);
    
    // 更新峰值
    this.peakCpuUsage = Math.max(this.peakCpuUsage, cpuMetrics.overall);
    this.peakMemoryUsage = Math.max(this.peakMemoryUsage, memoryMetrics.rssMB);
    this.peakThroughput = Math.max(this.peakThroughput, throughput);
    
    // 累计数据
    this.totalCpuUsage += cpuMetrics.overall;
    this.totalMemoryUsage += memoryMetrics.rssMB;
    this.totalThroughput += throughput;
    this.sampleCount++;
    
    // 限制快照数量（保留最近 1000 个）
    if (this.snapshots.length > 1000) {
      this.snapshots = this.snapshots.slice(-500);
    }
  }

  /**
   * 收集 CPU 指标
   * @returns CPU 指标
   */
  private collectCPUMetrics(): CPUMetrics {
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    
    // 计算每个核心的使用率
    const perCore: number[] = cpus.map(cpu => {
      const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
      const idle = cpu.times.idle;
      const usage = total > 0 ? ((total - idle) / total) * 100 : 0;
      return Math.min(100, Math.max(0, usage));
    });
    
    // 计算总体 CPU 使用率
    const currentCpuUsage = process.cpuUsage(this.baselineCpuUsage || undefined);
    const elapsedTime = Date.now() - this.lastCpuCheck;
    
    // 计算用户态和系统态 CPU 时间（微秒）
    const userCpuTime = currentCpuUsage.user;
    const systemCpuTime = currentCpuUsage.system;
    const totalCpuTime = userCpuTime + systemCpuTime;
    
    // 转换为百分比（考虑多核）
    const elapsedMicroseconds = elapsedTime * 1000;
    const cpuPercentage = elapsedMicroseconds > 0
      ? (totalCpuTime / elapsedMicroseconds) * 100
      : 0;
    
    const overall = Math.min(100, Math.max(0, cpuPercentage));
    const user = elapsedMicroseconds > 0
      ? (userCpuTime / elapsedMicroseconds) * 100
      : 0;
    const system = elapsedMicroseconds > 0
      ? (systemCpuTime / elapsedMicroseconds) * 100
      : 0;
    
    // 更新基线
    this.baselineCpuUsage = process.cpuUsage();
    this.lastCpuCheck = Date.now();
    
    return {
      overall,
      perCore,
      user: Math.min(100, Math.max(0, user)),
      system: Math.min(100, Math.max(0, system)),
    };
  }

  /**
   * 收集内存指标
   * @returns 内存指标
   */
  private collectMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const rssMB = memUsage.rss / 1024 / 1024;
    
    const usagePercentage = (memUsage.rss / totalMemory) * 100;
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      heapUsedMB,
      heapTotalMB,
      rssMB,
      usagePercentage,
    };
  }

  /**
   * 计算当前吞吐量（行/秒）
   * @returns 吞吐量
   */
  private calculateCurrentThroughput(): number {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    
    if (elapsedSeconds === 0) {
      return 0;
    }
    
    return this.totalProcessedRows / elapsedSeconds;
  }

  /**
   * 更新总处理行数
   */
  private updateTotalProcessedRows(): void {
    this.totalProcessedRows = 0;
    for (const metrics of this.currentWorkerMetrics.values()) {
      this.totalProcessedRows += metrics.processedRows;
    }
  }

  /**
   * 生成性能报告
   * @param duration - 持续时间（毫秒）
   * @returns 性能报告
   */
  private generateReport(duration: number): PerformanceReport {
    const cpuCount = os.cpus().length;
    
    // 计算平均值
    const avgCpuUsage = this.sampleCount > 0
      ? this.totalCpuUsage / this.sampleCount
      : 0;
    const avgMemoryUsage = this.sampleCount > 0
      ? this.totalMemoryUsage / this.sampleCount
      : 0;
    const avgThroughput = this.sampleCount > 0
      ? this.totalThroughput / this.sampleCount
      : 0;
    
    // 计算 CPU 利用率（相对于可用核心）
    const cpuUtilization = (avgCpuUsage / (cpuCount * 100)) * 100;
    
    // 计算内存利用率
    const totalMemory = os.totalmem() / 1024 / 1024; // MB
    const memoryUtilization = (avgMemoryUsage / totalMemory) * 100;
    
    // 生成工作线程报告
    const workerReports = this.generateWorkerReports();
    
    return {
      jobId: this.jobId,
      duration,
      
      // CPU 指标
      avgCpuUsage,
      peakCpuUsage: this.peakCpuUsage,
      cpuUtilization,
      
      // 内存指标
      avgMemoryUsage,
      peakMemoryUsage: this.peakMemoryUsage,
      memoryUtilization,
      
      // 吞吐量指标
      totalRows: this.totalProcessedRows,
      avgThroughput,
      peakThroughput: this.peakThroughput,
      
      // 工作线程指标
      workerReports,
      
      // 时间线数据
      timeline: this.snapshots,
    };
  }

  /**
   * 生成工作线程报告
   * @returns 工作线程报告数组
   */
  private generateWorkerReports(): WorkerReport[] {
    const reports: WorkerReport[] = [];
    
    for (const [workerId, metricsHistory] of this.workerMetricsHistory.entries()) {
      if (metricsHistory.length === 0) {
        continue;
      }
      
      // 计算平均值和峰值
      let totalCpu = 0;
      let totalMemory = 0;
      let totalThroughput = 0;
      let peakCpu = 0;
      let peakMemory = 0;
      let processedRows = 0;
      
      for (const metrics of metricsHistory) {
        totalCpu += metrics.cpuUsage;
        totalMemory += metrics.memoryUsage;
        totalThroughput += metrics.throughput;
        peakCpu = Math.max(peakCpu, metrics.cpuUsage);
        peakMemory = Math.max(peakMemory, metrics.memoryUsage);
        processedRows = Math.max(processedRows, metrics.processedRows);
      }
      
      const count = metricsHistory.length;
      const avgCpuUsage = count > 0 ? totalCpu / count : 0;
      const avgMemoryUsage = count > 0 ? totalMemory / count : 0;
      const avgThroughput = count > 0 ? totalThroughput / count : 0;
      
      // 计算持续时间
      const firstTimestamp = metricsHistory[0].timestamp || this.startTime;
      const lastTimestamp = metricsHistory[metricsHistory.length - 1].timestamp || Date.now();
      const workerDuration = lastTimestamp - firstTimestamp;
      
      reports.push({
        workerId,
        avgCpuUsage,
        peakCpuUsage: peakCpu,
        avgMemoryUsage,
        peakMemoryUsage: peakMemory,
        processedRows,
        avgThroughput,
        duration: workerDuration,
      });
    }
    
    // 按 workerId 排序
    return reports.sort((a, b) => a.workerId - b.workerId);
  }

  /**
   * 生成空报告（当监控未运行时）
   * @returns 空性能报告
   */
  private generateEmptyReport(): PerformanceReport {
    return {
      jobId: this.jobId || 'unknown',
      duration: 0,
      avgCpuUsage: 0,
      peakCpuUsage: 0,
      cpuUtilization: 0,
      avgMemoryUsage: 0,
      peakMemoryUsage: 0,
      memoryUtilization: 0,
      totalRows: 0,
      avgThroughput: 0,
      peakThroughput: 0,
      workerReports: [],
      timeline: [],
    };
  }

  /**
   * 重置所有数据
   */
  private resetData(): void {
    this.snapshots = [];
    this.workerMetricsHistory.clear();
    this.currentWorkerMetrics.clear();
    this.peakCpuUsage = 0;
    this.peakMemoryUsage = 0;
    this.peakThroughput = 0;
    this.totalCpuUsage = 0;
    this.totalMemoryUsage = 0;
    this.totalThroughput = 0;
    this.sampleCount = 0;
    this.totalProcessedRows = 0;
  }

  /**
   * 获取监控状态
   * @returns 监控状态信息
   */
  getStatus(): {
    isMonitoring: boolean;
    jobId: string;
    duration: number;
    sampleCount: number;
    totalProcessedRows: number;
    currentCpuUsage: number;
    currentMemoryUsage: number;
    currentThroughput: number;
  } {
    const duration = this.isMonitoring ? Date.now() - this.startTime : 0;
    const currentMetrics = this.isMonitoring ? this.getCurrentMetrics() : null;
    
    return {
      isMonitoring: this.isMonitoring,
      jobId: this.jobId,
      duration,
      sampleCount: this.sampleCount,
      totalProcessedRows: this.totalProcessedRows,
      currentCpuUsage: currentMetrics?.cpuUsage.overall || 0,
      currentMemoryUsage: currentMetrics?.memoryUsage.rssMB || 0,
      currentThroughput: currentMetrics?.throughput || 0,
    };
  }
}

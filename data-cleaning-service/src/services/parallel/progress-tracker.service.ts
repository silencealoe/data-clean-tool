/**
 * ProgressTracker Service
 * 
 * 跟踪所有工作线程的聚合进度
 * 
 * 职责：
 * - 接收来自工作线程的进度更新
 * - 计算总体进度百分比
 * - 记录进度里程碑（25%, 50%, 75%, 100%）
 * - 提供实时进度查询
 * - 验证进度单调递增（属性 4）
 */

import { Injectable, Logger } from '@nestjs/common';

/**
 * 工作线程进度信息
 */
interface WorkerProgressInfo {
  workerId: number;
  processedRows: number;
  totalRows: number;
  percentage: number;
  lastUpdateTime: number;
}

@Injectable()
export class ProgressTrackerService {
  private readonly logger = new Logger(ProgressTrackerService.name);
  
  // 存储各工作线程的进度
  private workerProgress: Map<number, WorkerProgressInfo> = new Map();
  
  // 总行数
  private totalRows: number = 0;
  
  // 上一次的总体进度（用于验证单调递增）
  private lastOverallProgress: number = 0;
  
  // 里程碑标记（用于避免重复日志）
  private milestones: Set<number> = new Set([25, 50, 75, 100]);
  private reachedMilestones: Set<number> = new Set();
  
  // 进度历史（用于验证单调递增）
  private progressHistory: number[] = [];

  /**
   * 初始化进度跟踪器
   * @param totalRows - 总行数
   * @param workerCount - 工作线程数量
   */
  initialize(totalRows: number, workerCount: number): void {
    this.totalRows = totalRows;
    this.lastOverallProgress = 0;
    this.workerProgress.clear();
    this.reachedMilestones.clear();
    this.progressHistory = [0];
    
    // 初始化所有工作线程的进度为 0
    for (let i = 0; i < workerCount; i++) {
      this.workerProgress.set(i, {
        workerId: i,
        processedRows: 0,
        totalRows: 0,
        percentage: 0,
        lastUpdateTime: Date.now(),
      });
    }
    
    this.logger.log(
      `ProgressTracker 已初始化: 总行数 ${totalRows}, 工作线程数 ${workerCount}`,
    );
  }

  /**
   * 更新工作线程进度
   * @param workerId - 工作线程 ID
   * @param processed - 已处理记录数
   * @param total - 该工作线程的总记录数
   */
  updateProgress(workerId: number, processed: number, total: number): void {
    const percentage = total > 0 ? (processed / total) * 100 : 0;
    
    const progressInfo: WorkerProgressInfo = {
      workerId,
      processedRows: processed,
      totalRows: total,
      percentage,
      lastUpdateTime: Date.now(),
    };
    
    this.workerProgress.set(workerId, progressInfo);
    
    // 计算总体进度
    const overallProgress = this.getOverallProgress();
    
    // 验证进度单调递增（属性 4）
    this.validateMonotonicProgress(overallProgress);
    
    // 检查并记录里程碑
    this.checkMilestones(overallProgress);
    
    this.logger.debug(
      `Worker ${workerId} 进度更新: ${processed}/${total} (${percentage.toFixed(1)}%), 总体进度: ${overallProgress.toFixed(1)}%`,
    );
  }

  /**
   * 获取总体进度
   * @returns 进度百分比 (0-100)
   */
  getOverallProgress(): number {
    if (this.totalRows === 0) {
      return 0;
    }
    
    // 计算所有工作线程已处理的总行数
    let totalProcessed = 0;
    for (const progress of this.workerProgress.values()) {
      totalProcessed += progress.processedRows;
    }
    
    const overallProgress = (totalProcessed / this.totalRows) * 100;
    
    // 确保进度在 0-100 范围内
    return Math.min(100, Math.max(0, overallProgress));
  }

  /**
   * 获取各工作线程进度
   * @returns 工作线程 ID 到进度百分比的映射
   */
  getWorkerProgress(): Map<number, number> {
    const progressMap = new Map<number, number>();
    
    for (const [workerId, progress] of this.workerProgress.entries()) {
      progressMap.set(workerId, progress.percentage);
    }
    
    return progressMap;
  }

  /**
   * 获取详细的工作线程进度信息
   * @returns 工作线程进度信息数组
   */
  getWorkerProgressDetails(): WorkerProgressInfo[] {
    return Array.from(this.workerProgress.values());
  }

  /**
   * 获取特定工作线程的进度
   * @param workerId - 工作线程 ID
   * @returns 进度百分比，如果工作线程不存在则返回 0
   */
  getWorkerProgressById(workerId: number): number {
    const progress = this.workerProgress.get(workerId);
    return progress ? progress.percentage : 0;
  }

  /**
   * 验证进度单调递增（属性 4）
   * @param currentProgress - 当前进度
   */
  private validateMonotonicProgress(currentProgress: number): void {
    if (currentProgress < this.lastOverallProgress) {
      this.logger.warn(
        `进度单调性违反! 当前进度 ${currentProgress.toFixed(2)}% < 上次进度 ${this.lastOverallProgress.toFixed(2)}%`,
      );
      
      // 记录进度历史以便调试
      this.logger.warn(
        `进度历史: ${this.progressHistory.slice(-5).map(p => p.toFixed(2)).join(' -> ')} -> ${currentProgress.toFixed(2)}`,
      );
    }
    
    this.lastOverallProgress = currentProgress;
    this.progressHistory.push(currentProgress);
    
    // 限制历史记录大小
    if (this.progressHistory.length > 1000) {
      this.progressHistory = this.progressHistory.slice(-500);
    }
  }

  /**
   * 检查并记录进度里程碑
   * @param currentProgress - 当前进度
   */
  private checkMilestones(currentProgress: number): void {
    for (const milestone of this.milestones) {
      // 如果达到里程碑且尚未记录
      if (currentProgress >= milestone && !this.reachedMilestones.has(milestone)) {
        this.reachedMilestones.add(milestone);
        
        this.logger.log(
          `🎯 进度里程碑: ${milestone}% 已达成 (当前: ${currentProgress.toFixed(1)}%)`,
        );
        
        // 记录各工作线程的进度
        if (milestone === 100) {
          this.logWorkerProgressSummary();
        }
      }
    }
  }

  /**
   * 记录各工作线程的进度摘要
   */
  private logWorkerProgressSummary(): void {
    this.logger.log('各工作线程进度摘要:');
    
    const sortedProgress = Array.from(this.workerProgress.values())
      .sort((a, b) => a.workerId - b.workerId);
    
    for (const progress of sortedProgress) {
      this.logger.log(
        `  Worker ${progress.workerId}: ${progress.processedRows}/${progress.totalRows} (${progress.percentage.toFixed(1)}%)`,
      );
    }
  }

  /**
   * 获取已达成的里程碑
   * @returns 已达成的里程碑数组
   */
  getReachedMilestones(): number[] {
    return Array.from(this.reachedMilestones).sort((a, b) => a - b);
  }

  /**
   * 检查是否所有工作线程都已完成
   * @returns 是否所有工作线程都达到 100%
   */
  isAllWorkersComplete(): boolean {
    for (const progress of this.workerProgress.values()) {
      if (progress.percentage < 100) {
        return false;
      }
    }
    return this.workerProgress.size > 0;
  }

  /**
   * 获取进度统计信息
   * @returns 进度统计
   */
  getProgressStats(): {
    overallProgress: number;
    totalProcessed: number;
    totalRows: number;
    completedWorkers: number;
    totalWorkers: number;
    reachedMilestones: number[];
    isMonotonic: boolean;
  } {
    let totalProcessed = 0;
    let completedWorkers = 0;
    
    for (const progress of this.workerProgress.values()) {
      totalProcessed += progress.processedRows;
      if (progress.percentage >= 100) {
        completedWorkers++;
      }
    }
    
    // 检查进度是否单调递增
    const isMonotonic = this.checkProgressMonotonicity();
    
    return {
      overallProgress: this.getOverallProgress(),
      totalProcessed,
      totalRows: this.totalRows,
      completedWorkers,
      totalWorkers: this.workerProgress.size,
      reachedMilestones: this.getReachedMilestones(),
      isMonotonic,
    };
  }

  /**
   * 检查进度历史是否单调递增
   * @returns 是否单调递增
   */
  private checkProgressMonotonicity(): boolean {
    for (let i = 1; i < this.progressHistory.length; i++) {
      if (this.progressHistory[i] < this.progressHistory[i - 1]) {
        return false;
      }
    }
    return true;
  }

  /**
   * 重置进度跟踪
   */
  reset(): void {
    this.workerProgress.clear();
    this.totalRows = 0;
    this.lastOverallProgress = 0;
    this.reachedMilestones.clear();
    this.progressHistory = [];
    
    this.logger.log('ProgressTracker 已重置');
  }

  /**
   * 获取当前状态（用于调试）
   */
  getStatus(): {
    totalRows: number;
    overallProgress: number;
    workerCount: number;
    reachedMilestones: number[];
    lastUpdateTime: number;
  } {
    let lastUpdateTime = 0;
    for (const progress of this.workerProgress.values()) {
      lastUpdateTime = Math.max(lastUpdateTime, progress.lastUpdateTime);
    }
    
    return {
      totalRows: this.totalRows,
      overallProgress: this.getOverallProgress(),
      workerCount: this.workerProgress.size,
      reachedMilestones: this.getReachedMilestones(),
      lastUpdateTime,
    };
  }
}

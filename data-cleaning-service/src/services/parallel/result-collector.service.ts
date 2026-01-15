/**
 * ResultCollector Service
 * 
 * 收集和聚合来自所有工作线程的结果
 * 
 * 职责：
 * - 等待所有工作线程完成
 * - 聚合成功和错误计数
 * - 计算总处理时间
 * - 验证数据完整性
 * - 格式化最终响应
 */

import { Injectable, Logger } from '@nestjs/common';
import { WorkerResult, ProcessingResult } from './types';

@Injectable()
export class ResultCollectorService {
  private readonly logger = new Logger(ResultCollectorService.name);
  
  // 存储工作线程结果
  private results: Map<number, WorkerResult> = new Map();
  
  // 处理开始时间
  private startTime: number = 0;
  
  // 预期工作线程数量
  private expectedWorkerCount: number = 0;
  
  // 总输入行数（用于验证）
  private totalInputRows: number = 0;

  /**
   * 初始化收集器
   * @param expectedWorkerCount - 预期工作线程数量
   * @param totalInputRows - 总输入行数
   */
  initialize(expectedWorkerCount: number, totalInputRows: number): void {
    this.expectedWorkerCount = expectedWorkerCount;
    this.totalInputRows = totalInputRows;
    this.startTime = Date.now();
    this.results.clear();
    
    this.logger.log(
      `ResultCollector 已初始化: 预期 ${expectedWorkerCount} 个工作线程, 总行数 ${totalInputRows}`,
    );
  }

  /**
   * 注册工作线程结果
   * @param result - 工作线程结果
   */
  addResult(result: WorkerResult): void {
    if (this.results.has(result.workerId)) {
      this.logger.warn(
        `工作线程 ${result.workerId} 的结果已存在，将被覆盖`,
      );
    }
    
    this.results.set(result.workerId, result);
    
    this.logger.log(
      `收到工作线程 ${result.workerId} 的结果: 成功 ${result.successCount}, 错误 ${result.errorCount}, 耗时 ${result.processingTimeMs}ms`,
    );
    
    // 检查是否所有工作线程都已完成
    if (this.isComplete()) {
      this.logger.log('所有工作线程已完成');
    }
  }

  /**
   * 检查是否所有工作线程都已完成
   * @returns 是否完成
   */
  isComplete(): boolean {
    return this.results.size === this.expectedWorkerCount;
  }

  /**
   * 获取当前已完成的工作线程数量
   * @returns 已完成数量
   */
  getCompletedCount(): number {
    return this.results.size;
  }

  /**
   * 获取聚合的最终结果
   * @returns 处理结果
   */
  getFinalResult(): ProcessingResult {
    if (!this.isComplete()) {
      this.logger.warn(
        `获取最终结果时，只有 ${this.results.size}/${this.expectedWorkerCount} 个工作线程完成`,
      );
    }
    
    // 聚合所有工作线程的结果
    let totalSuccessCount = 0;
    let totalErrorCount = 0;
    const workerResults: WorkerResult[] = [];
    
    for (const result of this.results.values()) {
      totalSuccessCount += result.successCount;
      totalErrorCount += result.errorCount;
      workerResults.push(result);
    }
    
    // 计算总处理时间
    const processingTimeMs = Date.now() - this.startTime;
    
    // 验证数据完整性（属性 1）
    const totalProcessed = totalSuccessCount + totalErrorCount;
    this.validateDataIntegrity(totalProcessed);
    
    const finalResult: ProcessingResult = {
      totalRecords: this.totalInputRows,
      successCount: totalSuccessCount,
      errorCount: totalErrorCount,
      processingTimeMs,
      workerResults,
    };
    
    this.logger.log(
      `最终结果: 总记录 ${this.totalInputRows}, 成功 ${totalSuccessCount}, 错误 ${totalErrorCount}, 耗时 ${processingTimeMs}ms`,
    );
    
    return finalResult;
  }

  /**
   * 验证数据完整性
   * 属性 1: 数据完整性保持 - successCount + errorCount == totalInputRows
   * @param totalProcessed - 已处理总数
   */
  private validateDataIntegrity(totalProcessed: number): void {
    if (totalProcessed !== this.totalInputRows) {
      const difference = Math.abs(totalProcessed - this.totalInputRows);
      const percentage = ((difference / this.totalInputRows) * 100).toFixed(2);
      
      this.logger.error(
        `数据完整性验证失败! 预期 ${this.totalInputRows} 行, 实际处理 ${totalProcessed} 行, 差异 ${difference} 行 (${percentage}%)`,
      );
      
      // 记录详细的工作线程结果
      this.logger.error('工作线程结果详情:');
      for (const [workerId, result] of this.results.entries()) {
        this.logger.error(
          `  Worker ${workerId}: 成功 ${result.successCount}, 错误 ${result.errorCount}, 总计 ${result.successCount + result.errorCount}`,
        );
      }
      
      throw new Error(
        `数据完整性验证失败: 预期 ${this.totalInputRows} 行, 实际处理 ${totalProcessed} 行`,
      );
    }
    
    this.logger.log(
      `数据完整性验证通过: ${totalProcessed} 行 = ${this.totalInputRows} 行`,
    );
  }

  /**
   * 获取部分结果（用于错误恢复）
   * 即使不是所有工作线程都完成，也返回已收集的结果
   * @returns 部分处理结果
   */
  getPartialResult(): ProcessingResult {
    let totalSuccessCount = 0;
    let totalErrorCount = 0;
    const workerResults: WorkerResult[] = [];
    
    for (const result of this.results.values()) {
      totalSuccessCount += result.successCount;
      totalErrorCount += result.errorCount;
      workerResults.push(result);
    }
    
    const processingTimeMs = Date.now() - this.startTime;
    const totalProcessed = totalSuccessCount + totalErrorCount;
    
    this.logger.warn(
      `返回部分结果: ${this.results.size}/${this.expectedWorkerCount} 个工作线程完成, 已处理 ${totalProcessed}/${this.totalInputRows} 行`,
    );
    
    return {
      totalRecords: this.totalInputRows,
      successCount: totalSuccessCount,
      errorCount: totalErrorCount,
      processingTimeMs,
      workerResults,
    };
  }

  /**
   * 检查是否所有工作线程都已报告结果
   * @returns 是否所有工作线程都已报告
   */
  allWorkersReported(): boolean {
    if (this.expectedWorkerCount === 0) {
      return false;
    }
    
    // 检查是否有所有预期的工作线程 ID
    for (let i = 0; i < this.expectedWorkerCount; i++) {
      if (!this.results.has(i)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 获取缺失的工作线程 ID 列表
   * @returns 缺失的工作线程 ID 数组
   */
  getMissingWorkerIds(): number[] {
    const missing: number[] = [];
    
    for (let i = 0; i < this.expectedWorkerCount; i++) {
      if (!this.results.has(i)) {
        missing.push(i);
      }
    }
    
    return missing;
  }

  /**
   * 重置收集器以进行新的处理
   */
  reset(): void {
    this.results.clear();
    this.startTime = 0;
    this.expectedWorkerCount = 0;
    this.totalInputRows = 0;
    
    this.logger.log('ResultCollector 已重置');
  }

  /**
   * 获取当前状态（用于调试）
   */
  getStatus(): {
    expectedWorkerCount: number;
    completedCount: number;
    totalInputRows: number;
    isComplete: boolean;
    missingWorkerIds: number[];
  } {
    return {
      expectedWorkerCount: this.expectedWorkerCount,
      completedCount: this.results.size,
      totalInputRows: this.totalInputRows,
      isComplete: this.isComplete(),
      missingWorkerIds: this.getMissingWorkerIds(),
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Worker } from 'worker_threads';
import * as path from 'path';
import {
  WorkerTask,
  WorkerResult,
  PoolStatus,
  WorkerToMainMessage,
  MainToWorkerMessage,
} from './types';

/**
 * 工作线程信息
 */
interface WorkerInfo {
  /** 工作线程实例 */
  worker: Worker;

  /** 工作线程 ID */
  id: number;

  /** 当前状态 */
  status: 'idle' | 'busy' | 'failed' | 'terminated';

  /** 当前执行的任务 */
  currentTask?: WorkerTask;

  /** 创建时间 */
  createdAt: Date;

  /** 最后活动时间 */
  lastActivityAt: Date;
}

/**
 * WorkerPool 服务
 * 
 * 负责管理工作线程池的生命周期：
 * - 创建和初始化工作线程
 * - 分配任务给工作线程
 * - 监控工作线程状态
 * - 处理工作线程错误和重启
 * - 优雅关闭所有工作线程
 */
@Injectable()
export class WorkerPoolService {
  private readonly logger = new Logger(WorkerPoolService.name);

  /** 工作线程池 */
  private workers: Map<number, WorkerInfo> = new Map();

  /** 工作线程脚本路径 */
  private workerScriptPath: string;

  /** 是否已初始化 */
  private initialized = false;

  /** 失败的工作线程计数 */
  private failedWorkerCount = 0;

  /** 消息处理回调 */
  private messageHandler?: (message: WorkerToMainMessage) => void;

  constructor() {
    // 工作线程脚本路径（将在后续任务中创建）
    this.workerScriptPath = path.join(__dirname, '../../workers/data-cleaning.worker.js');
  }

  /**
   * 设置消息处理回调
   * @param handler 消息处理函数
   */
  setMessageHandler(handler: (message: WorkerToMainMessage) => void): void {
    this.messageHandler = handler;
  }

  /**
   * 初始化工作线程池
   * 
   * @param count - 要创建的工作线程数量
   */
  async initialize(count: number): Promise<void> {
    if (this.initialized) {
      this.logger.warn('工作线程池已经初始化');
      return;
    }

    this.logger.log(`初始化工作线程池，创建 ${count} 个工作线程...`);

    try {
      // 创建指定数量的工作线程
      for (let i = 0; i < count; i++) {
        await this.createWorker(i);
      }

      this.initialized = true;
      this.logger.log(`✓ 工作线程池初始化完成，${count} 个工作线程已就绪`);
    } catch (error) {
      this.logger.error(`工作线程池初始化失败: ${error.message}`, error.stack);
      // 清理已创建的工作线程
      await this.terminate();
      throw error;
    }
  }

  /**
   * 创建单个工作线程
   * 
   * @param id - 工作线程 ID
   */
  private async createWorker(id: number): Promise<void> {
    this.logger.log(`创建工作线程 ${id}...`);

    try {
      const worker = new Worker(this.workerScriptPath);

      const workerInfo: WorkerInfo = {
        worker,
        id,
        status: 'idle',
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      // 设置工作线程事件监听器
      this.setupWorkerListeners(workerInfo);

      this.workers.set(id, workerInfo);
      this.logger.log(`✓ 工作线程 ${id} 创建成功`);
    } catch (error) {
      this.logger.error(`创建工作线程 ${id} 失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 设置工作线程事件监听器
   * 
   * @param workerInfo - 工作线程信息
   */
  private setupWorkerListeners(workerInfo: WorkerInfo): void {
    const { worker, id } = workerInfo;

    // 监听工作线程消息
    worker.on('message', (message: WorkerToMainMessage) => {
      workerInfo.lastActivityAt = new Date();
      this.handleWorkerMessage(id, message);
    });

    // 监听工作线程错误
    worker.on('error', (error: Error) => {
      this.logger.error(`工作线程 ${id} 发生错误: ${error.message}`, error.stack);
      this.handleWorkerError(id, error);
    });

    // 监听工作线程退出
    worker.on('exit', (code: number) => {
      if (code !== 0) {
        this.logger.error(`工作线程 ${id} 异常退出，退出码: ${code}`);
        this.handleWorkerExit(id, code);
      } else {
        this.logger.log(`工作线程 ${id} 正常退出`);
      }
    });
  }

  /**
   * 处理工作线程消息
   * 
   * @param workerId - 工作线程 ID
   * @param message - 消息
   */
  private handleWorkerMessage(workerId: number, message: WorkerToMainMessage): void {
    // 转发消息给并行处理管理器
    if (this.messageHandler) {
      this.messageHandler(message);
    }

    switch (message.type) {
      case 'PROGRESS':
        this.logger.debug(
          `工作线程 ${workerId} 进度: ${message.payload.percentage.toFixed(2)}% ` +
          `(${message.payload.processedRows}/${message.payload.totalRows})`,
        );
        break;

      case 'COMPLETE':
        this.logger.log(
          `工作线程 ${workerId} 完成任务: ` +
          `成功 ${message.payload.successCount}, 错误 ${message.payload.errorCount}`,
        );
        break;

      case 'ERROR':
        this.logger.error(
          `工作线程 ${workerId} 报告错误: ${message.payload.error}`,
        );
        break;

      case 'METRICS':
        this.logger.debug(
          `工作线程 ${workerId} 指标: ` +
          `CPU ${message.payload.cpuUsage.toFixed(2)}%, ` +
          `内存 ${message.payload.memoryUsage.toFixed(2)}MB`,
        );
        break;

      default:
        this.logger.warn(`工作线程 ${workerId} 发送了未知消息类型`);
    }
  }

  /**
   * 处理工作线程错误
   * 
   * @param workerId - 工作线程 ID
   * @param error - 错误对象
   */
  private handleWorkerError(workerId: number, error: Error): void {
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.status = 'failed';
      this.failedWorkerCount++;
    }
  }

  /**
   * 处理工作线程退出
   * 
   * @param workerId - 工作线程 ID
   * @param exitCode - 退出码
   */
  private handleWorkerExit(workerId: number, exitCode: number): void {
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.status = 'terminated';

      // 如果工作线程在执行任务时退出，标记为失败
      if (workerInfo.currentTask) {
        this.failedWorkerCount++;
        this.logger.error(
          `工作线程 ${workerId} 在执行任务时退出 (退出码: ${exitCode})`,
        );
      }
    }
  }

  /**
   * 向工作线程分配任务
   * 
   * @param task - 工作任务
   * @returns 工作线程执行结果的 Promise
   */
  async executeTask(task: WorkerTask): Promise<WorkerResult> {
    if (!this.initialized) {
      throw new Error('工作线程池未初始化');
    }

    const workerInfo = this.workers.get(task.workerId);
    if (!workerInfo) {
      throw new Error(`工作线程 ${task.workerId} 不存在`);
    }

    if (workerInfo.status !== 'idle') {
      throw new Error(`工作线程 ${task.workerId} 不可用 (状态: ${workerInfo.status})`);
    }

    this.logger.log(
      `分配任务给工作线程 ${task.workerId}: ` +
      `处理行 ${task.startRow}-${task.startRow + task.rowCount - 1}`,
    );

    return new Promise((resolve, reject) => {
      const { worker } = workerInfo;

      // 更新工作线程状态
      workerInfo.status = 'busy';
      workerInfo.currentTask = task;
      workerInfo.lastActivityAt = new Date();

      // 设置超时
      const timeout = setTimeout(() => {
        this.logger.error(`工作线程 ${task.workerId} 超时`);
        worker.terminate();
        reject(new Error(`工作线程 ${task.workerId} 执行超时`));
      }, task.timeoutMs || 300000); // 默认 5 分钟

      // 临时消息监听器（用于此任务）
      const messageHandler = (message: WorkerToMainMessage) => {
        if (message.type === 'COMPLETE') {
          clearTimeout(timeout);
          worker.removeListener('message', messageHandler);
          worker.removeListener('error', errorHandler);
          workerInfo.status = 'idle';
          workerInfo.currentTask = undefined;
          resolve(message.payload);
        } else if (message.type === 'ERROR') {
          clearTimeout(timeout);
          worker.removeListener('message', messageHandler);
          worker.removeListener('error', errorHandler);
          workerInfo.status = 'failed';
          workerInfo.currentTask = undefined;
          reject(new Error(message.payload.error));
        }
        // 对于 PROGRESS 和 METRICS 消息，不做任何处理，让全局处理器处理
      };

      // 临时错误监听器
      const errorHandler = (error: Error) => {
        clearTimeout(timeout);
        worker.removeListener('message', messageHandler);
        worker.removeListener('error', errorHandler);
        workerInfo.status = 'failed';
        workerInfo.currentTask = undefined;
        reject(error);
      };

      // 添加临时监听器 - 使用 on 而不是 once，因为会收到多个消息
      worker.on('message', messageHandler);
      worker.once('error', errorHandler);

      // 发送任务到工作线程
      const startMessage: MainToWorkerMessage = {
        type: 'START',
        payload: task,
      };

      try {
        worker.postMessage(startMessage);
      } catch (error) {
        clearTimeout(timeout);
        worker.removeListener('message', messageHandler);
        worker.removeListener('error', errorHandler);
        workerInfo.status = 'failed';
        workerInfo.currentTask = undefined;
        reject(error);
      }
    });
  }

  /**
   * 获取工作线程池状态
   * 
   * @returns 池状态
   */
  getStatus(): PoolStatus {
    const totalWorkers = this.workers.size;
    let activeWorkers = 0;
    let idleWorkers = 0;

    this.workers.forEach((workerInfo) => {
      if (workerInfo.status === 'busy') {
        activeWorkers++;
      } else if (workerInfo.status === 'idle') {
        idleWorkers++;
      }
    });

    return {
      totalWorkers,
      activeWorkers,
      idleWorkers,
      failedWorkers: this.failedWorkerCount,
    };
  }

  /**
   * 获取详细的工作线程信息
   * 
   * @returns 工作线程信息数组
   */
  getWorkerDetails(): Array<{
    id: number;
    status: string;
    createdAt: Date;
    lastActivityAt: Date;
    currentTask?: string;
  }> {
    const details: Array<any> = [];

    this.workers.forEach((workerInfo) => {
      details.push({
        id: workerInfo.id,
        status: workerInfo.status,
        createdAt: workerInfo.createdAt,
        lastActivityAt: workerInfo.lastActivityAt,
        currentTask: workerInfo.currentTask
          ? `行 ${workerInfo.currentTask.startRow}-${workerInfo.currentTask.startRow + workerInfo.currentTask.rowCount - 1}`
          : undefined,
      });
    });

    return details;
  }

  /**
   * 优雅关闭所有工作线程
   * 
   * @param timeoutMs - 等待工作线程完成的超时时间（毫秒）
   */
  async terminate(timeoutMs: number = 5000): Promise<void> {
    if (this.workers.size === 0) {
      this.logger.log('没有工作线程需要关闭');
      return;
    }

    this.logger.log(`开始关闭 ${this.workers.size} 个工作线程...`);

    const terminationPromises: Promise<void>[] = [];

    this.workers.forEach((workerInfo, id) => {
      const promise = this.terminateWorker(workerInfo, timeoutMs);
      terminationPromises.push(promise);
    });

    try {
      await Promise.all(terminationPromises);
      this.workers.clear();
      this.initialized = false;
      this.logger.log('✓ 所有工作线程已关闭');
    } catch (error) {
      this.logger.error(`关闭工作线程时发生错误: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 关闭单个工作线程
   * 
   * @param workerInfo - 工作线程信息
   * @param timeoutMs - 超时时间
   */
  private async terminateWorker(
    workerInfo: WorkerInfo,
    timeoutMs: number,
  ): Promise<void> {
    const { worker, id } = workerInfo;

    return new Promise<void>((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.logger.warn(`工作线程 ${id} 未在超时时间内响应，强制终止`);
        worker.terminate().then(() => resolve()).catch(reject);
      }, timeoutMs);

      // 监听退出事件
      worker.once('exit', (code) => {
        clearTimeout(timeout);
        this.logger.log(`工作线程 ${id} 已退出 (退出码: ${code})`);
        resolve();
      });

      // 发送终止消息
      try {
        const terminateMessage: MainToWorkerMessage = {
          type: 'TERMINATE',
        };
        worker.postMessage(terminateMessage);
      } catch (error) {
        clearTimeout(timeout);
        // 如果发送消息失败，直接终止
        worker.terminate().then(() => resolve()).catch(reject);
      }
    });
  }

  /**
   * 检查工作线程池是否健康
   * 
   * @returns 是否健康
   */
  isHealthy(): boolean {
    if (!this.initialized) {
      return false;
    }

    const status = this.getStatus();

    // 如果超过一半的工作线程失败，认为不健康
    if (status.failedWorkers > status.totalWorkers / 2) {
      return false;
    }

    return true;
  }

  /**
   * 重启失败的工作线程
   * 
   * @returns 重启的工作线程数量
   */
  async restartFailedWorkers(): Promise<number> {
    let restartedCount = 0;

    for (const [id, workerInfo] of this.workers.entries()) {
      if (workerInfo.status === 'failed' || workerInfo.status === 'terminated') {
        this.logger.log(`重启工作线程 ${id}...`);

        try {
          // 终止旧的工作线程
          await workerInfo.worker.terminate();

          // 创建新的工作线程
          await this.createWorker(id);
          restartedCount++;
        } catch (error) {
          this.logger.error(`重启工作线程 ${id} 失败: ${error.message}`, error.stack);
        }
      }
    }

    if (restartedCount > 0) {
      this.logger.log(`✓ 已重启 ${restartedCount} 个工作线程`);
    }

    return restartedCount;
  }
}

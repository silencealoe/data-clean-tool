/**
 * 轮询工具类
 * 提供任务状态轮询和管理功能
 */

import type { TaskStatusResponse, TaskStatus } from '../types/api';
import { apiClient } from '../services/api-client';

export interface PollingOptions {
  interval?: number; // 轮询间隔，默认2000ms
  maxAttempts?: number; // 最大轮询次数，默认无限制
  onProgress?: (status: TaskStatusResponse) => void; // 进度回调
  onComplete?: (status: TaskStatusResponse) => void; // 完成回调
  onError?: (error: Error) => void; // 错误回调
  onTimeout?: () => void; // 超时回调
}

export interface PollingController {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  getCurrentStatus(): TaskStatusResponse | null;
}

/**
 * 任务状态轮询器
 */
export class TaskStatusPoller implements PollingController {
  private taskId: string;
  private options: Required<PollingOptions>;
  private intervalId: NodeJS.Timeout | null = null;
  private attemptCount = 0;
  private currentStatus: TaskStatusResponse | null = null;
  private isPolling = false;

  constructor(taskId: string, options: PollingOptions = {}) {
    this.taskId = taskId;
    this.options = {
      interval: options.interval ?? 2000,
      maxAttempts: options.maxAttempts ?? Infinity,
      onProgress: options.onProgress ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
      onError: options.onError ?? (() => {}),
      onTimeout: options.onTimeout ?? (() => {}),
    };
  }

  /**
   * 开始轮询
   */
  start(): void {
    if (this.isPolling) {
      console.warn('Polling is already running');
      return;
    }

    this.isPolling = true;
    this.attemptCount = 0;
    console.log(`Starting polling for task ${this.taskId}`);
    
    // 立即执行一次
    this.poll();
    
    // 设置定时轮询
    this.intervalId = setInterval(() => {
      this.poll();
    }, this.options.interval);
  }

  /**
   * 停止轮询
   */
  stop(): void {
    if (!this.isPolling) {
      return;
    }

    console.log(`Stopping polling for task ${this.taskId}`);
    this.isPolling = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * 检查是否正在轮询
   */
  isRunning(): boolean {
    return this.isPolling;
  }

  /**
   * 获取当前状态
   */
  getCurrentStatus(): TaskStatusResponse | null {
    return this.currentStatus;
  }

  /**
   * 执行单次轮询
   */
  private async poll(): Promise<void> {
    if (!this.isPolling) {
      return;
    }

    this.attemptCount++;

    // 检查是否超过最大尝试次数
    if (this.attemptCount > this.options.maxAttempts) {
      console.warn(`Polling timeout after ${this.attemptCount} attempts`);
      this.stop();
      this.options.onTimeout();
      return;
    }

    try {
      const status = await apiClient.checkTaskStatus(this.taskId);
      this.currentStatus = status;

      console.log(`Poll attempt ${this.attemptCount}: ${status.status} (${status.progress}%)`);

      // 调用进度回调
      this.options.onProgress(status);

      // 检查是否完成
      if (this.isTerminalStatus(status.status)) {
        console.log(`Task ${this.taskId} reached terminal status: ${status.status}`);
        this.stop();
        this.options.onComplete(status);
      }

    } catch (error) {
      console.error(`Polling error for task ${this.taskId}:`, error);
      this.options.onError(error as Error);
      
      // 继续轮询，除非是致命错误
      if (this.isFatalError(error as Error)) {
        this.stop();
      }
    }
  }

  /**
   * 检查是否为终端状态
   */
  private isTerminalStatus(status: TaskStatus): boolean {
    return ['completed', 'failed', 'timeout'].includes(status);
  }

  /**
   * 检查是否为致命错误
   */
  private isFatalError(error: Error): boolean {
    // 404错误表示任务不存在，应该停止轮询
    return error.message.includes('404') || error.message.includes('Not Found');
  }
}

/**
 * 创建任务状态轮询器的便捷函数
 */
export function createTaskPoller(taskId: string, options?: PollingOptions): TaskStatusPoller {
  return new TaskStatusPoller(taskId, options);
}

/**
 * 轮询直到任务完成的Promise包装器
 */
export function pollUntilComplete(
  taskId: string, 
  options?: Omit<PollingOptions, 'onComplete' | 'onError'>
): Promise<TaskStatusResponse> {
  return new Promise((resolve, reject) => {
    const poller = new TaskStatusPoller(taskId, {
      ...options,
      onComplete: (status) => {
        resolve(status);
      },
      onError: (error) => {
        reject(error);
      },
      onTimeout: () => {
        reject(new Error(`Polling timeout for task ${taskId}`));
      }
    });

    poller.start();
  });
}

/**
 * 状态管理工具类
 */
export class TaskStatusManager {
  private pollers = new Map<string, TaskStatusPoller>();

  /**
   * 开始监控任务
   */
  startMonitoring(taskId: string, options?: PollingOptions): TaskStatusPoller {
    // 如果已经在监控，先停止
    this.stopMonitoring(taskId);

    const poller = new TaskStatusPoller(taskId, options);
    this.pollers.set(taskId, poller);
    poller.start();

    return poller;
  }

  /**
   * 停止监控任务
   */
  stopMonitoring(taskId: string): void {
    const poller = this.pollers.get(taskId);
    if (poller) {
      poller.stop();
      this.pollers.delete(taskId);
    }
  }

  /**
   * 停止所有监控
   */
  stopAllMonitoring(): void {
    for (const [taskId, poller] of this.pollers.entries()) {
      poller.stop();
    }
    this.pollers.clear();
  }

  /**
   * 获取正在监控的任务列表
   */
  getMonitoringTasks(): string[] {
    return Array.from(this.pollers.keys());
  }

  /**
   * 获取任务的当前状态
   */
  getTaskStatus(taskId: string): TaskStatusResponse | null {
    const poller = this.pollers.get(taskId);
    return poller?.getCurrentStatus() ?? null;
  }

  /**
   * 检查任务是否正在监控
   */
  isMonitoring(taskId: string): boolean {
    const poller = this.pollers.get(taskId);
    return poller?.isRunning() ?? false;
  }
}

// 创建全局状态管理器实例
export const taskStatusManager = new TaskStatusManager();

// 页面卸载时清理所有轮询
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    taskStatusManager.stopAllMonitoring();
  });
}
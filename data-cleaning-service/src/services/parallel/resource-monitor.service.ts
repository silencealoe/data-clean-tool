/**
 * ResourceMonitor Service
 * 
 * 监控系统资源使用情况并实施资源限制
 * 
 * 职责：
 * - 实时监控内存使用情况
 * - 实时监控 CPU 使用情况
 * - 检查资源是否超过配置的限制
 * - 在资源超限时提供告警和控制机制
 * - 验证资源使用边界（属性 7）
 */

import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';

/**
 * 资源使用情况
 */
export interface ResourceUsage {
    /** 内存使用（MB） */
    memoryUsageMB: number;

    /** 内存使用百分比 */
    memoryUsagePercentage: number;

    /** CPU 使用率 (0-100) */
    cpuUsage: number;

    /** 是否超过内存限制 */
    isMemoryExceeded: boolean;

    /** 是否超过 CPU 限制 */
    isCpuExceeded: boolean;

    /** 时间戳 */
    timestamp: number;
}

/**
 * 资源限制配置
 */
export interface ResourceLimits {
    /** 最大内存使用（MB），默认 1800MB */
    maxMemoryMB: number;

    /** 最大 CPU 使用率 (0-100)，默认 95% */
    maxCpuUsage?: number;

    /** 内存警告阈值（MB），默认 1500MB */
    memoryWarningThresholdMB?: number;
}

/**
 * 资源监控状态
 */
export interface ResourceMonitorStatus {
    /** 是否正在监控 */
    isMonitoring: boolean;

    /** 当前资源使用情况 */
    currentUsage: ResourceUsage;

    /** 资源限制配置 */
    limits: ResourceLimits;

    /** 是否应该暂停工作线程创建 */
    shouldPauseWorkerCreation: boolean;

    /** 警告消息列表 */
    warnings: string[];
}

@Injectable()
export class ResourceMonitorService {
    private readonly logger = new Logger(ResourceMonitorService.name);

    // 资源限制配置
    private limits: ResourceLimits = {
        maxMemoryMB: 1800,
        maxCpuUsage: 95,
        memoryWarningThresholdMB: 1500,
    };

    // 监控状态
    private isMonitoring: boolean = false;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private monitoringIntervalMs: number = 1000; // 默认每秒检查一次

    // CPU 基线（用于计算 CPU 使用率）
    private baselineCpuUsage: NodeJS.CpuUsage | null = null;
    private lastCpuCheck: number = 0;

    // 当前资源使用情况
    private currentUsage: ResourceUsage | null = null;

    // 警告和告警
    private warnings: string[] = [];
    private lastWarningTime: number = 0;
    private warningCooldownMs: number = 5000; // 警告冷却时间 5 秒

    // 资源超限计数器
    private memoryExceededCount: number = 0;
    private cpuExceededCount: number = 0;
    private consecutiveExceededThreshold: number = 3; // 连续超限 3 次才触发暂停

    /**
     * 配置资源限制
     * @param limits - 资源限制配置
     */
    configureLimits(limits: Partial<ResourceLimits>): void {
        this.limits = {
            ...this.limits,
            ...limits,
        };

        // 设置默认警告阈值为最大值的 80%
        if (!this.limits.memoryWarningThresholdMB) {
            this.limits.memoryWarningThresholdMB = this.limits.maxMemoryMB * 0.8;
        }

        this.logger.log(
            `资源限制已配置: 最大内存=${this.limits.maxMemoryMB}MB, ` +
            `警告阈值=${this.limits.memoryWarningThresholdMB}MB, ` +
            `最大CPU=${this.limits.maxCpuUsage}%`,
        );
    }

    /**
     * 开始资源监控
     * @param intervalMs - 监控间隔（毫秒），默认 1000
     */
    startMonitoring(intervalMs: number = 1000): void {
        if (this.isMonitoring) {
            this.logger.warn('资源监控已在运行中');
            return;
        }

        this.monitoringIntervalMs = intervalMs;
        this.isMonitoring = true;
        this.warnings = [];
        this.memoryExceededCount = 0;
        this.cpuExceededCount = 0;

        // 设置 CPU 基线
        this.baselineCpuUsage = process.cpuUsage();
        this.lastCpuCheck = Date.now();

        // 立即检查一次
        this.checkResources();

        // 开始定期检查
        this.monitoringInterval = setInterval(() => {
            this.checkResources();
        }, this.monitoringIntervalMs);

        this.logger.log(`资源监控已启动: 间隔=${intervalMs}ms`);
    }

    /**
     * 停止资源监控
     */
    stopMonitoring(): void {
        if (!this.isMonitoring) {
            this.logger.warn('资源监控未运行');
            return;
        }

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        this.isMonitoring = false;

        this.logger.log('资源监控已停止');
    }

    /**
     * 检查资源使用情况
     * @returns 当前资源使用情况
     */
    checkResources(): ResourceUsage {
        const memoryUsage = this.getMemoryUsage();
        const cpuUsage = this.getCPUUsage();

        const usage: ResourceUsage = {
            memoryUsageMB: memoryUsage.usedMB,
            memoryUsagePercentage: memoryUsage.percentage,
            cpuUsage,
            isMemoryExceeded: memoryUsage.usedMB > this.limits.maxMemoryMB,
            isCpuExceeded: this.limits.maxCpuUsage
                ? cpuUsage > this.limits.maxCpuUsage
                : false,
            timestamp: Date.now(),
        };

        this.currentUsage = usage;

        // 检查是否超限
        this.checkLimits(usage);

        return usage;
    }

    /**
     * 获取内存使用情况
     * @returns 内存使用信息
     */
    private getMemoryUsage(): { usedMB: number; percentage: number } {
        const memUsage = process.memoryUsage();
        const totalMemory = os.totalmem();

        const usedMB = memUsage.rss / 1024 / 1024;
        const percentage = (memUsage.rss / totalMemory) * 100;

        return { usedMB, percentage };
    }

    /**
     * 获取 CPU 使用率
     * @returns CPU 使用率 (0-100)
     */
    private getCPUUsage(): number {
        if (!this.baselineCpuUsage) {
            this.baselineCpuUsage = process.cpuUsage();
            this.lastCpuCheck = Date.now();
            return 0;
        }

        const currentCpuUsage = process.cpuUsage(this.baselineCpuUsage);
        const elapsedTime = Date.now() - this.lastCpuCheck;

        // 计算用户态和系统态 CPU 时间（微秒）
        const totalCpuTime = currentCpuUsage.user + currentCpuUsage.system;

        // 转换为百分比
        const elapsedMicroseconds = elapsedTime * 1000;
        const cpuPercentage = elapsedMicroseconds > 0
            ? (totalCpuTime / elapsedMicroseconds) * 100
            : 0;

        // 更新基线
        this.baselineCpuUsage = process.cpuUsage();
        this.lastCpuCheck = Date.now();

        return Math.min(100, Math.max(0, cpuPercentage));
    }

    /**
     * 检查资源限制
     * @param usage - 资源使用情况
     */
    private checkLimits(usage: ResourceUsage): void {
        // 检查内存使用
        if (usage.isMemoryExceeded) {
            this.memoryExceededCount++;

            if (this.memoryExceededCount >= this.consecutiveExceededThreshold) {
                this.addWarning(
                    `内存使用超限: ${usage.memoryUsageMB.toFixed(1)}MB > ${this.limits.maxMemoryMB}MB ` +
                    `(连续 ${this.memoryExceededCount} 次)`,
                    'error',
                );
            }
        } else {
            // 重置计数器
            if (this.memoryExceededCount > 0) {
                this.logger.log('内存使用已恢复正常');
                this.memoryExceededCount = 0;
            }

            // 检查警告阈值
            if (
                this.limits.memoryWarningThresholdMB &&
                usage.memoryUsageMB > this.limits.memoryWarningThresholdMB
            ) {
                this.addWarning(
                    `内存使用接近限制: ${usage.memoryUsageMB.toFixed(1)}MB ` +
                    `(警告阈值: ${this.limits.memoryWarningThresholdMB}MB)`,
                    'warn',
                );
            }
        }

        // 检查 CPU 使用
        if (usage.isCpuExceeded) {
            this.cpuExceededCount++;

            if (this.cpuExceededCount >= this.consecutiveExceededThreshold) {
                this.addWarning(
                    `CPU 使用超限: ${usage.cpuUsage.toFixed(1)}% > ${this.limits.maxCpuUsage}% ` +
                    `(连续 ${this.cpuExceededCount} 次)`,
                    'warn',
                );
            }
        } else {
            if (this.cpuExceededCount > 0) {
                this.cpuExceededCount = 0;
            }
        }
    }

    /**
     * 添加警告消息
     * @param message - 警告消息
     * @param level - 日志级别
     */
    private addWarning(message: string, level: 'warn' | 'error' = 'warn'): void {
        const now = Date.now();

        // 检查冷却时间
        if (now - this.lastWarningTime < this.warningCooldownMs) {
            return;
        }

        this.warnings.push(message);
        this.lastWarningTime = now;

        // 限制警告数量
        if (this.warnings.length > 100) {
            this.warnings = this.warnings.slice(-50);
        }

        // 记录日志
        if (level === 'error') {
            this.logger.error(message);
        } else {
            this.logger.warn(message);
        }
    }

    /**
     * 是否应该暂停工作线程创建
     * @returns true 如果应该暂停
     */
    shouldPauseWorkerCreation(): boolean {
        if (!this.currentUsage) {
            return false;
        }

        // 如果内存连续超限，暂停工作线程创建
        return this.memoryExceededCount >= this.consecutiveExceededThreshold;
    }

    /**
     * 获取当前资源使用情况
     * @returns 当前资源使用情况，如果未监控则返回 null
     */
    getCurrentUsage(): ResourceUsage | null {
        return this.currentUsage;
    }

    /**
     * 获取监控状态
     * @returns 资源监控状态
     */
    getStatus(): ResourceMonitorStatus {
        const currentUsage = this.currentUsage || {
            memoryUsageMB: 0,
            memoryUsagePercentage: 0,
            cpuUsage: 0,
            isMemoryExceeded: false,
            isCpuExceeded: false,
            timestamp: Date.now(),
        };

        return {
            isMonitoring: this.isMonitoring,
            currentUsage,
            limits: this.limits,
            shouldPauseWorkerCreation: this.shouldPauseWorkerCreation(),
            warnings: [...this.warnings],
        };
    }

    /**
     * 清除警告
     */
    clearWarnings(): void {
        this.warnings = [];
        this.logger.log('警告已清除');
    }

    /**
     * 验证内存使用是否在限制范围内（属性 7）
     * @returns true 如果内存使用在限制范围内
     */
    isMemoryWithinLimits(): boolean {
        if (!this.currentUsage) {
            return true;
        }

        return this.currentUsage.memoryUsageMB <= this.limits.maxMemoryMB;
    }

    /**
     * 等待内存释放
     * @param timeoutMs - 超时时间（毫秒），默认 30000
     * @returns Promise，在内存释放或超时时解析
     */
    async waitForMemoryRelease(timeoutMs: number = 30000): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const usage = this.checkResources();

            if (!usage.isMemoryExceeded) {
                this.logger.log('内存已释放');
                return true;
            }

            // 等待 1 秒后重试
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.logger.warn(`等待内存释放超时: ${timeoutMs}ms`);
        return false;
    }

    /**
     * 获取系统信息
     * @returns 系统信息
     */
    getSystemInfo(): {
        totalMemoryMB: number;
        freeMemoryMB: number;
        cpuCount: number;
        platform: string;
        nodeVersion: string;
    } {
        const totalMemory = os.totalmem() / 1024 / 1024;
        const freeMemory = os.freemem() / 1024 / 1024;
        const cpuCount = os.cpus().length;

        return {
            totalMemoryMB: totalMemory,
            freeMemoryMB: freeMemory,
            cpuCount,
            platform: os.platform(),
            nodeVersion: process.version,
        };
    }
}

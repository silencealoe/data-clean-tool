import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProcessingTask } from '../../common/types/queue.types';

/**
 * 错误类型枚举
 * 需求：8.4 - 系统应区分可重试错误（网络问题）和永久错误（无效文件格式）
 */
export enum ErrorType {
    RETRYABLE_NETWORK = 'retryable_network',
    RETRYABLE_RESOURCE = 'retryable_resource',
    PERMANENT_FORMAT = 'permanent_format',
    PERMANENT_BUSINESS = 'permanent_business',
    PERMANENT_PERMISSION = 'permanent_permission'
}

/**
 * 错误详情接口
 */
export interface ErrorDetails {
    taskId: string;
    errorType: ErrorType;
    errorMessage: string;
    stackTrace?: string;
    timestamp: Date;
    fileInfo: {
        fileName: string;
        fileSize: number;
        filePath: string;
    };
    retryCount: number;
}

/**
 * 错误处理器接口
 */
export interface ErrorHandlerInterface {
    classifyError(error: Error): ErrorType;
    shouldRetry(error: Error, retryCount: number): boolean;
    calculateRetryDelay(retryCount: number): number;
    handlePermanentFailure(task: ProcessingTask, error: Error): Promise<void>;
    logError(errorDetails: ErrorDetails): Promise<void>;
}

/**
 * 错误处理服务
 * 负责错误分类、重试逻辑和错误记录
 * 
 * 需求：8.1, 8.2, 8.3, 8.4, 8.5
 */
@Injectable()
export class ErrorHandlerService implements ErrorHandlerInterface {
    private readonly logger = new Logger(ErrorHandlerService.name);
    private readonly maxRetries: number;
    private readonly baseDelay: number;
    private readonly systemErrorNotificationThreshold: number;

    constructor(private readonly configService: ConfigService) {
        // 从配置获取重试参数
        const queueConfig = this.configService.get('queue');
        this.maxRetries = queueConfig?.maxRetries || 3;
        this.baseDelay = queueConfig?.baseRetryDelay || 1000; // 1秒
        this.systemErrorNotificationThreshold = queueConfig?.systemErrorNotificationThreshold || 5;
    }

    /**
     * 错误分类
     * 需求：8.4 - 系统应区分可重试错误（网络问题）和永久错误（无效文件格式）
     */
    classifyError(error: Error): ErrorType {
        const message = error.message.toLowerCase();
        const stack = error.stack?.toLowerCase() || '';

        // 网络相关错误 - 可重试
        if (this.isNetworkError(message, stack)) {
            return ErrorType.RETRYABLE_NETWORK;
        }

        // 资源相关错误 - 可重试
        if (this.isResourceError(message, stack)) {
            return ErrorType.RETRYABLE_RESOURCE;
        }

        // 权限错误 - 永久
        if (this.isPermissionError(message, stack)) {
            return ErrorType.PERMANENT_PERMISSION;
        }

        // 文件格式错误 - 永久
        if (this.isFormatError(message, stack)) {
            return ErrorType.PERMANENT_FORMAT;
        }

        // 默认为业务逻辑错误（永久）
        return ErrorType.PERMANENT_BUSINESS;
    }

    /**
     * 判断是否应该重试
     * 需求：8.2 - 当文件处理因临时问题失败时，系统应支持可配置限制的自动重试
     * 需求：8.5 - 当超过重试限制时，系统应将任务标记为永久失败
     */
    shouldRetry(error: Error, retryCount: number): boolean {
        // 检查重试次数限制
        if (retryCount >= this.maxRetries) {
            this.logger.warn(`Max retry attempts (${this.maxRetries}) reached for error: ${error.message}`);
            return false;
        }

        // 只有可重试的错误类型才进行重试
        const errorType = this.classifyError(error);
        const isRetryable = errorType === ErrorType.RETRYABLE_NETWORK ||
            errorType === ErrorType.RETRYABLE_RESOURCE;

        if (!isRetryable) {
            this.logger.debug(`Error type ${errorType} is not retryable: ${error.message}`);
        }

        return isRetryable;
    }

    /**
     * 计算重试延迟（指数退避）
     * 需求：8.1 - 当Redis连接失败时，系统应使用指数退避算法重试连接直到最大尝试次数
     * 需求：8.3 - 当任务永久失败时，系统应存储错误详情并通知管理员
     */
    calculateRetryDelay(retryCount: number): number {
        // 指数退避：1s, 2s, 4s, 8s, 16s...
        const delay = this.baseDelay * Math.pow(2, retryCount);

        // 设置最大延迟上限（5分钟）
        const maxDelay = 5 * 60 * 1000;
        const finalDelay = Math.min(delay, maxDelay);

        this.logger.debug(`Calculated retry delay: ${finalDelay}ms for retry count: ${retryCount}`);
        return finalDelay;
    }

    /**
     * 处理永久失败
     * 需求：8.3 - 当任务永久失败时，系统应存储错误详情并通知管理员
     */
    async handlePermanentFailure(task: ProcessingTask, error: Error): Promise<void> {
        const errorDetails: ErrorDetails = {
            taskId: task.taskId,
            errorType: this.classifyError(error),
            errorMessage: error.message,
            stackTrace: error.stack,
            timestamp: new Date(),
            fileInfo: {
                fileName: task.originalFileName,
                fileSize: task.fileSize,
                filePath: task.filePath
            },
            retryCount: task.retryCount
        };

        // 记录详细错误信息
        await this.logError(errorDetails);

        // 如果是系统级错误，通知管理员
        if (this.isSystemError(errorDetails.errorType)) {
            await this.notifyAdministrators(errorDetails);
        }

        this.logger.error(`Permanent failure handled for task ${task.taskId}: ${error.message}`);
    }

    /**
     * 记录错误详情
     */
    async logError(errorDetails: ErrorDetails): Promise<void> {
        try {
            // 记录到应用日志
            this.logger.error('Task processing error details:', {
                taskId: errorDetails.taskId,
                errorType: errorDetails.errorType,
                errorMessage: errorDetails.errorMessage,
                fileName: errorDetails.fileInfo.fileName,
                fileSize: errorDetails.fileInfo.fileSize,
                retryCount: errorDetails.retryCount,
                timestamp: errorDetails.timestamp.toISOString()
            });

            // TODO: 可以扩展为写入数据库或外部日志系统
            // await this.writeToErrorLog(errorDetails);

        } catch (logError) {
            this.logger.error('Failed to log error details:', logError);
        }
    }

    /**
     * 通知管理员
     */
    private async notifyAdministrators(errorDetails: ErrorDetails): Promise<void> {
        try {
            // 记录系统级错误通知
            this.logger.warn('System error notification:', {
                taskId: errorDetails.taskId,
                errorType: errorDetails.errorType,
                errorMessage: errorDetails.errorMessage,
                fileName: errorDetails.fileInfo.fileName,
                timestamp: errorDetails.timestamp.toISOString()
            });

            // TODO: 实现实际的通知机制
            // - 发送邮件
            // - 发送Slack消息
            // - 写入监控系统
            // await this.sendEmailNotification(errorDetails);
            // await this.sendSlackNotification(errorDetails);

        } catch (notificationError) {
            this.logger.error('Failed to notify administrators:', notificationError);
        }
    }

    /**
     * 判断是否为系统级错误
     */
    private isSystemError(errorType: ErrorType): boolean {
        return errorType === ErrorType.PERMANENT_PERMISSION ||
            errorType === ErrorType.RETRYABLE_RESOURCE;
    }

    /**
     * 判断是否为网络错误
     */
    private isNetworkError(message: string, stack: string): boolean {
        const networkKeywords = [
            'econnreset',
            'etimedout',
            'enotfound',
            'econnrefused',
            'connection',
            'redis',
            'timeout',
            'network',
            'socket',
            'dns'
        ];

        return networkKeywords.some(keyword =>
            message.includes(keyword) || stack.includes(keyword)
        );
    }

    /**
     * 判断是否为资源错误
     */
    private isResourceError(message: string, stack: string): boolean {
        const resourceKeywords = [
            'enomem',
            'enospc',
            'memory',
            'disk space',
            'out of memory',
            'insufficient',
            'resource',
            'quota exceeded'
        ];

        return resourceKeywords.some(keyword =>
            message.includes(keyword) || stack.includes(keyword)
        );
    }

    /**
     * 判断是否为权限错误
     */
    private isPermissionError(message: string, stack: string): boolean {
        const permissionKeywords = [
            'eacces',
            'eperm',
            'permission',
            'access denied',
            'unauthorized',
            'forbidden',
            'not allowed'
        ];

        return permissionKeywords.some(keyword =>
            message.includes(keyword) || stack.includes(keyword)
        );
    }

    /**
     * 判断是否为文件格式错误
     */
    private isFormatError(message: string, stack: string): boolean {
        const formatKeywords = [
            'unsupported file',
            'invalid format',
            'corrupted',
            'file not found',
            'malformed',
            'parse error',
            'invalid csv',
            'invalid excel',
            'encoding error'
        ];

        return formatKeywords.some(keyword =>
            message.includes(keyword) || stack.includes(keyword)
        );
    }

    /**
     * 获取错误统计信息
     */
    getErrorStats(): {
        maxRetries: number;
        baseDelay: number;
        systemErrorThreshold: number;
    } {
        return {
            maxRetries: this.maxRetries,
            baseDelay: this.baseDelay,
            systemErrorThreshold: this.systemErrorNotificationThreshold
        };
    }

    /**
     * 创建错误摘要
     */
    createErrorSummary(error: Error, task: ProcessingTask): string {
        const errorType = this.classifyError(error);
        const isRetryable = this.shouldRetry(error, task.retryCount);

        return `Task ${task.taskId} failed with ${errorType} error: ${error.message}. ` +
            `Retryable: ${isRetryable}, Retry count: ${task.retryCount}/${this.maxRetries}`;
    }
}
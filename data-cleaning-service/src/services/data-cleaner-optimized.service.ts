import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
    ParsedData,
    CleaningResult,
    CleanedRow,
    ExceptionRow,
    RowData,
    ColumnTypeMap,
    ColumnType,
    FieldError,
    Statistics,
    CleanResult,
    AddressComponents
} from '../common/types';
import { PhoneCleanerService } from './phone-cleaner.service';
import { DateCleanerService } from './date-cleaner.service';
import { AddressCleanerService } from './address-cleaner.service';
import { StreamParserService, StreamStatistics } from './stream-parser.service';
import { DatabasePersistenceService } from './database-persistence.service';
import { ProgressTrackerService as AsyncProgressTrackerService } from './progress-tracker.service';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 高性能批次配置
 * 大幅优化批次大小和更新频率，目标：20秒处理10MB文件
 */
const BATCH_SIZE = 20000; // 大批次减少数据库I/O
const PROGRESS_UPDATE_INTERVAL = 50000; // 进度更新间隔：每50000行
const PROGRESS_TIME_INTERVAL = 3000; // 时间间隔：每3秒
const MEMORY_CLEANUP_INTERVAL = 100000; // 内存清理间隔：每100000行

/**
 * 高性能数据清洗服务
 * 针对大文件处理进行深度优化
 */
@Injectable()
export class DataCleanerOptimizedService {
    private readonly logger = new Logger(DataCleanerOptimizedService.name);

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly phoneCleaner: PhoneCleanerService,
        private readonly dateCleaner: DateCleanerService,
        private readonly addressCleaner: AddressCleanerService,
        private readonly streamParser: StreamParserService,
        private readonly databasePersistence: DatabasePersistenceService,
        private readonly progressTracker: AsyncProgressTrackerService,
    ) {
        this.logger.log('高性能数据清洗服务已初始化');
    }

    /**
     * 高性能流式清洗数据
     * @param filePath 文件路径
     * @param jobId 任务ID
     * @returns StreamCleaningResult 包含统计信息
     */
    async cleanDataStreamOptimized(filePath: string, jobId: string): Promise<{
        jobId: string;
        statistics: StreamStatistics;
        performanceMetrics?: any;
    }> {
        this.logger.log(`开始高性能数据清洗任务: ${jobId}, 文件: ${filePath}`);

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }

        // 初始化进度跟踪
        await this.progressTracker.initializeProgress(jobId, 0, 'estimating');

        // 快速估算文件行数
        const estimatedRows = await this.estimateFileRows(filePath);
        this.logger.log(`文件行数估算: ${estimatedRows.toLocaleString()} 行`);

        // 更新进度跟踪器的总行数估算
        await this.progressTracker.updateProgress(jobId, {
            totalRows: estimatedRows,
            currentPhase: 'preparing'
        });

        return await this.cleanDataStreamSequentialOptimized(filePath, jobId);
    }

    /**
     * 高性能顺序流式清洗数据
     * @param filePath 文件路径
     * @param jobId 任务ID
     * @returns StreamCleaningResult 包含统计信息
     */
    private async cleanDataStreamSequentialOptimized(filePath: string, jobId: string): Promise<{
        jobId: string;
        statistics: StreamStatistics;
        performanceMetrics?: any;
    }> {
        this.logger.log(`开始高性能顺序流式数据清洗任务: ${jobId}`);

        // 初始化进度跟踪
        await this.progressTracker.updatePhase(jobId, 'initializing');

        // 初始化批次 - 使用更大的批次
        let cleanBatch: any[] = [];
        let errorBatch: any[] = [];
        let columnTypes: ColumnTypeMap = {};

        // 统计信息
        let totalRows = 0;
        let cleanedRows = 0;
        let exceptionRows = 0;

        // 性能监控
        const startTime = Date.now();
        let lastLogTime = startTime;
        let lastProgressUpdate = startTime;
        let processedSinceLastLog = 0;

        // 根据文件扩展名选择解析器
        const fileExtension = path.extname(filePath).toLowerCase();

        try {
            // 更新进度：开始文件解析
            await this.progressTracker.updatePhase(jobId, 'parsing');

            const processRow = async (row: RowData, types: ColumnTypeMap) => {
                // 保存列类型并初始化进度
                if (Object.keys(types).length > 0 && Object.keys(columnTypes).length === 0) {
                    columnTypes = types;
                    this.logger.log(`列类型已识别: ${JSON.stringify(columnTypes)}`);
                    await this.progressTracker.updatePhase(jobId, 'cleaning');
                }

                totalRows++;
                processedSinceLastLog++;

                // 优化的进度更新逻辑
                const currentTime = Date.now();
                const shouldUpdateProgress = totalRows % PROGRESS_UPDATE_INTERVAL === 0 ||
                    (currentTime - lastProgressUpdate) > PROGRESS_TIME_INTERVAL;

                if (shouldUpdateProgress) {
                    const timeSinceLastLog = currentTime - lastLogTime;
                    const rowsPerSecond = (processedSinceLastLog / timeSinceLastLog) * 1000;
                    const totalElapsed = (currentTime - startTime) / 1000;

                    this.logger.log(
                        `🚀 高性能处理进度: ${totalRows.toLocaleString()} 行, ` +
                        `速度: ${rowsPerSecond.toFixed(0)} 行/秒, ` +
                        `已用时间: ${totalElapsed.toFixed(1)} 秒, ` +
                        `清洁: ${cleanedRows.toLocaleString()}, 异常: ${exceptionRows.toLocaleString()}`
                    );

                    // 更新进度跟踪器 - 只传递处理行数，不修改总行数
                    await this.progressTracker.updateProgress(jobId, {
                        processedRows: totalRows,
                        currentPhase: 'cleaning'
                        // 注意：不传递 totalRows，避免动态调整导致进度倒退
                    });

                    lastLogTime = currentTime;
                    lastProgressUpdate = currentTime;
                    processedSinceLastLog = 0;
                }

                // 内存清理
                if (totalRows % MEMORY_CLEANUP_INTERVAL === 0) {
                    if (global.gc) {
                        global.gc();
                        this.logger.debug(`内存清理完成，处理行数: ${totalRows}`);
                    }
                }

                // 快速数据清洗（简化版本）
                const cleanedRow = this.cleanRowFast(row, columnTypes);

                // 累积到批次
                if (cleanedRow.errors.length === 0) {
                    cleanedRows++;
                    cleanBatch.push(this.mapToCleanDataEntityFast(jobId, cleanedRow.rowNumber, cleanedRow.cleanedData));
                } else {
                    exceptionRows++;
                    const errorSummary = cleanedRow.errors
                        .map(err => `${err.field}: ${err.errorMessage}`)
                        .join('; ');

                    errorBatch.push({
                        jobId,
                        rowNumber: cleanedRow.rowNumber,
                        originalData: cleanedRow.originalData,
                        errors: JSON.stringify(cleanedRow.errors),
                        errorSummary,
                    });
                }

                // 大批次数据库插入
                if (cleanBatch.length >= BATCH_SIZE) {
                    await this.progressTracker.updatePhase(jobId, 'saving_batch', totalRows);

                    // 使用优化的批量插入
                    await this.databasePersistence.batchInsertCleanData(cleanBatch, BATCH_SIZE);
                    this.logger.debug(`高性能批量插入清洁数据: ${cleanBatch.length}条`);
                    cleanBatch = [];

                    await this.progressTracker.updatePhase(jobId, 'cleaning', totalRows);
                }

                if (errorBatch.length >= BATCH_SIZE) {
                    await this.databasePersistence.batchInsertErrorLogs(errorBatch, BATCH_SIZE);
                    this.logger.debug(`高性能批量插入错误日志: ${errorBatch.length}条`);
                    errorBatch = [];
                }
            };

            // 根据文件类型处理
            if (fileExtension === '.csv') {
                await this.streamParser.parseCsvStream(
                    filePath,
                    processRow,
                    (stats) => {
                        this.logger.log(`CSV流式解析完成，总行数: ${stats.totalRows}`);
                    },
                    (error: Error, rowNumber: number) => {
                        this.logger.error(`处理第${rowNumber}行时出错: ${error.message}`);
                    },
                );
            } else {
                await this.streamParser.parseExcelStream(
                    filePath,
                    processRow,
                    (stats) => {
                        this.logger.log(`Excel流式解析完成，总行数: ${stats.totalRows}`);
                    },
                    (error: Error, rowNumber: number) => {
                        this.logger.error(`处理第${rowNumber}行时出错: ${error.message}`);
                    },
                );
            }

            // 更新进度：保存剩余数据
            await this.progressTracker.updatePhase(jobId, 'finalizing', totalRows);

            // 插入剩余的批次
            if (cleanBatch.length > 0) {
                await this.databasePersistence.batchInsertCleanData(cleanBatch, cleanBatch.length);
                this.logger.log(`批量插入剩余清洁数据: ${cleanBatch.length}条`);
            }

            if (errorBatch.length > 0) {
                await this.databasePersistence.batchInsertErrorLogs(errorBatch, errorBatch.length);
                this.logger.log(`批量插入剩余错误日志: ${errorBatch.length}条`);
            }

            // 统计信息
            const statistics: StreamStatistics = {
                totalRows,
                processedRows: cleanedRows,
                errorRows: exceptionRows,
            };

            const totalTime = (Date.now() - startTime) / 1000;
            const avgSpeed = totalRows / totalTime;

            this.logger.log(
                `🎉 高性能数据清洗完成: ${jobId}, ` +
                `总行数: ${statistics.totalRows.toLocaleString()}, ` +
                `清洁数据: ${statistics.processedRows.toLocaleString()}行, ` +
                `异常数据: ${statistics.errorRows.toLocaleString()}行, ` +
                `总耗时: ${totalTime.toFixed(2)}秒, ` +
                `平均速度: ${avgSpeed.toFixed(0)}行/秒 🚀`
            );

            // 最终进度更新：标记完成
            await this.progressTracker.markCompleted(jobId, statistics);

            return {
                jobId,
                statistics,
                performanceMetrics: {
                    processingMode: 'sequential_optimized',
                    avgThroughput: avgSpeed,
                    processingTimeMs: totalTime * 1000,
                }
            };

        } catch (error) {
            this.logger.error(`高性能数据清洗失败: ${error.message}`, error.stack);
            await this.progressTracker.markFailed(jobId, error.message);
            throw error;
        }
    }

    /**
     * 快速数据清洗（简化版本）
     */
    private cleanRowFast(row: RowData, columnTypes: ColumnTypeMap): CleanedRow & { errors: FieldError[] } {
        const cleanedData: Record<string, any> = {};
        const errors: FieldError[] = [];

        // 快速处理每个字段
        for (const [fieldName, originalValue] of Object.entries(row.data)) {
            const columnType = columnTypes[fieldName] || ColumnType.TEXT;

            try {
                const cleanResult = this.cleanFieldFast(fieldName, originalValue, columnType);

                if (cleanResult.success) {
                    cleanedData[fieldName] = cleanResult.value;
                } else {
                    cleanedData[fieldName] = originalValue;
                    errors.push({
                        field: fieldName,
                        originalValue,
                        errorType: this.getErrorType(columnType),
                        errorMessage: cleanResult.error || 'Unknown error',
                    });
                }
            } catch (error) {
                cleanedData[fieldName] = originalValue;
                errors.push({
                    field: fieldName,
                    originalValue,
                    errorType: 'PROCESSING_ERROR',
                    errorMessage: `Processing error: ${error.message}`,
                });
            }
        }

        return {
            rowNumber: row.rowNumber,
            originalData: row.data,
            cleanedData,
            errors,
        };
    }

    /**
     * 快速字段清洗
     */
    private cleanFieldFast(fieldName: string, value: any, columnType: ColumnType): CleanResult<any> {
        // 空值处理
        if (value === null || value === undefined || value === '') {
            return { success: true, value: value };
        }

        // 快速清洗逻辑
        switch (columnType) {
            case ColumnType.PHONE:
                return this.phoneCleaner.cleanPhone(value);
            case ColumnType.DATE:
                return this.dateCleaner.cleanDate(value);
            case ColumnType.ADDRESS:
                return this.addressCleaner.cleanAddress(value);
            case ColumnType.NUMBER:
                return this.cleanNumberFast(value);
            case ColumnType.TEXT:
            default:
                return this.cleanTextFast(value);
        }
    }

    /**
     * 快速数字清洗
     */
    private cleanNumberFast(value: any): CleanResult<number> {
        if (typeof value === 'number') {
            return { success: true, value };
        }

        const stringValue = String(value).trim().replace(/[,\s]/g, '');
        const parsed = parseFloat(stringValue);

        if (isNaN(parsed)) {
            return { success: false, error: 'Invalid number format' };
        }

        return { success: true, value: parsed };
    }

    /**
     * 快速文本清洗
     */
    private cleanTextFast(value: any): CleanResult<string> {
        return { success: true, value: String(value).trim() };
    }

    /**
     * 快速实体映射
     */
    private mapToCleanDataEntityFast(jobId: string, rowNumber: number, cleanedData: Record<string, any>): any {
        return {
            jobId,
            rowNumber,
            name: cleanedData['姓名'] || cleanedData['name'] || null,
            phone: cleanedData['手机号'] || cleanedData['phone'] || null,
            hireDate: cleanedData['生日'] || cleanedData['date'] || null,
            province: null,
            city: null,
            district: null,
            addressDetail: cleanedData['地址'] || cleanedData['address'] || null,
            additionalFields: null,
        };
    }

    /**
     * 估算文件行数
     */
    private async estimateFileRows(filePath: string): Promise<number> {
        const fileExtension = path.extname(filePath).toLowerCase();

        try {
            const stats = fs.statSync(filePath);
            const fileSizeBytes = stats.size;

            if (fileExtension === '.csv') {
                // CSV: 更精确的估算
                const estimatedRows = Math.floor(fileSizeBytes / 60); // 平均每行60字节
                return Math.floor(estimatedRows * 1.1); // 10%缓冲区
            } else {
                const estimatedRows = Math.floor(fileSizeBytes / 100);
                return Math.floor(estimatedRows * 1.1);
            }
        } catch (error) {
            this.logger.warn(`无法估算文件行数: ${error.message}，使用默认值 1000`);
            return 1000;
        }
    }

    /**
     * 获取错误类型
     */
    private getErrorType(columnType: ColumnType): string {
        switch (columnType) {
            case ColumnType.PHONE:
                return 'INVALID_PHONE';
            case ColumnType.DATE:
                return 'INVALID_DATE';
            case ColumnType.ADDRESS:
                return 'INVALID_ADDRESS';
            case ColumnType.NUMBER:
                return 'INVALID_NUMBER';
            case ColumnType.TEXT:
            default:
                return 'INVALID_TEXT';
        }
    }
}
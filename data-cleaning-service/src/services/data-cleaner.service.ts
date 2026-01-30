import { Injectable, Logger } from '@nestjs/common';
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
import { DataCleanerOptimizedService } from './data-cleaner-optimized.service';
import { ParallelProcessingManagerService } from './parallel/parallel-processing-manager.service';
import { workerThreadsConfig, shouldUseParallelProcessing } from '../config/worker-threads.config';
import { ProcessingConfig } from './parallel/types';
import { RuleEngineService } from './rule-engine/rule-engine.service';
import { StrategyRegistrationService } from './rule-engine/strategy-registration.service';
import { ConfigurationManagerService } from './rule-engine/configuration-manager.service';
import { ProgressTrackerService as AsyncProgressTrackerService } from './progress-tracker.service';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 批次配置
 * 大幅优化批次大小，提高大文件处理速度
 */
const BATCH_SIZE = 20000; // 优化：增加到20000，大幅减少数据库连接次数
const PROGRESS_UPDATE_INTERVAL = 50000; // 进度更新间隔：每50000行
const PROGRESS_TIME_INTERVAL = 5000; // 时间间隔：每5秒

/**
 * 规则引擎配置
 * 控制是否启用新的规则引擎
 */
const USE_RULE_ENGINE = process.env.USE_RULE_ENGINE === 'true' || true;

/**
 * 渐进式迁移配置
 * 控制哪些字段类型使用规则引擎处理
 */
const RULE_ENGINE_FIELD_TYPES = new Set([
    ColumnType.PHONE,
    ColumnType.DATE,
    ColumnType.ADDRESS
]);

/**
 * 迁移模式枚举
 */
enum MigrationMode {
    LEGACY_ONLY = 'legacy_only',           // 仅使用传统清洗服务
    RULE_ENGINE_ONLY = 'rule_engine_only', // 仅使用规则引擎
    HYBRID = 'hybrid',                     // 混合模式：规则引擎优先，失败时回退到传统服务
    GRADUAL = 'gradual'                    // 渐进式：特定字段类型使用规则引擎
}

/**
 * 当前迁移模式
 */
const MIGRATION_MODE = (process.env.MIGRATION_MODE as MigrationMode) || MigrationMode.GRADUAL;

/**
 * 流式清洗结果接口
 */
export interface StreamCleaningResult {
    jobId: string;
    statistics: StreamStatistics;
    performanceMetrics?: PerformanceMetrics;  // 可选：性能指标（仅并行处理时提供）
}

/**
 * 性能指标接口（用于响应）
 */
export interface PerformanceMetrics {
    processingMode: 'parallel' | 'sequential';  // 处理模式
    workerCount?: number;                       // 工作线程数（仅并行模式）
    avgCpuUsage?: number;                       // 平均 CPU 使用率（%）
    peakCpuUsage?: number;                      // 峰值 CPU 使用率（%）
    avgMemoryUsage?: number;                    // 平均内存使用（MB）
    peakMemoryUsage?: number;                   // 峰值内存使用（MB）
    avgThroughput?: number;                     // 平均吞吐量（行/秒）
    peakThroughput?: number;                    // 峰值吞吐量（行/秒）
    processingTimeMs?: number;                  // 处理时间（毫秒）
}

/**
 * Service for coordinating data cleaning operations
 * Integrates all cleaner services and manages the overall cleaning process
 */
@Injectable()
export class DataCleanerService {
    private readonly logger = new Logger(DataCleanerService.name);

    constructor(
        private readonly phoneCleaner: PhoneCleanerService,
        private readonly dateCleaner: DateCleanerService,
        private readonly addressCleaner: AddressCleanerService,
        private readonly streamParser: StreamParserService,
        private readonly databasePersistence: DatabasePersistenceService,
        private readonly dataCleanerOptimized: DataCleanerOptimizedService,
        // Make ParallelProcessingManagerService optional for now
        // private readonly parallelProcessingManager: ParallelProcessingManagerService,
        private readonly ruleEngine: RuleEngineService,
        private readonly strategyRegistration: StrategyRegistrationService,
        private readonly configurationManager: ConfigurationManagerService,
        private readonly progressTracker: AsyncProgressTrackerService,
    ) {
        // 记录配置信息
        this.logger.log(
            `DataCleanerService 初始化: ` +
            `并行处理=${workerThreadsConfig.enableParallelProcessing ? '启用' : '禁用'}, ` +
            `工作线程数=${workerThreadsConfig.workerCount}, ` +
            `最小并行记录数=${workerThreadsConfig.minRecordsForParallel}, ` +
            `规则引擎=${USE_RULE_ENGINE ? '启用' : '禁用'}, ` +
            `迁移模式=${MIGRATION_MODE}`
        );

        // 确保策略已注册
        this.ensureStrategiesRegistered();

        // 初始化配置管理器（异步，但不阻塞构造函数）
        this.initializeConfigurationManager().catch(error => {
            this.logger.error('Configuration manager initialization failed:', error);
        });
    }

    /**
     * Clean all data from parsed Excel file
     * @param parsedData - Parsed data from Excel file
     * @returns CleaningResult with clean data, exceptions, and statistics
     */
    async cleanData(parsedData: ParsedData): Promise<CleaningResult> {
        const startTime = Date.now();
        const jobId = this.generateJobId();

        this.logger.log(`开始数据清洗任务: ${jobId}, 总行数: ${parsedData.totalRows}`);

        const cleanData: CleanedRow[] = [];
        const exceptionData: ExceptionRow[] = [];

        // Process all sheets
        for (const sheet of parsedData.sheets) {
            this.logger.log(`处理工作表: ${sheet.name}, 行数: ${sheet.rows.length}`);

            for (const row of sheet.rows) {
                const cleanedRow = this.cleanRow(row, sheet.columnTypes);

                if (cleanedRow.errors.length === 0) {
                    // No errors, add to clean data
                    cleanData.push({
                        rowNumber: cleanedRow.rowNumber,
                        originalData: cleanedRow.originalData,
                        cleanedData: cleanedRow.cleanedData,
                    });
                } else {
                    // Has errors, add to exception data
                    exceptionData.push({
                        rowNumber: cleanedRow.rowNumber,
                        originalData: cleanedRow.originalData,
                        errors: cleanedRow.errors,
                    });
                }
            }
        }

        const endTime = Date.now();
        const processingTime = endTime - startTime;

        // Calculate statistics
        const statistics: Statistics = {
            totalRows: parsedData.totalRows,
            cleanedRows: cleanData.length,
            exceptionRows: exceptionData.length,
            processingTime,
        };

        this.logger.log(
            `数据清洗完成: ${jobId}, 清洁数据: ${statistics.cleanedRows}行, ` +
            `异常数据: ${statistics.exceptionRows}行, 处理时间: ${processingTime}ms`
        );

        return {
            jobId,
            cleanData,
            exceptionData,
            statistics,
        };
    }

    /**
     * 流式清洗数据（用于大文件）
     * 根据配置和文件大小自动选择优化处理或并行处理
     * @param filePath 文件路径
     * @param jobId 任务ID
     * @returns StreamCleaningResult 包含统计信息
     */
    async cleanDataStream(filePath: string, jobId: string): Promise<StreamCleaningResult> {
        this.logger.log(`开始数据清洗任务: ${jobId}, 文件: ${filePath}`);

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }

        // 初始化进度跟踪
        await this.progressTracker.initializeProgress(jobId, 0, 'estimating');

        // 快速估算文件行数（用于决定是否使用并行处理）
        const estimatedRows = await this.estimateFileRows(filePath);

        this.logger.log(
            `文件行数估算: ${estimatedRows.toLocaleString()} 行, ` +
            `文件大小: ${(estimatedRows * 100 / 1024 / 1024).toFixed(2)} MB (估算)`
        );

        // 更新进度跟踪器的总行数估算
        await this.progressTracker.updateProgress(jobId, {
            totalRows: estimatedRows,
            currentPhase: 'preparing'
        });

        // 优先使用高性能优化服务处理
        this.logger.log(`使用高性能优化处理: 目标处理速度 8000+ 行/秒`);
        return await this.dataCleanerOptimized.cleanDataStreamOptimized(filePath, jobId);
    }

    /**
     * 估算文件行数（快速方法）
     * @param filePath 文件路径
     * @returns 估算的行数
     */
    private async estimateFileRows(filePath: string): Promise<number> {
        const fileExtension = path.extname(filePath).toLowerCase();

        try {
            // 获取文件大小
            const stats = fs.statSync(filePath);
            const fileSizeBytes = stats.size;

            // 根据文件类型估算，使用更保守的估算（更小的每行字节数）
            if (fileExtension === '.csv') {
                // CSV: 假设平均每行 70 字节（更保守的估算）
                const estimatedRows = Math.floor(fileSizeBytes / 70);
                // 添加20%的缓冲区以应对估算不准确的情况
                return Math.floor(estimatedRows * 1.2);
            } else {
                // Excel: 假设平均每行 120 字节（更保守的估算）
                const estimatedRows = Math.floor(fileSizeBytes / 120);
                // 添加20%的缓冲区
                return Math.floor(estimatedRows * 1.2);
            }
        } catch (error) {
            this.logger.warn(`无法估算文件行数: ${error.message}，使用默认值 1000`);
            return 1000;
        }
    }

    /**
     * 并行流式清洗数据
     * @param filePath 文件路径
     * @param jobId 任务ID
     * @returns StreamCleaningResult 包含统计信息
     */
    private async cleanDataStreamParallel(
        filePath: string,
        jobId: string,
    ): Promise<StreamCleaningResult> {
        // Since ParallelProcessingManagerService is temporarily disabled,
        // fall back to sequential processing
        this.logger.warn(`Parallel processing manager not available, falling back to sequential processing for job: ${jobId}`);
        return this.cleanDataStreamSequential(filePath, jobId);
    }

    /**
     * 顺序流式清洗数据（原有实现）
     * @param filePath 文件路径
     * @param jobId 任务ID
     * @returns StreamCleaningResult 包含统计信息
     */
    private async cleanDataStreamSequential(filePath: string, jobId: string): Promise<StreamCleaningResult> {
        this.logger.log(`开始顺序流式数据清洗任务: ${jobId}, 文件: ${filePath}`);

        // 初始化进度跟踪
        await this.progressTracker.updatePhase(jobId, 'initializing');

        // 初始化批次
        let cleanBatch: any[] = [];
        let errorBatch: any[] = [];
        let columnTypes: ColumnTypeMap = {};

        // 自己维护统计信息
        let totalRows = 0;
        let cleanedRows = 0;
        let exceptionRows = 0;

        // 性能监控
        const startTime = Date.now();
        let lastLogTime = startTime;
        let processedSinceLastLog = 0;

        // 根据文件扩展名选择解析器
        const fileExtension = path.extname(filePath).toLowerCase();

        try {
            // 更新进度：开始文件解析
            await this.progressTracker.updatePhase(jobId, 'parsing');

            if (fileExtension === '.csv') {
                // 使用CSV流式解析器
                await this.streamParser.parseCsvStream(
                    filePath,
                    async (row: RowData, types: ColumnTypeMap) => {
                        // 保存列类型并初始化进度
                        if (Object.keys(types).length > 0 && Object.keys(columnTypes).length === 0) {
                            columnTypes = types;
                            this.logger.log(`列类型已识别: ${JSON.stringify(columnTypes)}`);

                            // 更新进度：开始数据清洗
                            await this.progressTracker.updatePhase(jobId, 'cleaning');
                        }

                        totalRows++;

                        // 性能监控：每处理10000行输出一次进度
                        processedSinceLastLog++;
                        if (totalRows % 10000 === 0) {
                            const currentTime = Date.now();
                            const timeSinceLastLog = currentTime - lastLogTime;
                            const rowsPerSecond = (processedSinceLastLog / timeSinceLastLog) * 1000;
                            const totalElapsed = (currentTime - startTime) / 1000;

                            this.logger.log(
                                `进度: ${totalRows.toLocaleString()} 行, ` +
                                `速度: ${rowsPerSecond.toFixed(0)} 行/秒, ` +
                                `已用时间: ${totalElapsed.toFixed(1)} 秒, ` +
                                `清洁: ${cleanedRows.toLocaleString()}, 异常: ${exceptionRows.toLocaleString()}`
                            );

                            // 更新进度跟踪器
                            await this.progressTracker.updateProgress(jobId, {
                                processedRows: totalRows,
                                                                currentPhase: 'cleaning'
                            });

                            lastLogTime = currentTime;
                            processedSinceLastLog = 0;
                        }

                        // 清洗单行数据
                        const cleanedRow = this.cleanRow(row, columnTypes);

                        // 累积到批次
                        if (cleanedRow.errors.length === 0) {
                            cleanedRows++;
                            cleanBatch.push(this.mapToCleanDataEntity(jobId, cleanedRow.rowNumber, cleanedRow.cleanedData));
                        } else {
                            exceptionRows++;
                            // 生成错误摘要
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

                        // 检查批次大小，达到BATCH_SIZE条时触发批量插入
                        if (cleanBatch.length >= BATCH_SIZE) {
                            // 更新进度：保存数据
                            await this.progressTracker.updatePhase(jobId, 'saving_batch', totalRows);

                            await this.databasePersistence.batchInsertCleanData(cleanBatch);
                            this.logger.log(`批量插入清洁数据: ${cleanBatch.length}条`);
                            cleanBatch = [];

                            // 恢复清洗阶段
                            await this.progressTracker.updatePhase(jobId, 'cleaning', totalRows);
                        }

                        if (errorBatch.length >= BATCH_SIZE) {
                            await this.databasePersistence.batchInsertErrorLogs(errorBatch);
                            this.logger.log(`批量插入错误日志: ${errorBatch.length}条`);
                            errorBatch = [];
                        }
                    },
                    (stats) => {
                        // 处理完成后的回调
                        this.logger.log(`流式解析完成，总行数: ${stats.totalRows}`);
                    },
                    (error: Error, rowNumber: number) => {
                        // 错误回调
                        this.logger.error(`处理第${rowNumber}行时出错: ${error.message}`);
                    },
                );
            } else {
                // 使用Excel流式解析器
                await this.streamParser.parseExcelStream(
                    filePath,
                    async (row: RowData, types: ColumnTypeMap) => {
                        // 保存列类型并初始化进度
                        if (Object.keys(types).length > 0 && Object.keys(columnTypes).length === 0) {
                            columnTypes = types;
                            this.logger.log(`列类型已识别: ${JSON.stringify(columnTypes)}`);

                            // 更新进度：开始数据清洗
                            await this.progressTracker.updatePhase(jobId, 'cleaning');
                        }

                        totalRows++;

                        // 性能监控：每处理10000行输出一次进度
                        processedSinceLastLog++;
                        if (totalRows % 10000 === 0) {
                            const currentTime = Date.now();
                            const timeSinceLastLog = currentTime - lastLogTime;
                            const rowsPerSecond = (processedSinceLastLog / timeSinceLastLog) * 1000;
                            const totalElapsed = (currentTime - startTime) / 1000;

                            this.logger.log(
                                `进度: ${totalRows.toLocaleString()} 行, ` +
                                `速度: ${rowsPerSecond.toFixed(0)} 行/秒, ` +
                                `已用时间: ${totalElapsed.toFixed(1)} 秒, ` +
                                `清洁: ${cleanedRows.toLocaleString()}, 异常: ${exceptionRows.toLocaleString()}`
                            );

                            // 更新进度跟踪器
                            await this.progressTracker.updateProgress(jobId, {
                                processedRows: totalRows,
                                                                currentPhase: 'cleaning'
                            });

                            lastLogTime = currentTime;
                            processedSinceLastLog = 0;
                        }

                        // 清洗单行数据
                        const cleanedRow = this.cleanRow(row, columnTypes);

                        // 累积到批次
                        if (cleanedRow.errors.length === 0) {
                            cleanedRows++;
                            cleanBatch.push(this.mapToCleanDataEntity(jobId, cleanedRow.rowNumber, cleanedRow.cleanedData));
                        } else {
                            exceptionRows++;
                            // 生成错误摘要
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

                        // 检查批次大小，达到BATCH_SIZE条时触发批量插入
                        if (cleanBatch.length >= BATCH_SIZE) {
                            // 更新进度：保存数据
                            await this.progressTracker.updatePhase(jobId, 'saving_batch', totalRows);

                            await this.databasePersistence.batchInsertCleanData(cleanBatch);
                            this.logger.log(`批量插入清洁数据: ${cleanBatch.length}条`);
                            cleanBatch = [];

                            // 恢复清洗阶段
                            await this.progressTracker.updatePhase(jobId, 'cleaning', totalRows);
                        }

                        if (errorBatch.length >= BATCH_SIZE) {
                            await this.databasePersistence.batchInsertErrorLogs(errorBatch);
                            this.logger.log(`批量插入错误日志: ${errorBatch.length}条`);
                            errorBatch = [];
                        }
                    },
                    (stats) => {
                        // 处理完成后的回调
                        this.logger.log(`流式解析完成，总行数: ${stats.totalRows}`);
                    },
                    (error: Error, rowNumber: number) => {
                        // 错误回调
                        this.logger.error(`处理第${rowNumber}行时出错: ${error.message}`);
                    },
                );
            }

            // 更新进度：保存剩余数据
            await this.progressTracker.updatePhase(jobId, 'finalizing', totalRows);

            // 插入剩余的批次
            if (cleanBatch.length > 0) {
                await this.databasePersistence.batchInsertCleanData(cleanBatch);
                this.logger.log(`批量插入剩余清洁数据: ${cleanBatch.length}条`);
            }

            if (errorBatch.length > 0) {
                await this.databasePersistence.batchInsertErrorLogs(errorBatch);
                this.logger.log(`批量插入剩余错误日志: ${errorBatch.length}条`);
            }

            // 使用我们自己维护的统计信息
            const statistics: StreamStatistics = {
                totalRows,
                processedRows: cleanedRows,
                errorRows: exceptionRows,
            };

            const totalTime = (Date.now() - startTime) / 1000;
            const avgSpeed = totalRows / totalTime;

            this.logger.log(
                `顺序流式数据清洗完成: ${jobId}, ` +
                `总行数: ${statistics.totalRows.toLocaleString()}, ` +
                `清洁数据: ${statistics.processedRows.toLocaleString()}行, ` +
                `异常数据: ${statistics.errorRows.toLocaleString()}行, ` +
                `总耗时: ${totalTime.toFixed(2)}秒, ` +
                `平均速度: ${avgSpeed.toFixed(0)}行/秒`
            );

            // 最终进度更新：标记完成
            await this.progressTracker.markCompleted(jobId, statistics);

            // 构建返回结果
            const streamResult: StreamCleaningResult = {
                jobId,
                statistics,
            };

            // 添加性能指标（标记为顺序模式）
            if (workerThreadsConfig.enablePerformanceMonitoring) {
                streamResult.performanceMetrics = {
                    processingMode: 'sequential',
                    avgThroughput: avgSpeed,
                    processingTimeMs: totalTime * 1000,
                };
            }

            return streamResult;
        } catch (error) {
            this.logger.error(`顺序流式数据清洗失败: ${error.message}`, error.stack);

            // 标记任务失败
            await this.progressTracker.markFailed(jobId, error.message);

            throw error;
        }
    }

    /**
     * Clean a single row of data using the rule engine (new approach)
     * @param row - Row data to clean
     * @param columnTypes - Column type mapping for the row
     * @returns Cleaned row with original data, cleaned data, and any errors
     */
    async cleanRowWithRuleEngine(row: RowData, columnTypes: ColumnTypeMap): Promise<CleanedRow & { errors: FieldError[] }> {
        try {
            // Use the rule engine to process the row
            const ruleResult = await this.ruleEngine.cleanRow(row.data, columnTypes);

            if (ruleResult.success) {
                return {
                    rowNumber: row.rowNumber,
                    originalData: row.data,
                    cleanedData: ruleResult.processedData,
                    errors: []
                };
            } else {
                // Convert rule engine errors to legacy format
                const legacyErrors: FieldError[] = ruleResult.errors.map(error => ({
                    field: error.field,
                    originalValue: error.originalValue,
                    errorType: error.type,
                    errorMessage: error.message
                }));

                return {
                    rowNumber: row.rowNumber,
                    originalData: row.data,
                    cleanedData: ruleResult.processedData,
                    errors: legacyErrors
                };
            }
        } catch (error) {
            this.logger.error(`Rule engine processing failed for row ${row.rowNumber}:`, error);

            // Fallback to legacy cleaning method
            this.logger.warn(`Falling back to legacy cleaning for row ${row.rowNumber}`);
            return this.cleanRow(row, columnTypes);
        }
    }

    /**
     * Clean a single row of data with migration mode support
     * @param row - Row data to clean
     * @param columnTypes - Column type mapping for the row
     * @returns Cleaned row with original data, cleaned data, and any errors
     */
    cleanRow(row: RowData, columnTypes: ColumnTypeMap): CleanedRow & { errors: FieldError[] } {
        // Determine processing approach based on migration mode
        switch (MIGRATION_MODE) {
            case MigrationMode.RULE_ENGINE_ONLY:
                if (USE_RULE_ENGINE) {
                    try {
                        // Note: This would need to be async in a real implementation
                        // For now, we'll use the legacy method but log the intention
                        this.logger.debug(`Rule engine only mode - would use cleanRowWithRuleEngine for row ${row.rowNumber}`);
                    } catch (error) {
                        this.logger.error(`Rule engine only mode failed for row ${row.rowNumber}:`, error);
                        throw error; // Don't fallback in rule engine only mode
                    }
                }
                break;

            case MigrationMode.HYBRID:
                if (USE_RULE_ENGINE) {
                    try {
                        // In hybrid mode, try rule engine first, fallback to legacy on failure
                        this.logger.debug(`Hybrid mode - trying rule engine first for row ${row.rowNumber}`);
                        // Would call cleanRowWithRuleEngine here in async context
                    } catch (error) {
                        this.logger.warn(`Rule engine failed in hybrid mode, falling back to legacy for row ${row.rowNumber}:`, error);
                        // Continue to legacy processing below
                    }
                }
                break;

            case MigrationMode.GRADUAL:
                if (USE_RULE_ENGINE) {
                    // In gradual mode, use rule engine for specific field types
                    const hasRuleEngineFields = Object.values(columnTypes).some(type =>
                        RULE_ENGINE_FIELD_TYPES.has(type as ColumnType)
                    );

                    if (hasRuleEngineFields) {
                        this.logger.debug(`Gradual mode - using rule engine for supported field types in row ${row.rowNumber}`);
                        return this.cleanRowGradual(row, columnTypes);
                    }
                }
                break;

            case MigrationMode.LEGACY_ONLY:
            default:
                // Use legacy processing
                break;
        }

        // Legacy processing (default behavior)
        return this.cleanRowLegacy(row, columnTypes);
    }

    /**
     * Clean a single row using gradual migration approach
     * @param row - Row data to clean
     * @param columnTypes - Column type mapping for the row
     * @returns Cleaned row with original data, cleaned data, and any errors
     */
    private cleanRowGradual(row: RowData, columnTypes: ColumnTypeMap): CleanedRow & { errors: FieldError[] } {
        const cleanedData: Record<string, any> = {};
        const errors: FieldError[] = [];

        // Process each field based on whether it should use rule engine or legacy
        for (const [fieldName, originalValue] of Object.entries(row.data)) {
            const columnType = columnTypes[fieldName] || ColumnType.TEXT;

            try {
                let cleanResult: CleanResult<any>;

                if (RULE_ENGINE_FIELD_TYPES.has(columnType as ColumnType)) {
                    // Use rule engine for supported field types
                    try {
                        cleanResult = this.cleanFieldWithRuleEngine(fieldName, originalValue, columnType);
                    } catch (error) {
                        this.logger.warn(`Rule engine failed for field ${fieldName}, falling back to legacy:`, error);
                        cleanResult = this.cleanFieldLegacy(fieldName, originalValue, columnType);
                    }
                } else {
                    // Use legacy cleaning for unsupported field types
                    cleanResult = this.cleanFieldLegacy(fieldName, originalValue, columnType);
                }

                if (cleanResult.success) {
                    cleanedData[fieldName] = cleanResult.value;
                } else {
                    // Keep original value and record error
                    cleanedData[fieldName] = originalValue;
                    errors.push({
                        field: fieldName,
                        originalValue,
                        errorType: this.getErrorType(columnType),
                        errorMessage: cleanResult.error || 'Unknown error',
                    });
                }
            } catch (error) {
                // Handle unexpected errors
                cleanedData[fieldName] = originalValue;
                errors.push({
                    field: fieldName,
                    originalValue,
                    errorType: 'PROCESSING_ERROR',
                    errorMessage: `Unexpected error during cleaning: ${error.message}`,
                });

                this.logger.error(
                    `清洗字段 ${fieldName} 时发生错误: ${error.message}`,
                    error.stack
                );
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
     * Clean a single row using legacy approach only
     * @param row - Row data to clean
     * @param columnTypes - Column type mapping for the row
     * @returns Cleaned row with original data, cleaned data, and any errors
     */
    private cleanRowLegacy(row: RowData, columnTypes: ColumnTypeMap): CleanedRow & { errors: FieldError[] } {
        const cleanedData: Record<string, any> = {};
        const errors: FieldError[] = [];

        // Process each field in the row using legacy method
        for (const [fieldName, originalValue] of Object.entries(row.data)) {
            const columnType = columnTypes[fieldName] || ColumnType.TEXT;

            try {
                const cleanResult = this.cleanFieldLegacy(fieldName, originalValue, columnType);

                if (cleanResult.success) {
                    cleanedData[fieldName] = cleanResult.value;
                } else {
                    // Keep original value and record error
                    cleanedData[fieldName] = originalValue;
                    errors.push({
                        field: fieldName,
                        originalValue,
                        errorType: this.getErrorType(columnType),
                        errorMessage: cleanResult.error || 'Unknown error',
                    });
                }
            } catch (error) {
                // Handle unexpected errors
                cleanedData[fieldName] = originalValue;
                errors.push({
                    field: fieldName,
                    originalValue,
                    errorType: 'PROCESSING_ERROR',
                    errorMessage: `Unexpected error during cleaning: ${error.message}`,
                });

                this.logger.error(
                    `清洗字段 ${fieldName} 时发生错误: ${error.message}`,
                    error.stack
                );
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
     * Clean a single field using rule engine
     * @param fieldName - Name of the field
     * @param value - Original field value
     * @param columnType - Type of the column
     * @returns CleanResult with cleaned value or error
     */
    private cleanFieldWithRuleEngine(fieldName: string, value: any, columnType: ColumnType): CleanResult<any> {
        try {
            // 获取当前配置
            const currentConfig = this.configurationManager.getCurrentConfiguration();

            // 查找字段规则
            const fieldRules = currentConfig.fieldRules[fieldName] || [];

            if (fieldRules.length === 0) {
                // 如果没有配置规则，回退到传统方法
                this.logger.debug(`No rules found for field ${fieldName}, using legacy method`);
                return this.cleanFieldLegacy(fieldName, value, columnType);
            }

            // 按优先级排序规则
            const sortedRules = fieldRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

            // 应用规则验证
            for (const rule of sortedRules) {
                if (!rule.required && (value === null || value === undefined || value === '')) {
                    // 非必需字段且值为空，跳过验证
                    continue;
                }

                const validationResult = this.validateFieldWithRule(fieldName, value, rule);
                if (!validationResult.success) {
                    return {
                        success: false,
                        error: rule.errorMessage || validationResult.error || 'Validation failed'
                    };
                }
            }

            // 所有规则验证通过，返回清洗后的值
            return {
                success: true,
                value: this.cleanValueByType(value, columnType)
            };

        } catch (error) {
            this.logger.error(`Rule engine field processing failed for ${fieldName}:`, error);
            // 出错时回退到传统方法
            return this.cleanFieldLegacy(fieldName, value, columnType);
        }
    }

    /**
     * 使用规则验证字段值
     * @param fieldName 字段名
     * @param value 字段值
     * @param rule 验证规则
     * @returns 验证结果
     */
    private validateFieldWithRule(fieldName: string, value: any, rule: any): { success: boolean; error?: string } {
        try {
            const stringValue = String(value || '').trim();

            switch (rule.strategy) {
                case 'regex':
                    const pattern = new RegExp(rule.params.pattern, rule.params.flags || '');
                    if (!pattern.test(stringValue)) {
                        return {
                            success: false,
                            error: `Field ${fieldName} does not match pattern ${rule.params.pattern}`
                        };
                    }
                    break;

                case 'length':
                    const length = stringValue.length;
                    if (rule.params.minLength && length < rule.params.minLength) {
                        return {
                            success: false,
                            error: `Field ${fieldName} is too short (min: ${rule.params.minLength})`
                        };
                    }
                    if (rule.params.maxLength && length > rule.params.maxLength) {
                        return {
                            success: false,
                            error: `Field ${fieldName} is too long (max: ${rule.params.maxLength})`
                        };
                    }
                    if (rule.params.exactLength && length !== rule.params.exactLength) {
                        return {
                            success: false,
                            error: `Field ${fieldName} must be exactly ${rule.params.exactLength} characters`
                        };
                    }
                    break;

                case 'range':
                    const numValue = parseFloat(stringValue);
                    if (isNaN(numValue)) {
                        return {
                            success: false,
                            error: `Field ${fieldName} is not a valid number`
                        };
                    }
                    if (rule.params.min !== undefined && numValue < rule.params.min) {
                        return {
                            success: false,
                            error: `Field ${fieldName} is below minimum (${rule.params.min})`
                        };
                    }
                    if (rule.params.max !== undefined && numValue > rule.params.max) {
                        return {
                            success: false,
                            error: `Field ${fieldName} is above maximum (${rule.params.max})`
                        };
                    }
                    break;

                case 'phone-cleaner':
                    // 使用传统的手机号清洗服务进行验证
                    const phoneResult = this.phoneCleaner.cleanPhone(value);
                    if (!phoneResult.success) {
                        return {
                            success: false,
                            error: phoneResult.error
                        };
                    }
                    break;

                case 'date-cleaner':
                    // 使用传统的日期清洗服务进行验证
                    const dateResult = this.dateCleaner.cleanDate(value);
                    if (!dateResult.success) {
                        return {
                            success: false,
                            error: dateResult.error
                        };
                    }
                    break;

                case 'address-cleaner':
                    // 使用传统的地址清洗服务进行验证
                    const addressResult = this.addressCleaner.cleanAddress(value);
                    if (!addressResult.success) {
                        return {
                            success: false,
                            error: addressResult.error
                        };
                    }
                    break;

                default:
                    this.logger.warn(`Unknown validation strategy: ${rule.strategy}`);
                    break;
            }

            return { success: true };

        } catch (error) {
            return {
                success: false,
                error: `Validation error: ${error.message}`
            };
        }
    }

    /**
     * 根据类型清洗值
     * @param value 原始值
     * @param columnType 列类型
     * @returns 清洗后的值
     */
    private cleanValueByType(value: any, columnType: ColumnType): any {
        switch (columnType) {
            case ColumnType.PHONE:
                const phoneResult = this.phoneCleaner.cleanPhone(value);
                return phoneResult.success ? phoneResult.value : value;

            case ColumnType.DATE:
                const dateResult = this.dateCleaner.cleanDate(value);
                return dateResult.success ? dateResult.value : value;

            case ColumnType.ADDRESS:
                const addressResult = this.addressCleaner.cleanAddress(value);
                return addressResult.success ? addressResult.value : value;

            case ColumnType.NUMBER:
                return this.cleanNumber(value).value || value;

            case ColumnType.TEXT:
            default:
                return this.cleanText(value).value || value;
        }
    }

    /**
     * Clean a single field based on its type (legacy method)
     * @param fieldName - Name of the field
     * @param value - Original field value
     * @param columnType - Type of the column
     * @returns CleanResult with cleaned value or error
     */
    private cleanFieldLegacy(fieldName: string, value: any, columnType: ColumnType): CleanResult<any> {
        // Handle empty values - for most types, empty is acceptable
        if (value === null || value === undefined || value === '') {
            // For required fields, we might want to mark as error
            // For now, we'll allow empty values for all types
            return {
                success: true,
                value: value,
            };
        }

        switch (columnType) {
            case ColumnType.PHONE:
                return this.phoneCleaner.cleanPhone(value);

            case ColumnType.DATE:
                return this.dateCleaner.cleanDate(value);

            case ColumnType.ADDRESS:
                const addressResult = this.addressCleaner.cleanAddress(value);
                if (addressResult.success) {
                    // For address, we might want to return the structured components
                    // or a formatted string. For now, let's return the structured components
                    return {
                        success: true,
                        value: addressResult.value,
                    };
                }
                return addressResult;

            case ColumnType.NUMBER:
                return this.cleanNumber(value);

            case ColumnType.TEXT:
            default:
                return this.cleanText(value);
        }
    }

    /**
     * Initialize configuration manager
     */
    private async initializeConfigurationManager(): Promise<void> {
        try {
            await this.configurationManager.initialize();
            this.logger.log('Configuration manager initialized successfully');

            // 监听配置变更事件
            this.configurationManager.on('configurationChanged', (event) => {
                this.logger.log(`Configuration changed: ${event.type} - ${event.version}`);
                if (event.success) {
                    this.logger.log('New configuration is now active for data cleaning');
                }
            });

            // 记录当前配置信息
            const currentConfig = this.configurationManager.getCurrentConfiguration();
            this.logger.log(`Current configuration loaded: ${currentConfig.metadata.name} v${currentConfig.metadata.version}`);

            // 检查手机号规则
            const phoneRules = currentConfig.fieldRules['phone'] || currentConfig.fieldRules['手机号'] || [];
            this.logger.log(`Phone validation rules count: ${phoneRules.length}`);
            if (phoneRules.length > 0) {
                phoneRules.forEach((rule, index) => {
                    this.logger.log(`  Rule ${index + 1}: ${rule.name} (${rule.strategy})`);
                });
            }

        } catch (error) {
            this.logger.error('Failed to initialize configuration manager:', error);
            // 不抛出错误，允许服务继续运行使用默认配置
        }
    }

    /**
     * Ensure that all required strategies are registered
     */
    private ensureStrategiesRegistered(): void {
        try {
            const status = this.strategyRegistration.getRegistrationStatus();
            this.logger.log(
                `Strategy registration status: ${status.totalStrategies} total strategies, ` +
                `${status.nativeStrategies.length} native, ${status.adapterStrategies.length} adapters`
            );

            // Verify that required adapter strategies are registered
            const requiredAdapters = ['phone-cleaner', 'date-cleaner', 'address-cleaner'];
            const missingAdapters = requiredAdapters.filter(name => !status.adapterStrategies.includes(name));

            if (missingAdapters.length > 0) {
                this.logger.warn(`Missing required adapter strategies: ${missingAdapters.join(', ')}`);
                // Attempt to re-register strategies
                this.strategyRegistration.reregisterStrategies().catch(error => {
                    this.logger.error('Failed to re-register strategies:', error);
                });
            }
        } catch (error) {
            this.logger.error('Failed to check strategy registration status:', error);
        }
    }

    /**
     * Clean number field
     * @param value - Original value
     * @returns CleanResult with cleaned number
     */
    private cleanNumber(value: any): CleanResult<number> {
        if (typeof value === 'number') {
            return {
                success: true,
                value,
            };
        }

        const stringValue = String(value).trim();

        // Remove common formatting characters
        const cleaned = stringValue.replace(/[,\s]/g, '');

        const parsed = parseFloat(cleaned);

        if (isNaN(parsed)) {
            return {
                success: false,
                error: 'Invalid number format',
            };
        }

        return {
            success: true,
            value: parsed,
        };
    }

    /**
     * Clean text field
     * @param value - Original value
     * @returns CleanResult with cleaned text
     */
    private cleanText(value: any): CleanResult<string> {
        const stringValue = String(value).trim();

        return {
            success: true,
            value: stringValue,
        };
    }

    /**
     * Get error type based on column type
     * @param columnType - Column type
     * @returns Error type string
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

    /**
     * 将清洗后的数据映射到CleanData实体格式
     * @param jobId 任务ID
     * @param rowNumber 行号
     * @param cleanedData 清洗后的数据
     * @returns 格式化后的CleanData对象
     */
    private mapToCleanDataEntity(jobId: string, rowNumber: number, cleanedData: Record<string, any>): any {
        // 提取已知字段（支持多种中英文字段名变体）
        const knownFields = {
            jobId,
            rowNumber,
            name: cleanedData['姓名'] || cleanedData['name'] || cleanedData['名字'] || null,
            phone: cleanedData['手机号'] || cleanedData['手机号码'] || cleanedData['phone'] || cleanedData['电话'] || null,
            hireDate: cleanedData['日期'] || cleanedData['入职日期'] || cleanedData['date'] || cleanedData['时间'] || null,
            province: cleanedData['省'] || cleanedData['province'] || null,
            city: cleanedData['市'] || cleanedData['city'] || null,
            district: cleanedData['区'] || cleanedData['district'] || null,
            addressDetail: cleanedData['详细地址'] || cleanedData['addressDetail'] || cleanedData['地址详情'] || null,
        };

        // 如果有地址字段但没有省市区，尝试从地址中提取
        if (!knownFields.province && !knownFields.city && !knownFields.district) {
            const addressValue = cleanedData['地址'] || cleanedData['address'];
            if (addressValue && typeof addressValue === 'object') {
                // 如果地址已经被解析为对象（AddressComponents）
                knownFields.province = addressValue.province || null;
                knownFields.city = addressValue.city || null;
                knownFields.district = addressValue.district || null;
                knownFields.addressDetail = addressValue.detail || null;
            } else if (addressValue && typeof addressValue === 'string') {
                // 如果地址是字符串，直接存入 addressDetail
                knownFields.addressDetail = addressValue;
            }
        }

        // 收集额外字段
        const additionalFields: Record<string, any> = {};
        const knownFieldNames = [
            '姓名', 'name', '名字',
            '手机号', '手机号码', 'phone', '电话',
            '日期', '入职日期', 'date', '时间',
            '省', 'province',
            '市', 'city',
            '区', 'district',
            '详细地址', 'addressDetail', '地址详情', '地址', 'address'
        ];

        for (const [key, value] of Object.entries(cleanedData)) {
            if (!knownFieldNames.includes(key)) {
                additionalFields[key] = value;
            }
        }

        return {
            ...knownFields,
            additionalFields: Object.keys(additionalFields).length > 0 ? additionalFields : null,
        };
    }

    /**
     * Generate a unique job ID
     * @returns Unique job ID string
     */
    private generateJobId(): string {
        // Simple UUID v4 implementation for testing
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Get current migration configuration
     * @returns Migration configuration information
     */
    getMigrationConfig(): {
        useRuleEngine: boolean;
        migrationMode: string;
        ruleEngineFieldTypes: string[];
        strategyStatus: any;
    } {
        return {
            useRuleEngine: USE_RULE_ENGINE,
            migrationMode: MIGRATION_MODE,
            ruleEngineFieldTypes: Array.from(RULE_ENGINE_FIELD_TYPES),
            strategyStatus: this.strategyRegistration.getRegistrationStatus()
        };
    }

    /**
     * Update migration mode at runtime (for testing and gradual rollout)
     * @param mode New migration mode
     */
    setMigrationMode(mode: MigrationMode): void {
        // Note: This would require updating the environment variable or configuration
        // For now, we'll just log the request
        this.logger.log(`Migration mode change requested: ${MIGRATION_MODE} -> ${mode}`);
        this.logger.warn('Migration mode change requires service restart to take effect');
    }

    /**
     * Test rule engine functionality with sample data
     * @param sampleData Sample row data for testing
     * @param columnTypes Column type mapping
     * @returns Test results
     */
    async testRuleEngine(
        sampleData: Record<string, any>,
        columnTypes: ColumnTypeMap
    ): Promise<{
        ruleEngineResult?: any;
        legacyResult: any;
        comparison: {
            fieldsMatch: boolean;
            differences: string[];
            performance: {
                ruleEngineTime?: number;
                legacyTime: number;
            };
        };
    }> {
        const testRow: RowData = {
            rowNumber: 1,
            data: sampleData
        };

        // Test legacy approach
        const legacyStart = Date.now();
        const legacyResult = this.cleanRowLegacy(testRow, columnTypes);
        const legacyTime = Date.now() - legacyStart;

        let ruleEngineResult: any;
        let ruleEngineTime: number | undefined;

        // Test rule engine approach if enabled
        if (USE_RULE_ENGINE) {
            try {
                const ruleEngineStart = Date.now();
                ruleEngineResult = await this.cleanRowWithRuleEngine(testRow, columnTypes);
                ruleEngineTime = Date.now() - ruleEngineStart;
            } catch (error) {
                this.logger.error('Rule engine test failed:', error);
                ruleEngineResult = { error: error.message };
            }
        }

        // Compare results
        const differences: string[] = [];
        let fieldsMatch = true;

        if (ruleEngineResult && !ruleEngineResult.error) {
            // Compare cleaned data
            for (const [field, legacyValue] of Object.entries(legacyResult.cleanedData)) {
                const ruleEngineValue = ruleEngineResult.cleanedData[field];
                if (JSON.stringify(legacyValue) !== JSON.stringify(ruleEngineValue)) {
                    fieldsMatch = false;
                    differences.push(`Field ${field}: legacy=${JSON.stringify(legacyValue)}, rule_engine=${JSON.stringify(ruleEngineValue)}`);
                }
            }

            // Compare error counts
            if (legacyResult.errors.length !== ruleEngineResult.errors.length) {
                fieldsMatch = false;
                differences.push(`Error count: legacy=${legacyResult.errors.length}, rule_engine=${ruleEngineResult.errors.length}`);
            }
        }

        return {
            ruleEngineResult,
            legacyResult,
            comparison: {
                fieldsMatch,
                differences,
                performance: {
                    ruleEngineTime,
                    legacyTime
                }
            }
        };
    }
}
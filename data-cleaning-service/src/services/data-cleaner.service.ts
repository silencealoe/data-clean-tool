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
import * as path from 'path';

/**
 * 批次配置
 * 优化批次大小，提高大文件处理速度
 */
const BATCH_SIZE = 5000; // 优化：从2000增加到5000，减少数据库连接次数

/**
 * 流式清洗结果接口
 */
export interface StreamCleaningResult {
    jobId: string;
    statistics: StreamStatistics;
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
    ) { }

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
     * @param filePath 文件路径
     * @param jobId 任务ID
     * @returns StreamCleaningResult 包含统计信息
     */
    async cleanDataStream(filePath: string, jobId: string): Promise<StreamCleaningResult> {
        this.logger.log(`开始流式数据清洗任务: ${jobId}, 文件: ${filePath}`);

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
            if (fileExtension === '.csv') {
                // 使用CSV流式解析器
                await this.streamParser.parseCsvStream(
                    filePath,
                    async (row: RowData, types: ColumnTypeMap) => {
                        // 保存列类型
                        if (Object.keys(types).length > 0 && Object.keys(columnTypes).length === 0) {
                            columnTypes = types;
                            this.logger.log(`列类型已识别: ${JSON.stringify(columnTypes)}`);
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
                                errors: cleanedRow.errors,
                                errorSummary,
                            });
                        }

                        // 检查批次大小，达到BATCH_SIZE条时触发批量插入
                        if (cleanBatch.length >= BATCH_SIZE) {
                            await this.databasePersistence.batchInsertCleanData(cleanBatch);
                            this.logger.log(`批量插入清洁数据: ${cleanBatch.length}条`);
                            cleanBatch = [];
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
                        // 保存列类型
                        if (Object.keys(types).length > 0 && Object.keys(columnTypes).length === 0) {
                            columnTypes = types;
                            this.logger.log(`列类型已识别: ${JSON.stringify(columnTypes)}`);
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
                                errors: cleanedRow.errors,
                                errorSummary,
                            });
                        }

                        // 检查批次大小，达到BATCH_SIZE条时触发批量插入
                        if (cleanBatch.length >= BATCH_SIZE) {
                            await this.databasePersistence.batchInsertCleanData(cleanBatch);
                            this.logger.log(`批量插入清洁数据: ${cleanBatch.length}条`);
                            cleanBatch = [];
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
                `流式数据清洗完成: ${jobId}, ` +
                `总行数: ${statistics.totalRows.toLocaleString()}, ` +
                `清洁数据: ${statistics.processedRows.toLocaleString()}行, ` +
                `异常数据: ${statistics.errorRows.toLocaleString()}行, ` +
                `总耗时: ${totalTime.toFixed(2)}秒, ` +
                `平均速度: ${avgSpeed.toFixed(0)}行/秒`
            );

            return {
                jobId,
                statistics,
            };
        } catch (error) {
            this.logger.error(`流式数据清洗失败: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Clean a single row of data
     * @param row - Row data to clean
     * @param columnTypes - Column type mapping for the row
     * @returns Cleaned row with original data, cleaned data, and any errors
     */
    cleanRow(row: RowData, columnTypes: ColumnTypeMap): CleanedRow & { errors: FieldError[] } {
        const cleanedData: Record<string, any> = {};
        const errors: FieldError[] = [];

        // Process each field in the row
        for (const [fieldName, originalValue] of Object.entries(row.data)) {
            const columnType = columnTypes[fieldName] || ColumnType.TEXT;

            try {
                const cleanResult = this.cleanField(fieldName, originalValue, columnType);

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
     * Clean a single field based on its type
     * @param fieldName - Name of the field
     * @param value - Original field value
     * @param columnType - Type of the column
     * @returns CleanResult with cleaned value or error
     */
    private cleanField(fieldName: string, value: any, columnType: ColumnType): CleanResult<any> {
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
            date: cleanedData['日期'] || cleanedData['入职日期'] || cleanedData['date'] || cleanedData['时间'] || null,
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
}
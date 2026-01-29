import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CleanData } from '../entities/clean-data.entity';
import { ErrorLog } from '../entities/error-log.entity';
import { FieldError } from '../common/types';

export interface BatchInsertResult {
    successCount: number;
    failureCount: number;
    errors: BatchError[];
}

export interface BatchError {
    batchIndex: number;
    error: string;
    affectedRows: number;
}

export interface IntegrityCheckResult {
    isValid: boolean;
    cleanDataCount: number;
    errorLogCount: number;
    totalCount: number;
    expectedCount: number;
    message: string;
}

@Injectable()
export class DatabasePersistenceService {
    private readonly logger = new Logger(DatabasePersistenceService.name);
    private readonly DEFAULT_BATCH_SIZE = 1000;

    constructor(
        @InjectRepository(CleanData)
        private readonly cleanDataRepository: Repository<CleanData>,
        @InjectRepository(ErrorLog)
        private readonly errorLogRepository: Repository<ErrorLog>,
    ) { }

    /**
     * 批量插入清洁数据
     * @param data 清洁数据数组
     * @param batchSize 批次大小，默认1000
     * @returns 批量插入结果
     */
    async batchInsertCleanData(
        data: CleanData[],
        batchSize: number = 2000, // 优化批次大小
    ): Promise<BatchInsertResult> {
        const result: BatchInsertResult = {
            successCount: 0,
            failureCount: 0,
            errors: [],
        };

        if (!data || data.length === 0) {
            this.logger.warn('No clean data to insert');
            return result;
        }

        this.logger.log(`Starting batch insert of ${data.length} clean data records with batch size ${batchSize}`);

        // 分批处理数据
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const batchIndex = Math.floor(i / batchSize);

            try {
                // 使用 TypeORM 的 createQueryBuilder 进行批量插入，优化性能
                await this.cleanDataRepository
                    .createQueryBuilder()
                    .insert()
                    .into(CleanData)
                    .values(batch)
                    .execute();

                result.successCount += batch.length;
                this.logger.debug(`Batch ${batchIndex} inserted successfully: ${batch.length} records`);
            } catch (error) {
                this.logger.error(`Failed to insert batch ${batchIndex}:`, error);
                result.failureCount += batch.length;
                result.errors.push({
                    batchIndex,
                    error: error.message || 'Unknown error',
                    affectedRows: batch.length,
                });
            }
        }

        this.logger.log(`Batch insert completed. Success: ${result.successCount}, Failure: ${result.failureCount}`);
        return result;
    }

    /**
     * 批量插入错误日志
     * @param logs 错误日志数组
     * @param batchSize 批次大小，默认2000
     * @returns 批量插入结果
     */
    async batchInsertErrorLogs(
        logs: ErrorLog[],
        batchSize: number = 2000,
    ): Promise<BatchInsertResult> {
        const result: BatchInsertResult = {
            successCount: 0,
            failureCount: 0,
            errors: [],
        };

        if (!logs || logs.length === 0) {
            this.logger.warn('No error logs to insert');
            return result;
        }

        this.logger.log(`Starting batch insert of ${logs.length} error log records with batch size ${batchSize}`);

        // 分批处理数据
        for (let i = 0; i < logs.length; i += batchSize) {
            const batch = logs.slice(i, i + batchSize);
            const batchIndex = Math.floor(i / batchSize);

            try {
                // 使用 TypeORM 的 createQueryBuilder 进行批量插入
                await this.errorLogRepository
                    .createQueryBuilder()
                    .insert()
                    .into(ErrorLog)
                    .values(batch)
                    .execute();

                result.successCount += batch.length;
                this.logger.debug(`Batch ${batchIndex} inserted successfully: ${batch.length} records`);
            } catch (error) {
                this.logger.error(`Failed to insert batch ${batchIndex}:`, error);
                result.failureCount += batch.length;
                result.errors.push({
                    batchIndex,
                    error: error.message || 'Unknown error',
                    affectedRows: batch.length,
                });
            }
        }

        this.logger.log(`Batch insert completed. Success: ${result.successCount}, Failure: ${result.failureCount}`);
        return result;
    }

    /**
     * 根据任务ID查询清洁数据
     * @param jobId 任务ID
     * @returns 清洁数据数组
     */
    async getCleanDataByJobId(jobId: string): Promise<CleanData[]> {
        this.logger.log(`Querying clean data for job: ${jobId}`);

        try {
            const cleanData = await this.cleanDataRepository.find({
                where: { jobId },
                order: { rowNumber: 'ASC' },
            });

            this.logger.log(`Found ${cleanData.length} clean data records for job: ${jobId}`);
            return cleanData;
        } catch (error) {
            this.logger.error(`Failed to query clean data for job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * 根据任务ID查询错误日志
     * @param jobId 任务ID
     * @returns 错误日志数组
     */
    async getErrorLogsByJobId(jobId: string): Promise<ErrorLog[]> {
        this.logger.log(`Querying error logs for job: ${jobId}`);

        try {
            const errorLogs = await this.errorLogRepository.find({
                where: { jobId },
                order: { rowNumber: 'ASC' },
            });

            this.logger.log(`Found ${errorLogs.length} error log records for job: ${jobId}`);
            return errorLogs;
        } catch (error) {
            this.logger.error(`Failed to query error logs for job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * 分页查询清洁数据
     * @param jobId 任务ID
     * @param page 页码
     * @param pageSize 每页大小
     * @returns 分页结果
     */
    async getCleanDataByJobIdPaginated(jobId: string, page: number = 1, pageSize: number = 100): Promise<{
        data: CleanData[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        this.logger.log(`Querying clean data for job: ${jobId}, page: ${page}, pageSize: ${pageSize}`);

        try {
            const [data, total] = await this.cleanDataRepository.findAndCount({
                where: { jobId },
                order: { rowNumber: 'ASC' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            });

            const totalPages = Math.ceil(total / pageSize);

            this.logger.log(`Found ${data.length} clean data records for job: ${jobId}, total: ${total}`);

            return {
                data,
                total,
                page,
                pageSize,
                totalPages,
            };
        } catch (error) {
            this.logger.error(`Failed to query clean data for job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * 分页查询错误日志
     * @param jobId 任务ID
     * @param page 页码
     * @param pageSize 每页大小
     * @returns 分页结果
     */
    async getErrorLogsByJobIdPaginated(jobId: string, page: number = 1, pageSize: number = 100): Promise<{
        data: any[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        this.logger.log(`Querying error logs for job: ${jobId}, page: ${page}, pageSize: ${pageSize}`);

        try {
            const [rawData, total] = await this.errorLogRepository.findAndCount({
                where: { jobId },
                order: { rowNumber: 'ASC' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            });

            const totalPages = Math.ceil(total / pageSize);

            // 结构化错误数据，解析JSON字符串为可读对象
            const data = rawData.map(errorLog => {
                let structuredErrors;
                try {
                    // 尝试解析errors字段中的JSON字符串
                    if (typeof errorLog.errors === 'string') {
                        structuredErrors = JSON.parse(errorLog.errors);
                    } else {
                        structuredErrors = errorLog.errors;
                    }
                } catch (parseError) {
                    // 如果解析失败，保持原始格式但添加解析错误信息
                    this.logger.warn(`Failed to parse error JSON for row ${errorLog.rowNumber}: ${parseError.message}`);
                    structuredErrors = {
                        parseError: '错误数据解析失败',
                        originalError: errorLog.errors,
                        message: '无法解析错误详情，请检查原始错误数据'
                    };
                }

                return {
                    id: errorLog.id,
                    jobId: errorLog.jobId,
                    rowNumber: errorLog.rowNumber,
                    originalData: errorLog.originalData,
                    errors: structuredErrors,
                    errorSummary: errorLog.errorSummary,
                    createdAt: errorLog.createdAt,
                    // 添加结构化的错误详情
                    errorDetails: this.extractErrorDetails(structuredErrors)
                };
            });

            this.logger.log(`Found ${data.length} error log records for job: ${jobId}, total: ${total}`);

            return {
                data,
                total,
                page,
                pageSize,
                totalPages,
            };
        } catch (error) {
            this.logger.error(`Failed to query error logs for job ${jobId}:`, error);
            throw error;
        }
    }

    /**
<<<<<<< HEAD
     * 从错误数据中提取结构化的错误详情
     * @param errors 错误数据
     * @returns 结构化的错误详情
     */
    private extractErrorDetails(errors: any): Array<{
        field: string;
        rule: string;
        invalidValue: any;
        expectedFormat: string;
        message: string;
    }> {
        const errorDetails: Array<{
            field: string;
            rule: string;
            invalidValue: any;
            expectedFormat: string;
            message: string;
        }> = [];

        try {
            if (Array.isArray(errors)) {
                // 如果errors是数组，遍历每个错误
                for (const error of errors) {
                    errorDetails.push({
                        field: error.field || '未知字段',
                        rule: error.rule || error.ruleName || '未知规则',
                        invalidValue: error.value || error.invalidValue || '未知值',
                        expectedFormat: error.expectedFormat || error.expected || '未指定格式',
                        message: error.message || error.error || '验证失败'
                    });
                }
            } else if (typeof errors === 'object' && errors !== null) {
                // 如果errors是对象，尝试提取错误信息
                if (errors.field || errors.rule || errors.message) {
                    errorDetails.push({
                        field: errors.field || '未知字段',
                        rule: errors.rule || errors.ruleName || '未知规则',
                        invalidValue: errors.value || errors.invalidValue || '未知值',
                        expectedFormat: errors.expectedFormat || errors.expected || '未指定格式',
                        message: errors.message || errors.error || '验证失败'
                    });
                } else {
                    // 如果是其他对象格式，尝试遍历属性
                    for (const [key, value] of Object.entries(errors)) {
                        if (typeof value === 'object' && value !== null) {
                            errorDetails.push({
                                field: key,
                                rule: (value as any).rule || (value as any).ruleName || '未知规则',
                                invalidValue: (value as any).value || (value as any).invalidValue || '未知值',
                                expectedFormat: (value as any).expectedFormat || (value as any).expected || '未指定格式',
                                message: (value as any).message || (value as any).error || '验证失败'
                            });
                        } else {
                            errorDetails.push({
                                field: key,
                                rule: '未知规则',
                                invalidValue: value,
                                expectedFormat: '未指定格式',
                                message: String(value)
                            });
                        }
                    }
                }
            } else {
                // 如果是字符串或其他类型，创建通用错误详情
                errorDetails.push({
                    field: '未知字段',
                    rule: '未知规则',
                    invalidValue: errors,
                    expectedFormat: '未指定格式',
                    message: String(errors)
                });
            }
        } catch (extractError) {
            this.logger.warn(`Failed to extract error details: ${extractError.message}`);
            errorDetails.push({
                field: '解析错误',
                rule: '错误详情提取失败',
                invalidValue: errors,
                expectedFormat: '无法确定',
                message: '无法提取错误详情，请检查原始错误数据'
            });
        }

        return errorDetails;
    }

    /**
=======
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
     * 验证数据完整性
     * @param jobId 任务ID
     * @param expectedTotal 期望的总行数
     * @returns 完整性检查结果
     */
    async verifyDataIntegrity(jobId: string, expectedTotal: number): Promise<IntegrityCheckResult> {
        this.logger.log(`Verifying data integrity for job: ${jobId}, expected total: ${expectedTotal}`);

        try {
            // 查询清洁数据数量
            const cleanDataCount = await this.cleanDataRepository.count({
                where: { jobId },
            });

            // 查询错误日志数量
            const errorLogCount = await this.errorLogRepository.count({
                where: { jobId },
            });

            const totalCount = cleanDataCount + errorLogCount;
            const isValid = totalCount === expectedTotal;

            const result: IntegrityCheckResult = {
                isValid,
                cleanDataCount,
                errorLogCount,
                totalCount,
                expectedCount: expectedTotal,
                message: isValid
                    ? 'Data integrity check passed'
                    : `Data integrity check failed: expected ${expectedTotal}, got ${totalCount} (clean: ${cleanDataCount}, errors: ${errorLogCount})`,
            };

            this.logger.log(`Data integrity check for job ${jobId}: ${result.message}`);
            return result;
        } catch (error) {
            this.logger.error(`Failed to verify data integrity for job ${jobId}:`, error);
            throw error;
        }
    }
}
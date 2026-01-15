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
        data: ErrorLog[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        this.logger.log(`Querying error logs for job: ${jobId}, page: ${page}, pageSize: ${pageSize}`);

        try {
            const [data, total] = await this.errorLogRepository.findAndCount({
                where: { jobId },
                order: { rowNumber: 'ASC' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            });

            const totalPages = Math.ceil(total / pageSize);

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
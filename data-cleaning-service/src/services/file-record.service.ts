import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { FileRecord } from '../entities/file-record.entity';
import { ListFilesDto } from '../common/dto/list-files.dto';
import { FileStatus, Statistics } from '../common/types';

export interface CreateFileRecordDto {
    jobId: string;
    originalFileName: string;
    fileSize: number;
    fileType: string;
    mimeType: string;
    totalRows?: number;
}

@Injectable()
export class FileRecordService {
    constructor(
        @InjectRepository(FileRecord)
        private readonly fileRecordRepository: Repository<FileRecord>,
    ) { }

    /**
     * 创建文件记录
     */
    async createFileRecord(data: CreateFileRecordDto): Promise<FileRecord> {
        const fileRecord = this.fileRecordRepository.create({
            ...data,
            status: FileStatus.PENDING,
            uploadedAt: new Date(),
        });

        return await this.fileRecordRepository.save(fileRecord);
    }

    /**
     * 更新文件记录状态
     */
    async updateFileStatus(
        fileId: string,
        status: FileStatus,
        statistics?: Statistics,
        filePaths?: { cleanDataPath?: string | null; exceptionDataPath?: string | null }
    ): Promise<FileRecord> {
        const fileRecord = await this.fileRecordRepository.findOne({
            where: { id: fileId }
        });

        if (!fileRecord) {
            throw new NotFoundException(`File record with ID ${fileId} not found`);
        }

        fileRecord.status = status;

        if (statistics) {
            if (statistics.totalRows !== undefined) {
                fileRecord.totalRows = statistics.totalRows;
            }
            if (statistics.cleanedRows !== undefined) {
                fileRecord.cleanedRows = statistics.cleanedRows;
            }
            if (statistics.exceptionRows !== undefined) {
                fileRecord.exceptionRows = statistics.exceptionRows;
            }
            if (statistics.processingTime !== undefined) {
                fileRecord.processingTime = statistics.processingTime;
            }
        }

        if (status === FileStatus.COMPLETED) {
            fileRecord.completedAt = new Date();
        }

        // Update file paths if provided
        if (filePaths) {
            if (filePaths.cleanDataPath) {
                fileRecord.cleanDataPath = filePaths.cleanDataPath;
            }
            if (filePaths.exceptionDataPath) {
                fileRecord.exceptionDataPath = filePaths.exceptionDataPath;
            }
        }

        return await this.fileRecordRepository.save(fileRecord);
    }

    /**
     * 查询文件记录列表（支持分页和筛选）
     */
    async listFileRecords(query: ListFilesDto): Promise<{ files: FileRecord[]; total: number }> {
        const { page = 1, pageSize = 10, status, startDate, endDate } = query;

        const queryBuilder = this.fileRecordRepository.createQueryBuilder('file');

        // 状态筛选
        if (status) {
            queryBuilder.andWhere('file.status = :status', { status });
        }

        // 日期范围筛选
        if (startDate && endDate) {
            // 确保结束日期包含当天的所有时间
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);

            queryBuilder.andWhere('file.uploadedAt BETWEEN :startDate AND :endDate', {
                startDate: new Date(startDate),
                endDate: endDateTime,
            });
        } else if (startDate) {
            queryBuilder.andWhere('file.uploadedAt >= :startDate', {
                startDate: new Date(startDate),
            });
        } else if (endDate) {
            // 确保结束日期包含当天的所有时间
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);

            queryBuilder.andWhere('file.uploadedAt <= :endDate', {
                endDate: endDateTime,
            });
        }

        // 分页
        queryBuilder
            .orderBy('file.uploadedAt', 'DESC')
            .skip((page - 1) * pageSize)
            .take(pageSize);

        const [files, total] = await queryBuilder.getManyAndCount();

        return { files, total };
    }

    /**
     * 查询单个文件记录
     */
    async getFileRecord(fileId: string): Promise<FileRecord> {
        const fileRecord = await this.fileRecordRepository.findOne({
            where: { id: fileId }
        });

        if (!fileRecord) {
            throw new NotFoundException(`File record with ID ${fileId} not found`);
        }

        return fileRecord;
    }

    /**
     * 根据jobId查询文件记录
     */
    async getFileRecordByJobId(jobId: string): Promise<FileRecord> {
        const fileRecord = await this.fileRecordRepository.findOne({
            where: { jobId }
        });

        if (!fileRecord) {
            throw new NotFoundException(`File record with job ID ${jobId} not found`);
        }

        return fileRecord;
    }

    /**
     * 删除过期文件记录
     */
    async deleteExpiredRecords(daysOld: number): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const result = await this.fileRecordRepository.delete({
            uploadedAt: Between(new Date('1900-01-01'), cutoffDate),
        });

        return result.affected || 0;
    }

    /**
     * 更新文件记录的任务信息
     */
    async updateFileRecordWithTaskInfo(fileRecord: FileRecord): Promise<FileRecord> {
        return await this.fileRecordRepository.save(fileRecord);
    }
}
import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
    CleanedRow,
    ExceptionRow,
    AddressComponents,
    ColumnType,
    ColumnTypeMap
} from '../common/types';
import { DatabasePersistenceService } from './database-persistence.service';
import { CleanData } from '../entities/clean-data.entity';
import { ErrorLog } from '../entities/error-log.entity';

/**
 * Service for exporting cleaned and exception data to Excel files
 * Handles data formatting, address field splitting, and Excel generation
 */
@Injectable()
export class ExportService {
    private readonly logger = new Logger(ExportService.name);
    private readonly exportDir = path.join(process.cwd(), 'exports');
    private readonly PAGE_SIZE = 10000; // 分页大小，避免一次性加载大量数据

    constructor(
        private readonly databasePersistence: DatabasePersistenceService,
    ) {
        this.ensureExportDirectory();
    }

    /**
     * Export clean data to Excel file from database
     * @param jobId 任务ID
     * @param originalHeaders 原始列头，用于保持顺序
     * @param columnTypes 列类型映射，用于正确格式化
     * @returns Promise<string> - 生成的Excel文件路径
     */
    async exportCleanData(
        jobId: string,
        originalHeaders: string[],
        columnTypes: ColumnTypeMap
    ): Promise<string> {
        this.logger.log(`开始从数据库导出清洁数据，任务ID: ${jobId}`);

        // 从数据库读取清洁数据
        const cleanData: CleanData[] = await this.databasePersistence.getCleanDataByJobId(jobId);

        if (cleanData.length === 0) {
            throw new Error('No clean data to export');
        }

        // 转换为CleanedRow格式
        const cleanedRows: CleanedRow[] = cleanData.map(row => ({
            rowNumber: row.rowNumber,
            originalData: {}, // 数据库中只存储清洗后的数据
            cleanedData: this.cleanDataToRecord(row, originalHeaders),
        }));

        // 准备导出数据
        const exportData = this.prepareCleanDataForExport(cleanedRows, originalHeaders, columnTypes);

        // 生成Excel文件
        const fileName = `clean_data_${Date.now()}.xlsx`;
        const filePath = await this.generateExcel(exportData.data, exportData.headers, fileName);

        this.logger.log(`清洁数据导出完成: ${filePath}, 共 ${cleanData.length} 行`);
        return filePath;
    }

    /**
     * Export exception data to Excel file from database with error details
     * @param jobId 任务ID
     * @param originalHeaders 原始列头，用于保持顺序
     * @returns Promise<string> - 生成的Excel文件路径
     */
    async exportExceptionData(
        jobId: string,
        originalHeaders: string[]
    ): Promise<string> {
        this.logger.log(`开始从数据库导出异常数据，任务ID: ${jobId}`);

        // 从数据库读取错误日志
        const errorLogs: ErrorLog[] = await this.databasePersistence.getErrorLogsByJobId(jobId);

        if (errorLogs.length === 0) {
            throw new Error('No exception data to export');
        }

        // 转换为ExceptionRow格式
        const exceptionRows: ExceptionRow[] = errorLogs.map(log => ({
            rowNumber: log.rowNumber,
            originalData: log.originalData as Record<string, any>,
<<<<<<< HEAD
            errors: [{
                field: 'multiple',
                originalValue: log.originalData,
                errorType: 'validation',
                errorMessage: log.errors, // errors 现在是字符串
            }],
=======
            errors: log.errors as any[],
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
        }));

        // 准备导出数据
        const exportData = this.prepareExceptionDataForExport(exceptionRows, originalHeaders);

        // 生成Excel文件
        const fileName = `exception_data_${Date.now()}.xlsx`;
        const filePath = await this.generateExcel(exportData.data, exportData.headers, fileName);

        this.logger.log(`异常数据导出完成: ${filePath}, 共 ${errorLogs.length} 行`);
        return filePath;
    }

    /**
     * 将CleanData实体转换为Record格式
     * @param cleanData CleanData实体
     * @param headers 列头
     * @returns Record格式的数据
     */
    private cleanDataToRecord(cleanData: CleanData, headers: string[]): Record<string, any> {
        const record: Record<string, any> = {};
<<<<<<< HEAD

=======
        
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
        for (const header of headers) {
            // 从CleanData实体中提取对应的字段
            if (cleanData[header as keyof CleanData] !== undefined) {
                record[header] = cleanData[header as keyof CleanData];
            }
        }
<<<<<<< HEAD

=======
        
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
        return record;
    }

    /**
     * Prepare clean data for Excel export
     * Handles address field splitting and maintains original field order
     */
    private prepareCleanDataForExport(
        cleanData: CleanedRow[],
        originalHeaders: string[],
        columnTypes: ColumnTypeMap
    ): { data: any[]; headers: string[] } {
        const exportHeaders: string[] = [];
        const exportData: any[] = [];

        // Build headers with address field expansion
        for (const header of originalHeaders) {
            const columnType = columnTypes[header];
            if (columnType === ColumnType.ADDRESS) {
                // Split address into components
                exportHeaders.push(`${header}_省`, `${header}_市`, `${header}_区`, `${header}_详细地址`);
            } else {
                exportHeaders.push(header);
            }
        }

        // Process each row
        for (const row of cleanData) {
            const exportRow: any = {};

            for (const header of originalHeaders) {
                const value = row.cleanedData[header];
                const columnType = columnTypes[header];

                if (columnType === ColumnType.ADDRESS && value && typeof value === 'object') {
                    // Handle address components
                    const addressComponents = value as AddressComponents;
                    exportRow[`${header}_省`] = addressComponents.province || '';
                    exportRow[`${header}_市`] = addressComponents.city || '';
                    exportRow[`${header}_区`] = addressComponents.district || '';
                    exportRow[`${header}_详细地址`] = addressComponents.detail || '';
                } else {
                    // Handle regular fields
                    exportRow[header] = this.formatValueForExport(value, columnType);
                }
            }

            exportData.push(exportRow);
        }

        return { data: exportData, headers: exportHeaders };
    }

    /**
     * Prepare exception data for Excel export
     * Includes original data and error information
     */
    private prepareExceptionDataForExport(
        exceptionData: ExceptionRow[],
        originalHeaders: string[]
    ): { data: any[]; headers: string[] } {
        // Headers include original fields plus error information
        const exportHeaders = [...originalHeaders, '行号', '异常字段', '异常原因'];
        const exportData: any[] = [];

        // Process each exception row
        for (const row of exceptionData) {
            const exportRow: any = {};

            // Add original data
            for (const header of originalHeaders) {
                exportRow[header] = row.originalData[header] || '';
            }

            // Add error information
            exportRow['行号'] = row.rowNumber;

            // Combine all field errors into readable format
            const errorFields = row.errors.map(error => error.field).join(', ');
            const errorMessages = row.errors.map(error =>
                `${error.field}: ${error.errorMessage}`
            ).join('; ');

            exportRow['异常字段'] = errorFields;
            exportRow['异常原因'] = errorMessages;

            exportData.push(exportRow);
        }

        return { data: exportData, headers: exportHeaders };
    }

    /**
     * Format value for Excel export based on column type
     */
    private formatValueForExport(value: any, columnType?: ColumnType): any {
        if (value === null || value === undefined) {
            return '';
        }

        switch (columnType) {
            case ColumnType.DATE:
                // Ensure date is in YYYY-MM-DD format
                if (typeof value === 'string') {
                    return value;
                }
                if (value instanceof Date) {
                    return value.toISOString().split('T')[0];
                }
                return String(value);

            case ColumnType.PHONE:
                // Ensure phone is string
                return String(value);

            case ColumnType.NUMBER:
                // Keep as number for Excel
                return typeof value === 'number' ? value : parseFloat(String(value)) || 0;

            case ColumnType.TEXT:
            default:
                return String(value);
        }
    }

    /**
     * Generate Excel file from data
     * @param data - Array of row objects
     * @param headers - Column headers
     * @param fileName - Output file name
     * @returns Promise<string> - Path to generated file
     */
    private async generateExcel(data: any[], headers: string[], fileName: string): Promise<string> {
        try {
            // Create workbook and worksheet
            const workbook = XLSX.utils.book_new();

            // Convert data to worksheet format
            const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });

            // Set column widths for better readability
            const columnWidths = headers.map(header => ({
                wch: Math.max(header.length, 15) // Minimum width of 15 characters
            }));
            worksheet['!cols'] = columnWidths;

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

            // Generate file path
            const filePath = path.join(this.exportDir, fileName);

            // Write file
            XLSX.writeFile(workbook, filePath);

            this.logger.log(`Excel文件生成成功: ${filePath}`);
            return filePath;

        } catch (error) {
            this.logger.error(`生成Excel文件失败: ${error.message}`, error.stack);
            throw new Error(`Failed to generate Excel file: ${error.message}`);
        }
    }

    /**
     * Ensure export directory exists
     */
    private async ensureExportDirectory(): Promise<void> {
        try {
            await fs.access(this.exportDir);
        } catch {
            // Directory doesn't exist, create it
            await fs.mkdir(this.exportDir, { recursive: true });
            this.logger.log(`创建导出目录: ${this.exportDir}`);
        }
    }

    /**
     * Clean up old export files
     * @param maxAgeHours - Maximum age in hours before files are deleted
     */
    async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
        try {
            const files = await fs.readdir(this.exportDir);
            const now = Date.now();
            const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds

            for (const file of files) {
                const filePath = path.join(this.exportDir, file);
                const stats = await fs.stat(filePath);

                if (now - stats.mtime.getTime() > maxAge) {
                    await fs.unlink(filePath);
                    this.logger.log(`删除过期文件: ${file}`);
                }
            }
        } catch (error) {
            this.logger.error(`清理过期文件失败: ${error.message}`, error.stack);
        }
    }

    /**
     * Get file stream for download
     * @param filePath - Path to file
     * @returns Promise<Buffer> - File buffer for streaming
     */
    async getFileBuffer(filePath: string): Promise<Buffer> {
        try {
            const buffer = await fs.readFile(filePath);
            return buffer;
        } catch (error) {
            this.logger.error(`读取文件失败: ${filePath}`, error.stack);
            throw new Error(`File not found or cannot be read: ${filePath}`);
        }
    }

    /**
     * Delete export file
     * @param filePath - Path to file to delete
     */
    async deleteFile(filePath: string): Promise<void> {
        try {
            await fs.unlink(filePath);
            this.logger.log(`删除文件: ${filePath}`);
        } catch (error) {
            this.logger.error(`删除文件失败: ${filePath}`, error.stack);
            throw new Error(`Failed to delete file: ${filePath}`);
        }
    }
}

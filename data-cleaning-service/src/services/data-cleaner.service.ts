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
import { Test, TestingModule } from '@nestjs/testing';
import { ExportService } from './export.service';
import {
    CleanedRow,
    ExceptionRow,
    ColumnType,
    ColumnTypeMap,
    AddressComponents,
    FieldError
} from '../common/types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ExportService', () => {
    let service: ExportService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ExportService],
        }).compile();

        service = module.get<ExportService>(ExportService);
    });

    afterEach(async () => {
        // Clean up test files
        try {
            const exportDir = path.join(process.cwd(), 'exports');
            const files = await fs.readdir(exportDir);
            for (const file of files) {
                if (file.includes('test_') || file.includes('clean_data_') || file.includes('exception_data_')) {
                    await fs.unlink(path.join(exportDir, file));
                }
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('exportCleanData', () => {
        it('should export clean data to Excel file', async () => {
            // Arrange
            const cleanData: CleanedRow[] = [
                {
                    rowNumber: 1,
                    originalData: { name: 'John Doe', phone: '138 1234 5678' },
                    cleanedData: { name: 'John Doe', phone: '13812345678' }
                },
                {
                    rowNumber: 2,
                    originalData: { name: 'Jane Smith', phone: '139-5678-9012' },
                    cleanedData: { name: 'Jane Smith', phone: '13956789012' }
                }
            ];

            const originalHeaders = ['name', 'phone'];
            const columnTypes: ColumnTypeMap = {
                name: ColumnType.TEXT,
                phone: ColumnType.PHONE
            };

            // Act
            const filePath = await service.exportCleanData(cleanData, originalHeaders, columnTypes);

            // Assert
            expect(filePath).toBeDefined();
            expect(filePath).toContain('clean_data_');
            expect(filePath).toContain('.xlsx');

            // Verify file exists
            const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
            expect(fileExists).toBe(true);
        });

        it('should handle address field splitting', async () => {
            // Arrange
            const addressComponents: AddressComponents = {
                province: '北京市',
                city: '朝阳区',
                district: '三里屯街道',
                detail: '工体北路1号'
            };

            const cleanData: CleanedRow[] = [
                {
                    rowNumber: 1,
                    originalData: { name: 'John Doe', address: '北京市朝阳区三里屯街道工体北路1号' },
                    cleanedData: { name: 'John Doe', address: addressComponents }
                }
            ];

            const originalHeaders = ['name', 'address'];
            const columnTypes: ColumnTypeMap = {
                name: ColumnType.TEXT,
                address: ColumnType.ADDRESS
            };

            // Act
            const filePath = await service.exportCleanData(cleanData, originalHeaders, columnTypes);

            // Assert
            expect(filePath).toBeDefined();

            // Verify file exists
            const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
            expect(fileExists).toBe(true);
        });

        it('should throw error when no clean data provided', async () => {
            // Arrange
            const cleanData: CleanedRow[] = [];
            const originalHeaders = ['name', 'phone'];
            const columnTypes: ColumnTypeMap = {};

            // Act & Assert
            await expect(service.exportCleanData(cleanData, originalHeaders, columnTypes))
                .rejects.toThrow('No clean data to export');
        });
    });

    describe('exportExceptionData', () => {
        it('should export exception data with error details', async () => {
            // Arrange
            const fieldErrors: FieldError[] = [
                {
                    field: 'phone',
                    originalValue: 'invalid-phone',
                    errorType: 'INVALID_PHONE',
                    errorMessage: 'Invalid phone number format'
                }
            ];

            const exceptionData: ExceptionRow[] = [
                {
                    rowNumber: 1,
                    originalData: { name: 'John Doe', phone: 'invalid-phone' },
                    errors: fieldErrors
                },
                {
                    rowNumber: 2,
                    originalData: { name: 'Jane Smith', phone: '123' },
                    errors: [
                        {
                            field: 'phone',
                            originalValue: '123',
                            errorType: 'INVALID_PHONE',
                            errorMessage: 'Phone number too short'
                        }
                    ]
                }
            ];

            const originalHeaders = ['name', 'phone'];

            // Act
            const filePath = await service.exportExceptionData(exceptionData, originalHeaders);

            // Assert
            expect(filePath).toBeDefined();
            expect(filePath).toContain('exception_data_');
            expect(filePath).toContain('.xlsx');

            // Verify file exists
            const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
            expect(fileExists).toBe(true);
        });

        it('should throw error when no exception data provided', async () => {
            // Arrange
            const exceptionData: ExceptionRow[] = [];
            const originalHeaders = ['name', 'phone'];

            // Act & Assert
            await expect(service.exportExceptionData(exceptionData, originalHeaders))
                .rejects.toThrow('No exception data to export');
        });
    });

    describe('getFileBuffer', () => {
        it('should return file buffer for existing file', async () => {
            // Arrange - Create a test file first
            const cleanData: CleanedRow[] = [
                {
                    rowNumber: 1,
                    originalData: { name: 'Test' },
                    cleanedData: { name: 'Test' }
                }
            ];

            const filePath = await service.exportCleanData(
                cleanData,
                ['name'],
                { name: ColumnType.TEXT }
            );

            // Act
            const buffer = await service.getFileBuffer(filePath);

            // Assert
            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);
        });

        it('should throw error for non-existent file', async () => {
            // Arrange
            const nonExistentPath = '/path/to/non-existent-file.xlsx';

            // Act & Assert
            await expect(service.getFileBuffer(nonExistentPath))
                .rejects.toThrow('File not found or cannot be read');
        });
    });

    describe('cleanupOldFiles', () => {
        it('should not throw error when cleaning up files', async () => {
            // Act & Assert
            await expect(service.cleanupOldFiles(0)).resolves.not.toThrow();
        });
    });
});
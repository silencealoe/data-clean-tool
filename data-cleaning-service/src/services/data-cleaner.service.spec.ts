import { Test, TestingModule } from '@nestjs/testing';
import { DataCleanerService } from './data-cleaner.service';
import { PhoneCleanerService } from './phone-cleaner.service';
import { DateCleanerService } from './date-cleaner.service';
import { AddressCleanerService } from './address-cleaner.service';
import {
    ParsedData,
    ColumnType,
    RowData,
    ColumnTypeMap,
    SheetData
} from '../common/types';

describe('DataCleanerService', () => {
    let service: DataCleanerService;
    let phoneCleanerService: PhoneCleanerService;
    let dateCleanerService: DateCleanerService;
    let addressCleanerService: AddressCleanerService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DataCleanerService,
                PhoneCleanerService,
                DateCleanerService,
                AddressCleanerService,
            ],
        }).compile();

        service = module.get<DataCleanerService>(DataCleanerService);
        phoneCleanerService = module.get<PhoneCleanerService>(PhoneCleanerService);
        dateCleanerService = module.get<DateCleanerService>(DateCleanerService);
        addressCleanerService = module.get<AddressCleanerService>(AddressCleanerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('cleanData', () => {
        it('should process parsed data and return cleaning result', async () => {
            // Arrange
            const parsedData: ParsedData = {
                sheets: [
                    {
                        name: 'Sheet1',
                        headers: ['姓名', '手机号', '日期', '地址'],
                        rows: [
                            {
                                rowNumber: 2,
                                data: {
                                    '姓名': '张三',
                                    '手机号': '138 1234 5678',
                                    '日期': '2024-01-15',
                                    '地址': '北京市朝阳区三里屯街道'
                                }
                            },
                            {
                                rowNumber: 3,
                                data: {
                                    '姓名': '李四',
                                    '手机号': 'invalid-phone',
                                    '日期': 'invalid-date',
                                    '地址': '上海市浦东新区'
                                }
                            }
                        ],
                        columnTypes: {
                            '姓名': ColumnType.TEXT,
                            '手机号': ColumnType.PHONE,
                            '日期': ColumnType.DATE,
                            '地址': ColumnType.ADDRESS
                        }
                    }
                ],
                totalRows: 2
            };

            // Act
            const result = await service.cleanData(parsedData);

            // Assert
            expect(result).toBeDefined();
            expect(result.jobId).toBeDefined();
            expect(result.statistics.totalRows).toBe(2);
            expect(result.statistics.cleanedRows + result.statistics.exceptionRows).toBe(2);
            expect(result.statistics.processingTime).toBeGreaterThan(0);
            expect(result.cleanData).toBeDefined();
            expect(result.exceptionData).toBeDefined();
        });

        it('should handle empty parsed data', async () => {
            // Arrange
            const parsedData: ParsedData = {
                sheets: [],
                totalRows: 0
            };

            // Act
            const result = await service.cleanData(parsedData);

            // Assert
            expect(result.statistics.totalRows).toBe(0);
            expect(result.statistics.cleanedRows).toBe(0);
            expect(result.statistics.exceptionRows).toBe(0);
            expect(result.cleanData).toHaveLength(0);
            expect(result.exceptionData).toHaveLength(0);
        });
    });

    describe('cleanRow', () => {
        it('should clean a row with valid data', () => {
            // Arrange
            const row: RowData = {
                rowNumber: 2,
                data: {
                    '姓名': '张三',
                    '手机号': '13812345678',
                    '日期': '2024-01-15'
                }
            };

            const columnTypes: ColumnTypeMap = {
                '姓名': ColumnType.TEXT,
                '手机号': ColumnType.PHONE,
                '日期': ColumnType.DATE
            };

            // Act
            const result = service.cleanRow(row, columnTypes);

            // Assert
            expect(result.rowNumber).toBe(2);
            expect(result.originalData).toEqual(row.data);
            expect(result.cleanedData).toBeDefined();
            expect(result.errors).toHaveLength(0);
        });

        it('should handle row with invalid data', () => {
            // Arrange
            const row: RowData = {
                rowNumber: 3,
                data: {
                    '姓名': '李四',
                    '手机号': 'invalid-phone',
                    '日期': 'invalid-date'
                }
            };

            const columnTypes: ColumnTypeMap = {
                '姓名': ColumnType.TEXT,
                '手机号': ColumnType.PHONE,
                '日期': ColumnType.DATE
            };

            // Act
            const result = service.cleanRow(row, columnTypes);

            // Assert
            expect(result.rowNumber).toBe(3);
            expect(result.originalData).toEqual(row.data);
            expect(result.cleanedData).toBeDefined();
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should handle empty values', () => {
            // Arrange
            const row: RowData = {
                rowNumber: 4,
                data: {
                    '姓名': '',
                    '手机号': null,
                    '日期': undefined
                }
            };

            const columnTypes: ColumnTypeMap = {
                '姓名': ColumnType.TEXT,
                '手机号': ColumnType.PHONE,
                '日期': ColumnType.DATE
            };

            // Act
            const result = service.cleanRow(row, columnTypes);

            // Assert
            expect(result.rowNumber).toBe(4);
            expect(result.originalData).toEqual(row.data);
            expect(result.cleanedData).toBeDefined();
            // Empty values should be allowed for now
            expect(result.errors).toHaveLength(0);
        });

        it('should handle number type fields', () => {
            // Arrange
            const row: RowData = {
                rowNumber: 5,
                data: {
                    '年龄': '25',
                    '收入': '50,000.50',
                    '无效数字': 'not-a-number'
                }
            };

            const columnTypes: ColumnTypeMap = {
                '年龄': ColumnType.NUMBER,
                '收入': ColumnType.NUMBER,
                '无效数字': ColumnType.NUMBER
            };

            // Act
            const result = service.cleanRow(row, columnTypes);

            // Assert
            expect(result.rowNumber).toBe(5);
            expect(result.cleanedData['年龄']).toBe(25);
            expect(result.cleanedData['收入']).toBe(50000.50);
            expect(result.errors.some(e => e.field === '无效数字')).toBe(true);
        });

        it('should handle address type fields', () => {
            // Arrange
            const row: RowData = {
                rowNumber: 6,
                data: {
                    '地址': '北京市朝阳区三里屯街道',
                    '无效地址': 'invalid address'
                }
            };

            const columnTypes: ColumnTypeMap = {
                '地址': ColumnType.ADDRESS,
                '无效地址': ColumnType.ADDRESS
            };

            // Act
            const result = service.cleanRow(row, columnTypes);

            // Assert
            expect(result.rowNumber).toBe(6);
            expect(result.cleanedData['地址']).toBeDefined();
            // The invalid address should generate an error
            expect(result.errors.some(e => e.field === '无效地址')).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should handle unexpected errors during field cleaning', () => {
            // Arrange
            const row: RowData = {
                rowNumber: 7,
                data: {
                    '手机号': '13812345678'
                }
            };

            const columnTypes: ColumnTypeMap = {
                '手机号': ColumnType.PHONE
            };

            // Mock the phone cleaner to throw an error
            jest.spyOn(phoneCleanerService, 'cleanPhone').mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            // Act
            const result = service.cleanRow(row, columnTypes);

            // Assert
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('PROCESSING_ERROR');
            expect(result.errors[0].errorMessage).toContain('Unexpected error during cleaning');
        });
    });
});
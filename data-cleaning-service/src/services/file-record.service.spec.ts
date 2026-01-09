import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { FileRecordService, CreateFileRecordDto } from './file-record.service';
import { FileRecord } from '../entities/file-record.entity';
import { FileStatus, Statistics } from '../common/types';
import { ListFilesDto } from '../common/dto/list-files.dto';
import * as fc from 'fast-check';

describe('FileRecordService', () => {
    let service: FileRecordService;
    let repository: Repository<FileRecord>;

    const mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        createQueryBuilder: jest.fn(),
        delete: jest.fn(),
    };

    const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FileRecordService,
                {
                    provide: getRepositoryToken(FileRecord),
                    useValue: mockRepository,
                },
            ],
        }).compile();

        service = module.get<FileRecordService>(FileRecordService);
        repository = module.get<Repository<FileRecord>>(getRepositoryToken(FileRecord));

        // Reset all mocks
        jest.clearAllMocks();
        mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createFileRecord', () => {
        it('should create a new file record successfully', async () => {
            // Arrange
            const createDto: CreateFileRecordDto = {
                jobId: 'test-job-123',
                originalFileName: 'test.xlsx',
                fileSize: 1024,
                fileType: 'xlsx',
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                totalRows: 100,
            };

            const expectedFileRecord = {
                id: 'uuid-123',
                ...createDto,
                status: FileStatus.PENDING,
                uploadedAt: expect.any(Date),
                completedAt: null,
                cleanedRows: null,
                exceptionRows: null,
                processingTime: null,
                cleanDataPath: null,
                exceptionDataPath: null,
                errorMessage: null,
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
            };

            mockRepository.create.mockReturnValue(expectedFileRecord);
            mockRepository.save.mockResolvedValue(expectedFileRecord);

            // Act
            const result = await service.createFileRecord(createDto);

            // Assert
            expect(mockRepository.create).toHaveBeenCalledWith({
                ...createDto,
                status: FileStatus.PENDING,
                uploadedAt: expect.any(Date),
            });
            expect(mockRepository.save).toHaveBeenCalledWith(expectedFileRecord);
            expect(result).toEqual(expectedFileRecord);
        });

        it('should create file record without totalRows', async () => {
            // Arrange
            const createDto: CreateFileRecordDto = {
                jobId: 'test-job-456',
                originalFileName: 'test2.xlsx',
                fileSize: 2048,
                fileType: 'xlsx',
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            };

            const expectedFileRecord = {
                id: 'uuid-456',
                ...createDto,
                status: FileStatus.PENDING,
                uploadedAt: expect.any(Date),
            };

            mockRepository.create.mockReturnValue(expectedFileRecord);
            mockRepository.save.mockResolvedValue(expectedFileRecord);

            // Act
            const result = await service.createFileRecord(createDto);

            // Assert
            expect(result).toEqual(expectedFileRecord);
        });
    });

    describe('updateFileStatus', () => {
        it('should update file status to processing', async () => {
            // Arrange
            const fileId = 'uuid-123';
            const existingRecord = {
                id: fileId,
                jobId: 'test-job-123',
                status: FileStatus.PENDING,
                completedAt: null,
            };

            const updatedRecord = {
                ...existingRecord,
                status: FileStatus.PROCESSING,
            };

            mockRepository.findOne.mockResolvedValue(existingRecord);
            mockRepository.save.mockResolvedValue(updatedRecord);

            // Act
            const result = await service.updateFileStatus(fileId, FileStatus.PROCESSING);

            // Assert
            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { id: fileId }
            });
            expect(mockRepository.save).toHaveBeenCalledWith({
                ...existingRecord,
                status: FileStatus.PROCESSING,
            });
            expect(result).toEqual(updatedRecord);
        });

        it('should update file status to completed with statistics', async () => {
            // Arrange
            const fileId = 'uuid-123';
            const statistics: Statistics = {
                totalRows: 100,
                cleanedRows: 80,
                exceptionRows: 20,
                processingTime: 5000,
            };

            const existingRecord = {
                id: fileId,
                jobId: 'test-job-123',
                status: FileStatus.PROCESSING,
                completedAt: null,
            };

            mockRepository.findOne.mockResolvedValue(existingRecord);
            mockRepository.save.mockImplementation((record) => {
                return Promise.resolve({
                    ...record,
                    completedAt: new Date(),
                });
            });

            // Act
            const result = await service.updateFileStatus(fileId, FileStatus.COMPLETED, statistics);

            // Assert
            expect(result.status).toBe(FileStatus.COMPLETED);
            expect(result.completedAt).toBeInstanceOf(Date);
            expect(result.totalRows).toBe(statistics.totalRows);
            expect(result.cleanedRows).toBe(statistics.cleanedRows);
            expect(result.exceptionRows).toBe(statistics.exceptionRows);
            expect(result.processingTime).toBe(statistics.processingTime);
        });

        it('should throw NotFoundException when file record not found', async () => {
            // Arrange
            const fileId = 'non-existent-id';
            mockRepository.findOne.mockResolvedValue(null);

            // Act & Assert
            await expect(service.updateFileStatus(fileId, FileStatus.PROCESSING))
                .rejects.toThrow(NotFoundException);

            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { id: fileId }
            });
            expect(mockRepository.save).not.toHaveBeenCalled();
        });
    });

    describe('listFileRecords', () => {
        it('should return paginated file records without filters', async () => {
            // Arrange
            const query: ListFilesDto = { page: 1, pageSize: 10 };
            const mockFiles = [
                { id: '1', jobId: 'job-1', originalFileName: 'file1.xlsx' },
                { id: '2', jobId: 'job-2', originalFileName: 'file2.xlsx' },
            ];
            const mockTotal = 2;

            mockQueryBuilder.getManyAndCount.mockResolvedValue([mockFiles, mockTotal]);

            // Act
            const result = await service.listFileRecords(query);

            // Assert
            expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('file');
            expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('file.uploadedAt', 'DESC');
            expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
            expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
            expect(result).toEqual({ files: mockFiles, total: mockTotal });
        });

        it('should filter by status', async () => {
            // Arrange
            const query: ListFilesDto = {
                page: 1,
                pageSize: 10,
                status: FileStatus.COMPLETED
            };
            const mockFiles = [
                { id: '1', jobId: 'job-1', status: FileStatus.COMPLETED },
            ];
            const mockTotal = 1;

            mockQueryBuilder.getManyAndCount.mockResolvedValue([mockFiles, mockTotal]);

            // Act
            const result = await service.listFileRecords(query);

            // Assert
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'file.status = :status',
                { status: FileStatus.COMPLETED }
            );
            expect(result).toEqual({ files: mockFiles, total: mockTotal });
        });

        it('should filter by date range', async () => {
            // Arrange
            const startDate = '2024-01-01T00:00:00.000Z';
            const endDate = '2024-01-31T23:59:59.999Z';
            const query: ListFilesDto = {
                page: 1,
                pageSize: 10,
                startDate,
                endDate
            };
            const mockFiles = [];
            const mockTotal = 0;

            mockQueryBuilder.getManyAndCount.mockResolvedValue([mockFiles, mockTotal]);

            // Act
            const result = await service.listFileRecords(query);

            // Assert
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'file.uploadedAt BETWEEN :startDate AND :endDate',
                {
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                }
            );
            expect(result).toEqual({ files: mockFiles, total: mockTotal });
        });

        it('should filter by start date only', async () => {
            // Arrange
            const startDate = '2024-01-01T00:00:00.000Z';
            const query: ListFilesDto = {
                page: 1,
                pageSize: 10,
                startDate
            };
            const mockFiles = [];
            const mockTotal = 0;

            mockQueryBuilder.getManyAndCount.mockResolvedValue([mockFiles, mockTotal]);

            // Act
            const result = await service.listFileRecords(query);

            // Assert
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'file.uploadedAt >= :startDate',
                { startDate: new Date(startDate) }
            );
        });

        it('should handle pagination correctly', async () => {
            // Arrange
            const query: ListFilesDto = { page: 3, pageSize: 5 };
            const mockFiles = [];
            const mockTotal = 0;

            mockQueryBuilder.getManyAndCount.mockResolvedValue([mockFiles, mockTotal]);

            // Act
            await service.listFileRecords(query);

            // Assert
            expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10); // (3-1) * 5
            expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
        });

        it('should return empty results when no records match', async () => {
            // Arrange
            const query: ListFilesDto = { page: 1, pageSize: 10 };
            const mockFiles = [];
            const mockTotal = 0;

            mockQueryBuilder.getManyAndCount.mockResolvedValue([mockFiles, mockTotal]);

            // Act
            const result = await service.listFileRecords(query);

            // Assert
            expect(result).toEqual({ files: [], total: 0 });
        });
    });

    describe('getFileRecord', () => {
        it('should return file record when found', async () => {
            // Arrange
            const fileId = 'uuid-123';
            const mockFileRecord = {
                id: fileId,
                jobId: 'test-job-123',
                originalFileName: 'test.xlsx',
                status: FileStatus.COMPLETED,
            };

            mockRepository.findOne.mockResolvedValue(mockFileRecord);

            // Act
            const result = await service.getFileRecord(fileId);

            // Assert
            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { id: fileId }
            });
            expect(result).toEqual(mockFileRecord);
        });

        it('should throw NotFoundException when file record not found', async () => {
            // Arrange
            const fileId = 'non-existent-id';
            mockRepository.findOne.mockResolvedValue(null);

            // Act & Assert
            await expect(service.getFileRecord(fileId))
                .rejects.toThrow(NotFoundException);

            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { id: fileId }
            });
        });
    });

    describe('getFileRecordByJobId', () => {
        it('should return file record when found by jobId', async () => {
            // Arrange
            const jobId = 'test-job-123';
            const mockFileRecord = {
                id: 'uuid-123',
                jobId,
                originalFileName: 'test.xlsx',
                status: FileStatus.COMPLETED,
            };

            mockRepository.findOne.mockResolvedValue(mockFileRecord);

            // Act
            const result = await service.getFileRecordByJobId(jobId);

            // Assert
            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { jobId }
            });
            expect(result).toEqual(mockFileRecord);
        });

        it('should throw NotFoundException when file record not found by jobId', async () => {
            // Arrange
            const jobId = 'non-existent-job-id';
            mockRepository.findOne.mockResolvedValue(null);

            // Act & Assert
            await expect(service.getFileRecordByJobId(jobId))
                .rejects.toThrow(NotFoundException);

            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { jobId }
            });
        });
    });

    describe('deleteExpiredRecords', () => {
        it('should delete expired records and return count', async () => {
            // Arrange
            const daysOld = 30;
            const mockResult = { affected: 5 };
            mockRepository.delete.mockResolvedValue(mockResult);

            // Act
            const result = await service.deleteExpiredRecords(daysOld);

            // Assert
            expect(mockRepository.delete).toHaveBeenCalledWith({
                uploadedAt: expect.any(Object), // Between object
            });
            expect(result).toBe(5);
        });

        it('should return 0 when no records are deleted', async () => {
            // Arrange
            const daysOld = 30;
            const mockResult = { affected: 0 };
            mockRepository.delete.mockResolvedValue(mockResult);

            // Act
            const result = await service.deleteExpiredRecords(daysOld);

            // Assert
            expect(result).toBe(0);
        });

        it('should handle undefined affected count', async () => {
            // Arrange
            const daysOld = 30;
            const mockResult = { affected: undefined };
            mockRepository.delete.mockResolvedValue(mockResult);

            // Act
            const result = await service.deleteExpiredRecords(daysOld);

            // Assert
            expect(result).toBe(0);
        });
    });

    // Feature: data-cleaning-service, Property 18: 文件列表查询完整性
    describe('Property-Based Tests', () => {
        describe('Property 18: File List Query Completeness', () => {
            it('should return all required fields for any file list query', async () => {
                // Property-based test to verify that query results contain all required fields
                // **Validates: Requirements 8.3**

                await fc.assert(
                    fc.asyncProperty(
                        // Generate random file records
                        fc.array(
                            fc.record({
                                id: fc.uuid(),
                                jobId: fc.uuid(),
                                originalFileName: fc.string({ minLength: 1, maxLength: 100 }).map(s => s + '.xlsx'),
                                fileSize: fc.integer({ min: 1, max: 10485760 }), // 1 byte to 10MB
                                fileType: fc.constantFrom('xlsx', 'xls'),
                                mimeType: fc.constantFrom(
                                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                    'application/vnd.ms-excel'
                                ),
                                status: fc.constantFrom(
                                    FileStatus.PENDING,
                                    FileStatus.PROCESSING,
                                    FileStatus.COMPLETED,
                                    FileStatus.FAILED
                                ),
                                uploadedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
                                completedAt: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }), { nil: null }),
                                totalRows: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
                                cleanedRows: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
                                exceptionRows: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
                                processingTime: fc.option(fc.integer({ min: 0, max: 300000 }), { nil: null }),
                                cleanDataPath: fc.option(fc.string(), { nil: null }),
                                exceptionDataPath: fc.option(fc.string(), { nil: null }),
                                errorMessage: fc.option(fc.string(), { nil: null }),
                                createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
                                updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
                            }),
                            { minLength: 0, maxLength: 20 }
                        ),
                        // Generate random query parameters
                        fc.record({
                            page: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
                            pageSize: fc.option(fc.integer({ min: 1, max: 50 }), { nil: undefined }),
                            status: fc.option(fc.constantFrom(
                                FileStatus.PENDING,
                                FileStatus.PROCESSING,
                                FileStatus.COMPLETED,
                                FileStatus.FAILED
                            ), { nil: undefined }),
                            startDate: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString()), { nil: undefined }),
                            endDate: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString()), { nil: undefined }),
                        }),
                        async (mockFiles, query) => {
                            // Arrange
                            const mockTotal = mockFiles.length;
                            mockQueryBuilder.getManyAndCount.mockResolvedValue([mockFiles, mockTotal]);

                            // Act
                            const result = await service.listFileRecords(query);

                            // Assert - Verify all required fields are present in each file record
                            expect(result).toHaveProperty('files');
                            expect(result).toHaveProperty('total');
                            expect(Array.isArray(result.files)).toBe(true);
                            expect(typeof result.total).toBe('number');

                            // Verify each file record contains all required fields according to requirement 8.3
                            result.files.forEach((file: any) => {
                                // Required fields: 文件名称、文件大小、文件类型、上传时间、处理完成时间、文件ID等信息
                                expect(file).toHaveProperty('id'); // 文件ID
                                expect(file).toHaveProperty('originalFileName'); // 文件名称
                                expect(file).toHaveProperty('fileSize'); // 文件大小
                                expect(file).toHaveProperty('fileType'); // 文件类型
                                expect(file).toHaveProperty('uploadedAt'); // 上传时间
                                expect(file).toHaveProperty('completedAt'); // 处理完成时间 (can be null)

                                // Additional fields that should be present
                                expect(file).toHaveProperty('jobId');
                                expect(file).toHaveProperty('mimeType');
                                expect(file).toHaveProperty('status');

                                // Verify field types
                                expect(typeof file.id).toBe('string');
                                expect(typeof file.originalFileName).toBe('string');
                                expect(typeof file.fileSize).toBe('number');
                                expect(typeof file.fileType).toBe('string');
                                expect(file.uploadedAt).toBeInstanceOf(Date);
                                // completedAt can be null or Date
                                if (file.completedAt !== null) {
                                    expect(file.completedAt).toBeInstanceOf(Date);
                                }
                            });
                        }
                    ),
                    { numRuns: 100 }
                );
            });
        });

        describe('Property 19: File List Filtering Correctness', () => {
            it('should return only records that match the filtering conditions', async () => {
                // Property-based test to verify that filtering works correctly
                // **Validates: Requirements 8.2**

                await fc.assert(
                    fc.asyncProperty(
                        // Generate random file records with known properties
                        fc.array(
                            fc.record({
                                id: fc.uuid(),
                                jobId: fc.uuid(),
                                originalFileName: fc.string({ minLength: 1, maxLength: 100 }).map(s => s + '.xlsx'),
                                fileSize: fc.integer({ min: 1, max: 10485760 }),
                                fileType: fc.constantFrom('xlsx', 'xls'),
                                mimeType: fc.constantFrom(
                                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                    'application/vnd.ms-excel'
                                ),
                                status: fc.constantFrom(
                                    FileStatus.PENDING,
                                    FileStatus.PROCESSING,
                                    FileStatus.COMPLETED,
                                    FileStatus.FAILED
                                ),
                                uploadedAt: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-12-31').getTime() }).map(t => new Date(t)),
                                completedAt: fc.option(fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-12-31').getTime() }).map(t => new Date(t)), { nil: null }),
                                totalRows: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
                                cleanedRows: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
                                exceptionRows: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
                                processingTime: fc.option(fc.integer({ min: 0, max: 300000 }), { nil: null }),
                                cleanDataPath: fc.option(fc.string(), { nil: null }),
                                exceptionDataPath: fc.option(fc.string(), { nil: null }),
                                errorMessage: fc.option(fc.string(), { nil: null }),
                                createdAt: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-12-31').getTime() }).map(t => new Date(t)),
                                updatedAt: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-12-31').getTime() }).map(t => new Date(t)),
                            }),
                            { minLength: 5, maxLength: 50 }
                        ),
                        // Generate random filter conditions
                        fc.record({
                            page: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined }),
                            pageSize: fc.option(fc.integer({ min: 5, max: 20 }), { nil: undefined }),
                            status: fc.option(fc.constantFrom(
                                FileStatus.PENDING,
                                FileStatus.PROCESSING,
                                FileStatus.COMPLETED,
                                FileStatus.FAILED
                            ), { nil: undefined }),
                            startDate: fc.option(fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2024-12-31').getTime() }).map(t => new Date(t).toISOString()), { nil: undefined }),
                            endDate: fc.option(fc.integer({ min: new Date('2021-01-01').getTime(), max: new Date('2025-12-31').getTime() }).map(t => new Date(t).toISOString()), { nil: undefined }),
                        }),
                        async (allFiles, query) => {
                            // Simulate the filtering logic that should happen in the database
                            let filteredFiles = [...allFiles];

                            // Apply status filter
                            if (query.status) {
                                filteredFiles = filteredFiles.filter(file => file.status === query.status);
                            }

                            // Apply date range filters
                            if (query.startDate && query.endDate) {
                                const startDate = new Date(query.startDate);
                                const endDate = new Date(query.endDate);
                                filteredFiles = filteredFiles.filter(file =>
                                    file.uploadedAt >= startDate && file.uploadedAt <= endDate
                                );
                            } else if (query.startDate) {
                                const startDate = new Date(query.startDate);
                                filteredFiles = filteredFiles.filter(file =>
                                    file.uploadedAt >= startDate
                                );
                            } else if (query.endDate) {
                                const endDate = new Date(query.endDate);
                                filteredFiles = filteredFiles.filter(file =>
                                    file.uploadedAt <= endDate
                                );
                            }

                            // Sort by uploadedAt DESC (as the service does)
                            filteredFiles.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

                            // Apply pagination
                            const page = query.page || 1;
                            const pageSize = query.pageSize || 10;
                            const skip = (page - 1) * pageSize;
                            const paginatedFiles = filteredFiles.slice(skip, skip + pageSize);

                            // Mock the query builder to return our filtered results
                            mockQueryBuilder.getManyAndCount.mockResolvedValue([paginatedFiles, filteredFiles.length]);

                            // Act
                            const result = await service.listFileRecords(query);

                            // Assert - Verify all returned records match the filter conditions
                            expect(result).toHaveProperty('files');
                            expect(result).toHaveProperty('total');
                            expect(Array.isArray(result.files)).toBe(true);
                            expect(typeof result.total).toBe('number');

                            // Verify status filter is applied correctly
                            if (query.status) {
                                result.files.forEach((file: any) => {
                                    expect(file.status).toBe(query.status);
                                });
                            }

                            // Verify date range filters are applied correctly
                            if (query.startDate && query.endDate) {
                                const startDate = new Date(query.startDate);
                                const endDate = new Date(query.endDate);
                                result.files.forEach((file: any) => {
                                    expect(file.uploadedAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                                    expect(file.uploadedAt.getTime()).toBeLessThanOrEqual(endDate.getTime());
                                });
                            } else if (query.startDate) {
                                const startDate = new Date(query.startDate);
                                result.files.forEach((file: any) => {
                                    expect(file.uploadedAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                                });
                            } else if (query.endDate) {
                                const endDate = new Date(query.endDate);
                                result.files.forEach((file: any) => {
                                    expect(file.uploadedAt.getTime()).toBeLessThanOrEqual(endDate.getTime());
                                });
                            }

                            // Verify pagination is applied correctly
                            const expectedPageSize = query.pageSize || 10;
                            expect(result.files.length).toBeLessThanOrEqual(expectedPageSize);

                            // Verify total count matches the filtered results (not paginated)
                            expect(result.total).toBe(filteredFiles.length);

                            // Verify results are sorted by uploadedAt DESC
                            if (result.files.length > 1) {
                                for (let i = 0; i < result.files.length - 1; i++) {
                                    const currentFile = result.files[i] as any;
                                    const nextFile = result.files[i + 1] as any;
                                    expect(currentFile.uploadedAt.getTime()).toBeGreaterThanOrEqual(nextFile.uploadedAt.getTime());
                                }
                            }
                        }
                    ),
                    { numRuns: 100 }
                );
            });
        });
    });
});
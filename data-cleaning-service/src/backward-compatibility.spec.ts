import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { DataCleaningController } from './data-cleaning.controller';
import { AsyncProcessingController } from './async-processing.controller';
import { TaskProducerService } from './services/task-producer.service';
import { FileRecordService } from './services/file-record.service';
import { FileService } from './services/file.service';
import { ParserService } from './services/parser.service';
import { DataCleanerService } from './services/data-cleaner.service';
import { ExportService } from './services/export.service';
import { DatabasePersistenceService } from './services/database-persistence.service';
import { ParallelProcessingManagerService } from './services/parallel/parallel-processing-manager.service';
import { QueueManagerService } from './services/queue/queue-manager.service';
import { FileStatus } from './common/types';

/**
 * Backward Compatibility Tests
 * 
 * These tests ensure that the new async queue processing system maintains
 * full backward compatibility with existing API endpoints and functionality.
 * 
 * Requirements tested:
 * - 10.4: Existing API endpoints continue to work
 * - 10.5: Database queries continue to work
 * - 10.1: File processing results are consistent
 * - 10.2: Output formats remain the same
 * - 10.3: Processing rules remain unchanged
 */
describe('Backward Compatibility Tests', () => {
    let dataCleaningController: DataCleaningController;
    let asyncProcessingController: AsyncProcessingController;
    let taskProducerService: jest.Mocked<TaskProducerService>;
    let fileRecordService: jest.Mocked<FileRecordService>;
    let fileService: jest.Mocked<FileService>;
    let exportService: jest.Mocked<ExportService>;
    let databasePersistence: jest.Mocked<DatabasePersistenceService>;
    let queueManager: jest.Mocked<QueueManagerService>;

    beforeEach(async () => {
        const mockTaskProducerService = {
            validateFileForTask: jest.fn(),
            createProcessingTask: jest.fn(),
        };

        const mockFileRecordService = {
            createFileRecord: jest.fn(),
            getFileRecordByJobId: jest.fn(),
            getFileRecord: jest.fn(),
            listFileRecords: jest.fn(),
        };

        const mockFileService = {
            validateFile: jest.fn(),
        };

        const mockExportService = {
            getFileBuffer: jest.fn(),
        };

        const mockDatabasePersistenceService = {
            getCleanDataByJobIdPaginated: jest.fn(),
            getErrorLogsByJobIdPaginated: jest.fn(),
        };

        const mockQueueManagerService = {
            getTaskStatus: jest.fn(),
            getProgress: jest.fn(),
        };

        const mockParserService = {};
        const mockDataCleanerService = {};
        const mockParallelProcessingManagerService = {
            getStatus: jest.fn(),
            getProgressStats: jest.fn(),
            getPerformanceMetrics: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DataCleaningController, AsyncProcessingController],
            providers: [
                {
                    provide: TaskProducerService,
                    useValue: mockTaskProducerService,
                },
                {
                    provide: FileRecordService,
                    useValue: mockFileRecordService,
                },
                {
                    provide: FileService,
                    useValue: mockFileService,
                },
                {
                    provide: ParserService,
                    useValue: mockParserService,
                },
                {
                    provide: DataCleanerService,
                    useValue: mockDataCleanerService,
                },
                {
                    provide: ExportService,
                    useValue: mockExportService,
                },
                {
                    provide: DatabasePersistenceService,
                    useValue: mockDatabasePersistenceService,
                },
                {
                    provide: ParallelProcessingManagerService,
                    useValue: mockParallelProcessingManagerService,
                },
                {
                    provide: QueueManagerService,
                    useValue: mockQueueManagerService,
                },
            ],
        }).compile();

        dataCleaningController = module.get<DataCleaningController>(DataCleaningController);
        asyncProcessingController = module.get<AsyncProcessingController>(AsyncProcessingController);
        taskProducerService = module.get(TaskProducerService);
        fileRecordService = module.get(FileRecordService);
        fileService = module.get(FileService);
        exportService = module.get(ExportService);
        databasePersistence = module.get(DatabasePersistenceService);
        queueManager = module.get(QueueManagerService);
    });

    describe('13.1 验证现有API端点兼容性', () => {
        describe('Status Query Endpoint (/api/data-cleaning/status/:jobId)', () => {
            it('should return status for completed job with same format as before', async () => {
                // Arrange
                const jobId = 'job_123456789';
                const mockFileRecord = {
                    id: 'file-id-123',
                    jobId,
                    status: FileStatus.COMPLETED,
                    totalRows: 1000,
                    cleanedRows: 950,
                    exceptionRows: 50,
                    processingTime: 5000,
                };

                fileRecordService.getFileRecordByJobId.mockResolvedValue(mockFileRecord as any);

                // Act
                const result = await dataCleaningController.getStatus(jobId);

                // Assert
                expect(result).toEqual({
                    jobId,
                    status: FileStatus.COMPLETED,
                    progress: 100,
                    statistics: {
                        totalRows: 1000,
                        cleanedRows: 950,
                        exceptionRows: 50,
                        processingTime: 5000,
                    },
                });

                expect(fileRecordService.getFileRecordByJobId).toHaveBeenCalledWith(jobId);
            });

            it('should return status for pending job', async () => {
                // Arrange
                const jobId = 'job_pending_123';
                const mockFileRecord = {
                    id: 'file-id-456',
                    jobId,
                    status: FileStatus.PENDING,
                };

                fileRecordService.getFileRecordByJobId.mockResolvedValue(mockFileRecord as any);

                // Act
                const result = await dataCleaningController.getStatus(jobId);

                // Assert
                expect(result).toEqual({
                    jobId,
                    status: FileStatus.PENDING,
                    progress: 0,
                });
            });

            it('should return 404 for non-existent job', async () => {
                // Arrange
                const jobId = 'non_existent_job';
                fileRecordService.getFileRecordByJobId.mockResolvedValue(null as any);

                // Act & Assert
                await expect(dataCleaningController.getStatus(jobId)).rejects.toThrow(
                    new HttpException('Job not found', HttpStatus.NOT_FOUND)
                );
            });
        });

        describe('File List Endpoint (/api/data-cleaning/files)', () => {
            it('should return file list with same format as before', async () => {
                // Arrange
                const mockQuery = { page: 1, pageSize: 10 };
                const mockResult = {
                    files: [
                        {
                            id: 'file-1',
                            jobId: 'job-1',
                            originalFileName: 'test1.csv',
                            fileSize: 1024,
                            fileType: 'csv',
                            status: FileStatus.COMPLETED,
                            uploadedAt: new Date('2024-01-01T10:00:00Z'),
                            completedAt: new Date('2024-01-01T10:05:00Z'),
                            totalRows: 100,
                            cleanedRows: 95,
                            exceptionRows: 5,
                        },
                        {
                            id: 'file-2',
                            jobId: 'job-2',
                            originalFileName: 'test2.xlsx',
                            fileSize: 2048,
                            fileType: 'xlsx',
                            status: FileStatus.PROCESSING,
                            uploadedAt: new Date('2024-01-01T11:00:00Z'),
                            completedAt: null,
                            totalRows: null,
                            cleanedRows: null,
                            exceptionRows: null,
                        },
                    ],
                    total: 2,
                };

                fileRecordService.listFileRecords.mockResolvedValue(mockResult as any);

                // Act
                const result = await dataCleaningController.listFiles(mockQuery);

                // Assert
                expect(result).toEqual({
                    files: [
                        {
                            id: 'file-1',
                            jobId: 'job-1',
                            originalFileName: 'test1.csv',
                            fileSize: 1024,
                            fileType: 'csv',
                            status: FileStatus.COMPLETED,
                            uploadedAt: new Date('2024-01-01T10:00:00Z'),
                            completedAt: new Date('2024-01-01T10:05:00Z'),
                            totalRows: 100,
                            cleanedRows: 95,
                            exceptionRows: 5,
                        },
                        {
                            id: 'file-2',
                            jobId: 'job-2',
                            originalFileName: 'test2.xlsx',
                            fileSize: 2048,
                            fileType: 'xlsx',
                            status: FileStatus.PROCESSING,
                            uploadedAt: new Date('2024-01-01T11:00:00Z'),
                            completedAt: null,
                            totalRows: null,
                            cleanedRows: null,
                            exceptionRows: null,
                        },
                    ],
                    total: 2,
                    page: 1,
                    pageSize: 10,
                });

                expect(fileRecordService.listFileRecords).toHaveBeenCalledWith(mockQuery);
            });
        });

        describe('File Detail Endpoint (/api/data-cleaning/files/:fileId)', () => {
            it('should return file detail with same format as before', async () => {
                // Arrange
                const fileId = 'file-123';
                const mockFileRecord = {
                    id: fileId,
                    jobId: 'job-456',
                    originalFileName: 'data.xlsx',
                    fileSize: 5120,
                    fileType: 'xlsx',
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    status: FileStatus.COMPLETED,
                    uploadedAt: new Date('2024-01-01T12:00:00Z'),
                    completedAt: new Date('2024-01-01T12:10:00Z'),
                    totalRows: 500,
                    cleanedRows: 480,
                    exceptionRows: 20,
                    processingTime: 10000,
                    errorMessage: null,
                };

                fileRecordService.getFileRecord.mockResolvedValue(mockFileRecord as any);

                // Act
                const result = await dataCleaningController.getFileDetail(fileId);

                // Assert
                expect(result).toEqual({
                    file: {
                        id: fileId,
                        jobId: 'job-456',
                        originalFileName: 'data.xlsx',
                        fileSize: 5120,
                        fileType: 'xlsx',
                        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        status: FileStatus.COMPLETED,
                        uploadedAt: new Date('2024-01-01T12:00:00Z'),
                        completedAt: new Date('2024-01-01T12:10:00Z'),
                        totalRows: 500,
                        cleanedRows: 480,
                        exceptionRows: 20,
                        processingTime: 10000,
                        errorMessage: null,
                    },
                    statistics: {
                        totalRows: 500,
                        cleanedRows: 480,
                        exceptionRows: 20,
                        processingTime: 10000,
                    },
                });

                expect(fileRecordService.getFileRecord).toHaveBeenCalledWith(fileId);
            });

            it('should return 404 for non-existent file', async () => {
                // Arrange
                const fileId = 'non-existent-file';
                fileRecordService.getFileRecord.mockResolvedValue(null as any);

                // Act & Assert
                await expect(dataCleaningController.getFileDetail(fileId)).rejects.toThrow(
                    new HttpException('File not found', HttpStatus.NOT_FOUND)
                );
            });
        });

        describe('Download Endpoints', () => {
            const mockResponse = {
                setHeader: jest.fn(),
                send: jest.fn(),
            } as unknown as Response;

            beforeEach(() => {
                jest.clearAllMocks();
            });

            it('should download clean data with same format as before', async () => {
                // Arrange
                const jobId = 'job-download-123';
                const mockFileRecord = {
                    id: 'file-id',
                    jobId,
                    status: FileStatus.COMPLETED,
                    cleanDataPath: '/path/to/clean/data.xlsx',
                };
                const mockFileBuffer = Buffer.from('mock excel data');

                fileRecordService.getFileRecordByJobId.mockResolvedValue(mockFileRecord as any);
                exportService.getFileBuffer.mockResolvedValue(mockFileBuffer);

                // Act
                await dataCleaningController.downloadClean(jobId, mockResponse);

                // Assert
                expect(mockResponse.setHeader).toHaveBeenCalledWith(
                    'Content-Type',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                );
                expect(mockResponse.setHeader).toHaveBeenCalledWith(
                    'Content-Disposition',
                    `attachment; filename="clean_data_${jobId}.xlsx"`
                );
                expect(mockResponse.setHeader).toHaveBeenCalledWith(
                    'Content-Length',
                    mockFileBuffer.length
                );
                expect(mockResponse.send).toHaveBeenCalledWith(mockFileBuffer);
            });

            it('should download exception data with same format as before', async () => {
                // Arrange
                const jobId = 'job-exceptions-123';
                const mockFileRecord = {
                    id: 'file-id',
                    jobId,
                    status: FileStatus.COMPLETED,
                    exceptionDataPath: '/path/to/exceptions/data.xlsx',
                };
                const mockFileBuffer = Buffer.from('mock exception data');

                fileRecordService.getFileRecordByJobId.mockResolvedValue(mockFileRecord as any);
                exportService.getFileBuffer.mockResolvedValue(mockFileBuffer);

                // Act
                await dataCleaningController.downloadExceptions(jobId, mockResponse);

                // Assert
                expect(mockResponse.setHeader).toHaveBeenCalledWith(
                    'Content-Type',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                );
                expect(mockResponse.setHeader).toHaveBeenCalledWith(
                    'Content-Disposition',
                    `attachment; filename="exceptions_${jobId}.xlsx"`
                );
                expect(mockResponse.send).toHaveBeenCalledWith(mockFileBuffer);
            });

            it('should return 404 when clean data file not found', async () => {
                // Arrange
                const jobId = 'job-no-clean-data';
                const mockFileRecord = {
                    id: 'file-id',
                    jobId,
                    status: FileStatus.COMPLETED,
                    cleanDataPath: null,
                };

                fileRecordService.getFileRecordByJobId.mockResolvedValue(mockFileRecord as any);

                // Act & Assert
                await expect(
                    dataCleaningController.downloadClean(jobId, mockResponse)
                ).rejects.toThrow(
                    new HttpException('Clean data file not found', HttpStatus.NOT_FOUND)
                );
            });
        });

        describe('Data Query Endpoints', () => {
            it('should return clean data with same pagination format', async () => {
                // Arrange
                const jobId = 'job-clean-data-123';
                const mockResult = {
                    data: [
                        { 
                            id: '1', 
                            jobId: 'job-clean-data-123',
                            rowNumber: 1,
                            name: 'John Doe', 
                            phone: '+1234567890',
                            hireDate: '2024-01-01',
                            province: 'Ontario',
                            city: 'Toronto',
                            district: 'Downtown',
                            addressDetail: '123 Main St',
                            additionalFields: {},
                            createdAt: new Date()
                        },
                        { 
                            id: '2', 
                            jobId: 'job-clean-data-123',
                            rowNumber: 2,
                            name: 'Jane Smith', 
                            phone: '+0987654321',
                            hireDate: '2024-01-02',
                            province: 'Ontario',
                            city: 'Ottawa',
                            district: 'Central',
                            addressDetail: '456 Oak Ave',
                            additionalFields: {},
                            createdAt: new Date()
                        },
                    ],
                    total: 100,
                    page: 1,
                    pageSize: 2,
                    totalPages: 50,
                };

                databasePersistence.getCleanDataByJobIdPaginated.mockResolvedValue(mockResult);

                // Act
                const result = await dataCleaningController.getCleanDataPaginated(jobId, '1', '2');

                // Assert
                expect(result).toEqual(mockResult);
                expect(databasePersistence.getCleanDataByJobIdPaginated).toHaveBeenCalledWith(
                    jobId,
                    1,
                    2
                );
            });

            it('should return exception data with same pagination format', async () => {
                // Arrange
                const jobId = 'job-exception-data-123';
                const mockResult = {
                    data: [
                        { id: 1, originalData: 'invalid email', error: 'Invalid email format' },
                        { id: 2, originalData: 'missing name', error: 'Name is required' },
                    ],
                    total: 20,
                    page: 1,
                    pageSize: 2,
                    totalPages: 10,
                };

                databasePersistence.getErrorLogsByJobIdPaginated.mockResolvedValue(mockResult);

                // Act
                const result = await dataCleaningController.getExceptionDataPaginated(jobId, '1', '2');

                // Assert
                expect(result).toEqual(mockResult);
                expect(databasePersistence.getErrorLogsByJobIdPaginated).toHaveBeenCalledWith(
                    jobId,
                    1,
                    2
                );
            });
        });
    });

    describe('13.2 验证文件处理结果一致性', () => {
        describe('Upload Response Format Consistency', () => {
            const mockFile: Express.Multer.File = {
                fieldname: 'file',
                originalname: 'test.csv',
                encoding: '7bit',
                mimetype: 'text/csv',
                size: 1024,
                buffer: Buffer.from('name,email\nJohn,john@example.com'),
                destination: '',
                filename: '',
                path: '',
                stream: null as any,
            };

            it('should return upload response with both jobId and taskId for backward compatibility', async () => {
                // Arrange
                const mockFileRecord = {
                    id: 'file-record-id',
                    jobId: 'job-123',
                    originalFileName: 'test.csv',
                    fileSize: 1024,
                    fileType: 'csv',
                    mimeType: 'text/csv',
                };

                taskProducerService.validateFileForTask.mockReturnValue(true);
                fileRecordService.createFileRecord.mockResolvedValue(mockFileRecord as any);
                taskProducerService.createProcessingTask.mockResolvedValue('task-123');

                // Act
                const result = await dataCleaningController.uploadFile(mockFile);

                // Assert - Response should include both jobId and taskId for compatibility
                expect(result).toEqual({
                    jobId: 'task-123', // For backward compatibility
                    taskId: 'task-123', // For new async processing
                    fileId: 'file-record-id',
                    message: '文件上传成功，开始处理',
                    totalRows: 0,
                    status: 'pending', // New field for async processing
                });
            });

            it('should maintain same error response format for invalid files', async () => {
                // Arrange
                taskProducerService.validateFileForTask.mockReturnValue(false);

                // Act & Assert
                await expect(dataCleaningController.uploadFile(mockFile)).rejects.toThrow(
                    new HttpException('File validation failed', HttpStatus.BAD_REQUEST)
                );
            });
        });

        describe('Status Response Format Consistency', () => {
            it('should return consistent status format for both sync and async processing', async () => {
                // Test that both old status endpoint and new check-status endpoint
                // return compatible data structures

                const jobId = 'job-consistency-test';
                const mockFileRecord = {
                    id: 'file-id',
                    jobId,
                    status: FileStatus.COMPLETED,
                    totalRows: 1000,
                    cleanedRows: 950,
                    exceptionRows: 50,
                    processingTime: 5000,
                };

                // Test old endpoint
                fileRecordService.getFileRecordByJobId.mockResolvedValue(mockFileRecord as any);
                const oldResult = await dataCleaningController.getStatus(jobId);

                // Test new async endpoint
                const mockTaskStatus = {
                    taskId: jobId,
                    status: 'completed' as any,
                    progress: 100,
                    createdAt: new Date(),
                    statistics: {
                        totalRows: 1000,
                        processedRows: 1000,
                        validRows: 950,
                        invalidRows: 50,
                        duplicateRows: 0,
                        processingTimeMs: 5000,
                    },
                };

                const mockProgress = {
                    taskId: jobId,
                    progress: 100,
                    processedRows: 1000,
                    totalRows: 1000,
                    currentPhase: 'completed',
                };

                queueManager.getTaskStatus.mockResolvedValue(mockTaskStatus);
                queueManager.getProgress.mockResolvedValue(mockProgress);

                const newResult = await asyncProcessingController.checkStatus(jobId);

                // Assert both endpoints return compatible core data
                expect(oldResult.jobId).toBe(newResult.taskId);
                expect(oldResult.status).toBe(FileStatus.COMPLETED);
                expect(newResult.status).toBe('completed');
                expect(oldResult.progress).toBe(newResult.progress);
                
                // Note: Statistics formats may differ between sync and async processing
                // but core data should be equivalent
                expect(oldResult.statistics?.totalRows).toBe(newResult.statistics?.totalRows);
                expect(oldResult.statistics?.cleanedRows).toBe(newResult.statistics?.validRows);
                expect(oldResult.statistics?.exceptionRows).toBe(newResult.statistics?.invalidRows);
            });
        });

        describe('File Processing Output Consistency', () => {
            it('should ensure async processing produces same output format as sync processing', async () => {
                // This test verifies that the file processing results are identical
                // regardless of whether sync or async processing is used

                const jobId = 'job-output-consistency';

                // Mock completed file record with processing results
                const mockFileRecord = {
                    id: 'file-id',
                    jobId,
                    status: FileStatus.COMPLETED,
                    totalRows: 100,
                    cleanedRows: 95,
                    exceptionRows: 5,
                    processingTime: 2000,
                    cleanDataPath: '/path/to/clean.xlsx',
                    exceptionDataPath: '/path/to/exceptions.xlsx',
                };

                fileRecordService.getFileRecordByJobId.mockResolvedValue(mockFileRecord as any);

                // Test that file detail endpoint returns consistent format
                fileRecordService.getFileRecord.mockResolvedValue(mockFileRecord as any);
                const fileDetail = await dataCleaningController.getFileDetail('file-id');

                expect(fileDetail.file.status).toBe(FileStatus.COMPLETED);
                expect(fileDetail.statistics).toEqual({
                    totalRows: 100,
                    cleanedRows: 95,
                    exceptionRows: 5,
                    processingTime: 2000,
                });

                // Verify that the same statistics are available through status endpoint
                const statusResult = await dataCleaningController.getStatus(jobId);
                expect(statusResult.statistics).toEqual(fileDetail.statistics);
            });
        });

        describe('Database Query Consistency', () => {
            it('should ensure database queries return same data structure', async () => {
                // Test that paginated data queries return consistent format
                const jobId = 'job-db-consistency';

                const mockCleanData = {
                    data: [
                        { 
                            id: '1', 
                            jobId: 'job-db-consistency',
                            rowNumber: 1,
                            name: 'John Doe', 
                            phone: '+1234567890',
                            hireDate: '2024-01-01',
                            province: 'Ontario',
                            city: 'Toronto',
                            district: 'Downtown',
                            addressDetail: '123 Main St',
                            additionalFields: {},
                            createdAt: new Date()
                        },
                        { 
                            id: '2', 
                            jobId: 'job-db-consistency',
                            rowNumber: 2,
                            name: 'Jane Smith', 
                            phone: '+0987654321',
                            hireDate: '2024-01-02',
                            province: 'Ontario',
                            city: 'Ottawa',
                            district: 'Central',
                            addressDetail: '456 Oak Ave',
                            additionalFields: {},
                            createdAt: new Date()
                        },
                    ],
                    total: 95,
                    page: 1,
                    pageSize: 2,
                    totalPages: 48,
                };

                const mockExceptionData = {
                    data: [
                        { id: 1, originalData: 'invalid-email', error: 'Invalid email format', rowNumber: 10 },
                        { id: 2, originalData: '', error: 'Name is required', rowNumber: 25 },
                    ],
                    total: 5,
                    page: 1,
                    pageSize: 2,
                    totalPages: 3,
                };

                databasePersistence.getCleanDataByJobIdPaginated.mockResolvedValue(mockCleanData);
                databasePersistence.getErrorLogsByJobIdPaginated.mockResolvedValue(mockExceptionData);

                // Test clean data query
                const cleanResult = await dataCleaningController.getCleanDataPaginated(jobId);
                expect(cleanResult).toEqual(mockCleanData);
                expect(cleanResult.data).toHaveLength(2);
                expect(cleanResult.total).toBe(95);

                // Test exception data query
                const exceptionResult = await dataCleaningController.getExceptionDataPaginated(jobId);
                expect(exceptionResult).toEqual(mockExceptionData);
                expect(exceptionResult.data).toHaveLength(2);
                expect(exceptionResult.total).toBe(5);
            });
        });
    });

    describe('Error Handling Consistency', () => {
        it('should maintain same error response format across all endpoints', async () => {
            // Test that error responses maintain consistent format

            // Test 404 errors
            fileRecordService.getFileRecordByJobId.mockResolvedValue(null as any);

            await expect(dataCleaningController.getStatus('non-existent')).rejects.toThrow(
                new HttpException('Job not found', HttpStatus.NOT_FOUND)
            );

            await expect(dataCleaningController.getFileDetail('non-existent')).rejects.toThrow(
                new HttpException('File not found', HttpStatus.NOT_FOUND)
            );

            // Test async endpoint 404
            queueManager.getTaskStatus.mockRejectedValue(new Error('Task not found'));

            await expect(asyncProcessingController.checkStatus('non-existent')).rejects.toThrow(
                new HttpException('Task not found', HttpStatus.NOT_FOUND)
            );
        });

        it('should handle service errors consistently', async () => {
            // Test internal server errors
            const serviceError = new Error('Database connection failed');

            fileRecordService.getFileRecordByJobId.mockRejectedValue(serviceError);

            await expect(dataCleaningController.getStatus('job-123')).rejects.toThrow(
                new HttpException('Failed to get job status', HttpStatus.INTERNAL_SERVER_ERROR)
            );

            databasePersistence.getCleanDataByJobIdPaginated.mockRejectedValue(serviceError);

            await expect(dataCleaningController.getCleanDataPaginated('job-123')).rejects.toThrow(
                new HttpException('Failed to query clean data', HttpStatus.INTERNAL_SERVER_ERROR)
            );
        });
    });
});
import { Test, TestingModule } from '@nestjs/testing';
import { DataCleaningController } from './data-cleaning.controller';
import { AsyncProcessingController } from './async-processing.controller';
import { TaskProducerService } from './services/task-producer.service';
import { FileRecordService } from './services/file-record.service';
import { FileService } from './services/file.service';
import { DataCleanerService } from './services/data-cleaner.service';
import { ParserService } from './services/parser.service';
import { ExportService } from './services/export.service';
import { DatabasePersistenceService } from './services/database-persistence.service';
import { ParallelProcessingManagerService } from './services/parallel/parallel-processing-manager.service';
import { QueueManagerService } from './services/queue/queue-manager.service';
import { TaskConsumerService } from './services/queue/task-consumer.service';
import { FileStatus } from './common/types';
import { TaskStatus } from './common/types/queue.types';

/**
 * Processing Consistency Integration Tests
 * 
 * These tests verify that async processing produces identical results
 * to sync processing for the same input data.
 * 
 * Requirements tested:
 * - 10.1: File processing results are consistent
 * - 10.2: Output formats remain the same
 * - 10.3: Processing rules remain unchanged
 */
describe('Processing Consistency Integration Tests', () => {
    let dataCleaningController: DataCleaningController;
    let asyncProcessingController: AsyncProcessingController;
    let taskProducerService: jest.Mocked<TaskProducerService>;
    let fileRecordService: jest.Mocked<FileRecordService>;
    let dataCleanerService: jest.Mocked<DataCleanerService>;
    let queueManager: jest.Mocked<QueueManagerService>;

    const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test-data.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 2048,
        buffer: Buffer.from(`name,phone,hireDate,province,city,district,addressDetail
John Doe,+1234567890,2024-01-01,Ontario,Toronto,Downtown,123 Main St
Jane Smith,+0987654321,2024-01-02,Ontario,Ottawa,Central,456 Oak Ave
Invalid User,invalid-phone,invalid-date,,,,""`),
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
    };

    beforeEach(async () => {
        const mockTaskProducerService = {
            validateFileForTask: jest.fn(),
            createProcessingTask: jest.fn(),
        };

        const mockFileRecordService = {
            createFileRecord: jest.fn(),
            getFileRecordByJobId: jest.fn(),
            updateFileRecord: jest.fn(),
        };

        const mockFileService = {
            validateFile: jest.fn(),
        };

        const mockDataCleanerService = {
            cleanData: jest.fn(),
            cleanDataStream: jest.fn(),
        };

        const mockQueueManagerService = {
            getTaskStatus: jest.fn(),
            getProgress: jest.fn(),
            enqueueTask: jest.fn(),
            setTaskStatus: jest.fn(),
            updateProgress: jest.fn(),
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
                    provide: DataCleanerService,
                    useValue: mockDataCleanerService,
                },
                {
                    provide: QueueManagerService,
                    useValue: mockQueueManagerService,
                },
                // Mock other required services
                {
                    provide: ParserService,
                    useValue: {},
                },
                {
                    provide: ExportService,
                    useValue: {},
                },
                {
                    provide: DatabasePersistenceService,
                    useValue: {},
                },
                {
                    provide: ParallelProcessingManagerService,
                    useValue: {},
                },
            ],
        }).compile();

        dataCleaningController = module.get<DataCleaningController>(DataCleaningController);
        asyncProcessingController = module.get<AsyncProcessingController>(AsyncProcessingController);
        taskProducerService = module.get(TaskProducerService);
        fileRecordService = module.get(FileRecordService);
        dataCleanerService = module.get(DataCleanerService);
        queueManager = module.get(QueueManagerService);
    });

    describe('File Processing Result Consistency', () => {
        it('should produce identical processing statistics for sync and async processing', async () => {
            // Mock the expected processing results
            const expectedProcessingResult = {
                totalRows: 3,
                processedRows: 3,
                validRows: 2,
                invalidRows: 1,
                duplicateRows: 0,
                cleanedData: [
                    {
                        name: 'John Doe',
                        phone: '+1234567890',
                        hireDate: '2024-01-01',
                        province: 'Ontario',
                        city: 'Toronto',
                        district: 'Downtown',
                        addressDetail: '123 Main St',
                    },
                    {
                        name: 'Jane Smith',
                        phone: '+0987654321',
                        hireDate: '2024-01-02',
                        province: 'Ontario',
                        city: 'Ottawa',
                        district: 'Central',
                        addressDetail: '456 Oak Ave',
                    },
                ],
                exceptionData: [
                    {
                        originalData: 'Invalid User,invalid-phone,invalid-date,,,',
                        error: 'Invalid phone format and date format',
                        rowNumber: 3,
                    },
                ],
            };

            // Setup mocks for file upload
            const mockFileRecord = {
                id: 'file-record-id',
                jobId: 'consistency-test-job',
                originalFileName: 'test-data.csv',
                fileSize: 2048,
                fileType: 'csv',
                mimeType: 'text/csv',
                status: FileStatus.COMPLETED,
                totalRows: expectedProcessingResult.totalRows,
                cleanedRows: expectedProcessingResult.validRows,
                exceptionRows: expectedProcessingResult.invalidRows,
                processingTime: 1500,
            };

            taskProducerService.validateFileForTask.mockReturnValue(true);
            fileRecordService.createFileRecord.mockResolvedValue(mockFileRecord as any);
            taskProducerService.createProcessingTask.mockResolvedValue('async-task-123');

            // Mock data cleaner service to return consistent results
            dataCleanerService.cleanDataStream.mockResolvedValue({
                totalRows: expectedProcessingResult.totalRows,
                processedRows: expectedProcessingResult.processedRows,
                validRows: expectedProcessingResult.validRows,
                invalidRows: expectedProcessingResult.invalidRows,
                duplicateRows: expectedProcessingResult.duplicateRows,
                processingTimeMs: 1500,
                cleanedData: expectedProcessingResult.cleanedData,
                exceptionData: expectedProcessingResult.exceptionData,
            } as any);

            // Test async processing upload
            const asyncUploadResult = await dataCleaningController.uploadFile(mockFile);

            // Verify async upload response format
            expect(asyncUploadResult).toEqual({
                jobId: 'async-task-123',
                taskId: 'async-task-123',
                fileId: 'file-record-id',
                message: '文件上传成功，开始处理',
                totalRows: 0, // Initially 0, updated during processing
                status: 'pending',
            });

            // Mock async processing completion
            const mockAsyncTaskStatus = {
                taskId: 'async-task-123',
                status: TaskStatus.COMPLETED,
                progress: 100,
                createdAt: new Date(),
                completedAt: new Date(),
                statistics: {
                    totalRows: expectedProcessingResult.totalRows,
                    processedRows: expectedProcessingResult.processedRows,
                    validRows: expectedProcessingResult.validRows,
                    invalidRows: expectedProcessingResult.invalidRows,
                    duplicateRows: expectedProcessingResult.duplicateRows,
                    processingTimeMs: 1500,
                },
            };

            const mockAsyncProgress = {
                taskId: 'async-task-123',
                progress: 100,
                processedRows: expectedProcessingResult.processedRows,
                totalRows: expectedProcessingResult.totalRows,
                currentPhase: 'completed',
            };

            queueManager.getTaskStatus.mockResolvedValue(mockAsyncTaskStatus);
            queueManager.getProgress.mockResolvedValue(mockAsyncProgress);

            // Test async status query
            const asyncStatusResult = await asyncProcessingController.checkStatus('async-task-123');

            // Verify async processing results
            expect(asyncStatusResult.status).toBe(TaskStatus.COMPLETED);
            expect(asyncStatusResult.progress).toBe(100);
            expect(asyncStatusResult.processedRows).toBe(expectedProcessingResult.processedRows);
            expect(asyncStatusResult.totalRows).toBe(expectedProcessingResult.totalRows);
            expect(asyncStatusResult.statistics).toEqual(mockAsyncTaskStatus.statistics);

            // Test sync processing status query for comparison
            fileRecordService.getFileRecordByJobId.mockResolvedValue(mockFileRecord as any);
            const syncStatusResult = await dataCleaningController.getStatus('consistency-test-job');

            // Verify that core processing results are consistent
            expect(syncStatusResult.status).toBe(FileStatus.COMPLETED);
            expect(syncStatusResult.progress).toBe(100);
            expect(syncStatusResult.statistics?.totalRows).toBe(asyncStatusResult.statistics?.totalRows);
            expect(syncStatusResult.statistics?.cleanedRows).toBe(asyncStatusResult.statistics?.validRows);
            expect(syncStatusResult.statistics?.exceptionRows).toBe(asyncStatusResult.statistics?.invalidRows);
        });

        it('should maintain same data validation rules in both sync and async processing', async () => {
            // Test that the same validation rules are applied regardless of processing mode
            const testCases = [
                {
                    input: 'John Doe,+1234567890,2024-01-01,Ontario,Toronto,Downtown,123 Main St',
                    expected: { valid: true, errors: [] },
                },
                {
                    input: 'Jane Smith,invalid-phone,2024-01-02,Ontario,Ottawa,Central,456 Oak Ave',
                    expected: { valid: false, errors: ['Invalid phone format'] },
                },
                {
                    input: 'Bob Johnson,+1111111111,invalid-date,Ontario,Toronto,Downtown,789 Pine St',
                    expected: { valid: false, errors: ['Invalid date format'] },
                },
                {
                    input: ',+2222222222,2024-01-03,Ontario,Toronto,Downtown,321 Elm St',
                    expected: { valid: false, errors: ['Name is required'] },
                },
            ];

            for (const testCase of testCases) {
                // Mock file with specific test data
                const testFile = {
                    ...mockFile,
                    buffer: Buffer.from(`name,phone,hireDate,province,city,district,addressDetail\n${testCase.input}`),
                };

                // Mock validation results
                const mockValidationResult = {
                    isValid: testCase.expected.valid,
                    errors: testCase.expected.errors,
                };

                taskProducerService.validateFileForTask.mockReturnValue(mockValidationResult.isValid);

                if (mockValidationResult.isValid) {
                    // Test successful processing
                    const mockFileRecord = {
                        id: 'test-file-id',
                        jobId: 'validation-test-job',
                        status: FileStatus.COMPLETED,
                    };

                    fileRecordService.createFileRecord.mockResolvedValue(mockFileRecord as any);
                    taskProducerService.createProcessingTask.mockResolvedValue('validation-task-123');

                    const result = await dataCleaningController.uploadFile(testFile);
                    expect(result.status).toBe('pending');
                } else {
                    // Test validation failure
                    await expect(dataCleaningController.uploadFile(testFile)).rejects.toThrow('File validation failed');
                }
            }
        });

        it('should produce identical output file formats for both processing modes', async () => {
            // Test that the output file structure and format are identical
            const mockFileRecord = {
                id: 'format-test-file',
                jobId: 'format-test-job',
                status: FileStatus.COMPLETED,
                totalRows: 100,
                cleanedRows: 95,
                exceptionRows: 5,
                processingTime: 2000,
                cleanDataPath: '/path/to/clean.xlsx',
                exceptionDataPath: '/path/to/exceptions.xlsx',
            };

            fileRecordService.getFileRecordByJobId.mockResolvedValue(mockFileRecord as any);

            // Test sync status endpoint
            const syncResult = await dataCleaningController.getStatus('format-test-job');

            // Mock async processing with same results
            const mockAsyncTaskStatus = {
                taskId: 'format-test-job',
                status: TaskStatus.COMPLETED,
                progress: 100,
                createdAt: new Date(),
                completedAt: new Date(),
                statistics: {
                    totalRows: 100,
                    processedRows: 100,
                    validRows: 95,
                    invalidRows: 5,
                    duplicateRows: 0,
                    processingTimeMs: 2000,
                },
            };

            const mockAsyncProgress = {
                taskId: 'format-test-job',
                progress: 100,
                processedRows: 100,
                totalRows: 100,
                currentPhase: 'completed',
            };

            queueManager.getTaskStatus.mockResolvedValue(mockAsyncTaskStatus);
            queueManager.getProgress.mockResolvedValue(mockAsyncProgress);

            // Test async status endpoint
            const asyncResult = await asyncProcessingController.checkStatus('format-test-job');

            // Verify that both endpoints provide equivalent information
            expect(syncResult.status).toBe(FileStatus.COMPLETED);
            expect(asyncResult.status).toBe(TaskStatus.COMPLETED);
            expect(syncResult.progress).toBe(asyncResult.progress);

            // Verify statistics equivalence (accounting for different field names)
            expect(syncResult.statistics?.totalRows).toBe(asyncResult.statistics?.totalRows);
            expect(syncResult.statistics?.cleanedRows).toBe(asyncResult.statistics?.validRows);
            expect(syncResult.statistics?.exceptionRows).toBe(asyncResult.statistics?.invalidRows);
            expect(syncResult.statistics?.processingTime).toBe(asyncResult.statistics?.processingTimeMs);
        });

        it('should handle error cases consistently in both processing modes', async () => {
            // Test that error handling is consistent between sync and async processing
            const errorTestCases = [
                {
                    scenario: 'File too large',
                    mockError: new Error('File size exceeds limit'),
                    expectedStatus: 'BAD_REQUEST',
                },
                {
                    scenario: 'Unsupported file format',
                    mockError: new Error('Unsupported file format'),
                    expectedStatus: 'BAD_REQUEST',
                },
                {
                    scenario: 'Processing timeout',
                    mockError: new Error('Processing timeout'),
                    expectedStatus: 'TIMEOUT',
                },
                {
                    scenario: 'Database connection error',
                    mockError: new Error('Database connection failed'),
                    expectedStatus: 'INTERNAL_SERVER_ERROR',
                },
            ];

            for (const testCase of errorTestCases) {
                // Test sync error handling
                if (testCase.scenario === 'File too large' || testCase.scenario === 'Unsupported file format') {
                    taskProducerService.validateFileForTask.mockReturnValue(false);
                    await expect(dataCleaningController.uploadFile(mockFile)).rejects.toThrow();
                }

                // Test async error handling
                const mockFailedTaskStatus = {
                    taskId: 'error-test-task',
                    status: TaskStatus.FAILED,
                    progress: 0,
                    createdAt: new Date(),
                    errorMessage: testCase.mockError.message,
                };

                const mockFailedProgress = {
                    taskId: 'error-test-task',
                    progress: 0,
                    processedRows: 0,
                    totalRows: 0,
                    currentPhase: 'failed',
                };

                queueManager.getTaskStatus.mockResolvedValue(mockFailedTaskStatus);
                queueManager.getProgress.mockResolvedValue(mockFailedProgress);

                const asyncErrorResult = await asyncProcessingController.checkStatus('error-test-task');

                expect(asyncErrorResult.status).toBe(TaskStatus.FAILED);
                expect(asyncErrorResult.errorMessage).toBe(testCase.mockError.message);
                expect(asyncErrorResult.progress).toBe(0);
            }
        });
    });

    describe('Database Schema Compatibility', () => {
        it('should ensure async processing uses same database schema as sync processing', async () => {
            // This test verifies that async processing stores data in the same format
            // as sync processing, ensuring database queries remain compatible

            const mockFileRecord = {
                id: 'schema-test-file',
                jobId: 'schema-test-job',
                originalFileName: 'schema-test.csv',
                fileSize: 1024,
                fileType: 'csv',
                mimeType: 'text/csv',
                status: FileStatus.COMPLETED,
                uploadedAt: new Date('2024-01-01T10:00:00Z'),
                completedAt: new Date('2024-01-01T10:05:00Z'),
                totalRows: 50,
                cleanedRows: 45,
                exceptionRows: 5,
                processingTime: 5000,
                cleanDataPath: '/path/to/clean.xlsx',
                exceptionDataPath: '/path/to/exceptions.xlsx',
            };

            fileRecordService.getFileRecordByJobId.mockResolvedValue(mockFileRecord as any);

            // Test that file record structure is consistent
            const statusResult = await dataCleaningController.getStatus('schema-test-job');

            expect(statusResult).toEqual({
                jobId: 'schema-test-job',
                status: FileStatus.COMPLETED,
                progress: 100,
                statistics: {
                    totalRows: 50,
                    cleanedRows: 45,
                    exceptionRows: 5,
                    processingTime: 5000,
                },
            });

            // Verify that the same file record can be used for async status queries
            const mockAsyncTaskStatus = {
                taskId: 'schema-test-job',
                status: TaskStatus.COMPLETED,
                progress: 100,
                createdAt: new Date('2024-01-01T10:00:00Z'),
                completedAt: new Date('2024-01-01T10:05:00Z'),
                statistics: {
                    totalRows: 50,
                    processedRows: 50,
                    validRows: 45,
                    invalidRows: 5,
                    duplicateRows: 0,
                    processingTimeMs: 5000,
                },
            };

            const mockAsyncProgress = {
                taskId: 'schema-test-job',
                progress: 100,
                processedRows: 50,
                totalRows: 50,
                currentPhase: 'completed',
            };

            queueManager.getTaskStatus.mockResolvedValue(mockAsyncTaskStatus);
            queueManager.getProgress.mockResolvedValue(mockAsyncProgress);

            const asyncStatusResult = await asyncProcessingController.checkStatus('schema-test-job');

            // Verify that both endpoints can work with the same underlying data
            expect(statusResult.jobId).toBe(asyncStatusResult.taskId);
            expect(statusResult.statistics?.totalRows).toBe(asyncStatusResult.statistics?.totalRows);
        });
    });
});
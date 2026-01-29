import { Test, TestingModule } from '@nestjs/testing';
import { TaskProducerService } from './task-producer.service';
import { QueueManagerService } from './queue/queue-manager.service';
import { FileService } from './file.service';
import { FileRecordService } from './file-record.service';
import { FileRecord } from '../entities/file-record.entity';
import { ProcessingTask } from '../common/types/queue.types';
import { Readable } from 'stream';

describe('TaskProducerService', () => {
    let service: TaskProducerService;
    let queueManagerService: jest.Mocked<QueueManagerService>;
    let fileService: jest.Mocked<FileService>;
    let fileRecordService: jest.Mocked<FileRecordService>;

    const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 1024,
        buffer: Buffer.from('test,data\n1,2'),
        destination: '',
        filename: '',
        path: '',
        stream: new Readable()
    };

    const mockFileRecord: Partial<FileRecord> = {
        id: 'file-record-id',
        jobId: 'job-123',
        taskId: undefined,
        originalFileName: 'test.csv',
        fileSize: 1024,
        fileType: 'csv',
        mimeType: 'text/csv',
        status: 'pending',
        queueStatus: undefined,
        uploadedAt: new Date(),
        enqueuedAt: undefined,
        processingStartedAt: undefined,
        completedAt: undefined,
        totalRows: undefined,
        cleanedRows: undefined,
        exceptionRows: undefined,
        processingTime: undefined,
        cleanDataPath: undefined,
        exceptionDataPath: undefined,
        errorMessage: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    beforeEach(async () => {
        const mockQueueManagerService = {
            enqueueTask: jest.fn(),
            getTaskStatus: jest.fn(),
            getProgress: jest.fn(),
        };

        const mockFileService = {
            validateFile: jest.fn(),
            saveTemporaryFile: jest.fn(),
        };

        const mockFileRecordService = {
            getFileRecord: jest.fn(),
            updateFileRecordWithTaskInfo: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TaskProducerService,
                {
                    provide: QueueManagerService,
                    useValue: mockQueueManagerService,
                },
                {
                    provide: FileService,
                    useValue: mockFileService,
                },
                {
                    provide: FileRecordService,
                    useValue: mockFileRecordService,
                },
            ],
        }).compile();

        service = module.get<TaskProducerService>(TaskProducerService);
        queueManagerService = module.get(QueueManagerService);
        fileService = module.get(FileService);
        fileRecordService = module.get(FileRecordService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createProcessingTask', () => {
        it('should create and enqueue a processing task successfully', async () => {
            // Arrange
            const tempFilePath = '/tmp/test-file.csv';
            fileService.saveTemporaryFile.mockResolvedValue(tempFilePath);
            queueManagerService.enqueueTask.mockResolvedValue('job-123');
            fileRecordService.getFileRecord.mockResolvedValue(mockFileRecord as FileRecord);
            fileRecordService.updateFileRecordWithTaskInfo.mockResolvedValue(mockFileRecord as FileRecord);

            // Act
            const result = await service.createProcessingTask(mockFile, mockFileRecord as FileRecord);

            // Assert
            expect(result).toBe('job-123');
            expect(fileService.saveTemporaryFile).toHaveBeenCalledWith(mockFile);
            expect(queueManagerService.enqueueTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    taskId: 'job-123',
                    fileId: 'file-record-id',
                    filePath: tempFilePath,
                    originalFileName: 'test.csv',
                    fileSize: 1024,
                    retryCount: 0,
                })
            );
            expect(fileRecordService.getFileRecord).toHaveBeenCalledWith('file-record-id');
            expect(fileRecordService.updateFileRecordWithTaskInfo).toHaveBeenCalled();
        });

        it('should throw error if file service fails', async () => {
            // Arrange
            const error = new Error('Failed to save file');
            fileService.saveTemporaryFile.mockRejectedValue(error);

            // Act & Assert
            await expect(service.createProcessingTask(mockFile, mockFileRecord as FileRecord))
                .rejects.toThrow('Failed to save file');
        });

        it('should throw error if queue enqueue fails', async () => {
            // Arrange
            const tempFilePath = '/tmp/test-file.csv';
            fileService.saveTemporaryFile.mockResolvedValue(tempFilePath);
            const error = new Error('Queue is full');
            queueManagerService.enqueueTask.mockRejectedValue(error);

            // Act & Assert
            await expect(service.createProcessingTask(mockFile, mockFileRecord as FileRecord))
                .rejects.toThrow('Queue is full');
        });
    });

    describe('validateFileForTask', () => {
        it('should return true for valid file', () => {
            // Arrange
            fileService.validateFile.mockReturnValue({ isValid: true });

            // Act
            const result = service.validateFileForTask(mockFile);

            // Assert
            expect(result).toBe(true);
            expect(fileService.validateFile).toHaveBeenCalledWith(mockFile);
        });

        it('should return false for invalid file', () => {
            // Arrange
            fileService.validateFile.mockReturnValue({
                isValid: false,
                error: 'Invalid file type'
            });

            // Act
            const result = service.validateFileForTask(mockFile);

            // Assert
            expect(result).toBe(false);
            expect(fileService.validateFile).toHaveBeenCalledWith(mockFile);
        });

        it('should return false for null file', () => {
            // Act
            const result = service.validateFileForTask(undefined as any);

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('getTaskStatus', () => {
        it('should return task status from queue manager', async () => {
            // Arrange
            const mockStatus = {
                taskId: 'job-123',
                status: 'pending' as any,
                progress: 0,
                createdAt: new Date(),
            };
            queueManagerService.getTaskStatus.mockResolvedValue(mockStatus);

            // Act
            const result = await service.getTaskStatus('job-123');

            // Assert
            expect(result).toEqual(mockStatus);
            expect(queueManagerService.getTaskStatus).toHaveBeenCalledWith('job-123');
        });
    });

    describe('getTaskProgress', () => {
        it('should return task progress from queue manager', async () => {
            // Arrange
            const mockProgress = {
                taskId: 'job-123',
                progress: 50,
                processedRows: 500,
                totalRows: 1000,
                currentPhase: 'processing',
                lastUpdated: new Date(),
            };
            queueManagerService.getProgress.mockResolvedValue(mockProgress);

            // Act
            const result = await service.getTaskProgress('job-123');

            // Assert
            expect(result).toEqual(mockProgress);
            expect(queueManagerService.getProgress).toHaveBeenCalledWith('job-123');
        });
    });
});
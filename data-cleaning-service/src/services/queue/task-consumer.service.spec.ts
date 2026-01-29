import { Test, TestingModule } from '@nestjs/testing';
import { TaskConsumerService } from './task-consumer.service';
import { QueueManagerService } from './queue-manager.service';
import { DataCleanerService } from '../data-cleaner.service';
import { FileService } from '../file.service';
import { ProcessingTask, TaskStatus } from '../../common/types/queue.types';

describe('TaskConsumerService', () => {
    let service: TaskConsumerService;
    let queueManagerService: jest.Mocked<QueueManagerService>;
    let dataCleanerService: jest.Mocked<DataCleanerService>;
    let fileService: jest.Mocked<FileService>;

    const mockTask: ProcessingTask = {
        taskId: 'test-task-123',
        fileId: 'file-123',
        filePath: '/tmp/test-file.csv',
        originalFileName: 'test.csv',
        fileSize: 1024,
        createdAt: new Date(),
        retryCount: 0
    };

    const mockProcessingResult = {
        jobId: 'test-task-123',
        statistics: {
            totalRows: 100,
            processedRows: 95,
            errorRows: 5
        }
    };

    beforeEach(async () => {
        const mockQueueManagerService = {
            dequeueTask: jest.fn(),
            setTaskStatus: jest.fn(),
            updateProgress: jest.fn(),
            enqueueTask: jest.fn()
        };

        const mockDataCleanerService = {
            cleanDataStream: jest.fn()
        };

        const mockFileService = {
            fileExists: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TaskConsumerService,
                {
                    provide: QueueManagerService,
                    useValue: mockQueueManagerService
                },
                {
                    provide: DataCleanerService,
                    useValue: mockDataCleanerService
                },
                {
                    provide: FileService,
                    useValue: mockFileService
                }
            ]
        }).compile();

        service = module.get<TaskConsumerService>(TaskConsumerService);
        queueManagerService = module.get(QueueManagerService);
        dataCleanerService = module.get(DataCleanerService);
        fileService = module.get(FileService);
    });

    afterEach(async () => {
        // Ensure service is stopped after each test
        if (service.getStatus().isRunning) {
            await service.stop();
        }
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should start and stop gracefully', async () => {
        // Mock dequeueTask to return null (timeout) to avoid infinite loop
        queueManagerService.dequeueTask.mockResolvedValue(null);

        await service.start();
        expect(service.getStatus().isRunning).toBe(true);

        await service.stop();
        expect(service.getStatus().isRunning).toBe(false);
    });

    it('should report correct initial status', () => {
        const status = service.getStatus();
        expect(status).toEqual({
            isRunning: false,
            isShuttingDown: false,
            currentTask: null
        });
    });

    it('should classify network errors as retryable', () => {
        const networkError = new Error('ECONNRESET: Connection reset');
        const errorType = (service as any).classifyError(networkError);
        expect(errorType).toBe('retryable_network');
    });

    it('should classify format errors as permanent', () => {
        const formatError = new Error('Unsupported file format');
        const errorType = (service as any).classifyError(formatError);
        expect(errorType).toBe('permanent_format');
    });

    it('should not retry after max retries', () => {
        const error = new Error('ECONNRESET');
        const shouldRetry = (service as any).shouldRetry(error, 3);
        expect(shouldRetry).toBe(false);
    });

    it('should retry retryable errors within limit', () => {
        const error = new Error('ECONNRESET');
        const shouldRetry = (service as any).shouldRetry(error, 1);
        expect(shouldRetry).toBe(true);
    });

    it('should not retry permanent errors', () => {
        const error = new Error('Unsupported file format');
        const shouldRetry = (service as any).shouldRetry(error, 0);
        expect(shouldRetry).toBe(false);
    });
});
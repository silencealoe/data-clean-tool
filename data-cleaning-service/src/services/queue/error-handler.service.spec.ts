import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ErrorHandlerService, ErrorType } from './error-handler.service';
import { ProcessingTask } from '../../common/types/queue.types';

describe('ErrorHandlerService', () => {
    let service: ErrorHandlerService;
    let configService: ConfigService;

    const mockConfigService = {
        get: jest.fn().mockReturnValue({
            maxRetries: 3,
            baseRetryDelay: 1000,
            systemErrorNotificationThreshold: 5
        })
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ErrorHandlerService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService
                }
            ],
        }).compile();

        service = module.get<ErrorHandlerService>(ErrorHandlerService);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('classifyError', () => {
        it('should classify network errors as RETRYABLE_NETWORK', () => {
            const networkErrors = [
                new Error('ECONNRESET: Connection reset by peer'),
                new Error('ETIMEDOUT: Connection timed out'),
                new Error('ENOTFOUND: DNS lookup failed'),
                new Error('Redis connection failed'),
                new Error('Network timeout occurred')
            ];

            networkErrors.forEach(error => {
                expect(service.classifyError(error)).toBe(ErrorType.RETRYABLE_NETWORK);
            });
        });

        it('should classify resource errors as RETRYABLE_RESOURCE', () => {
            const resourceErrors = [
                new Error('ENOMEM: Out of memory'),
                new Error('ENOSPC: No space left on device'),
                new Error('Insufficient memory available'),
                new Error('Disk space quota exceeded')
            ];

            resourceErrors.forEach(error => {
                expect(service.classifyError(error)).toBe(ErrorType.RETRYABLE_RESOURCE);
            });
        });

        it('should classify permission errors as PERMANENT_PERMISSION', () => {
            const permissionErrors = [
                new Error('EACCES: Permission denied'),
                new Error('EPERM: Operation not permitted'),
                new Error('Access denied to file'),
                new Error('Unauthorized access')
            ];

            permissionErrors.forEach(error => {
                expect(service.classifyError(error)).toBe(ErrorType.PERMANENT_PERMISSION);
            });
        });

        it('should classify format errors as PERMANENT_FORMAT', () => {
            const formatErrors = [
                new Error('Unsupported file format'),
                new Error('Invalid CSV format'),
                new Error('File corrupted'),
                new Error('File not found'),
                new Error('Malformed data structure')
            ];

            formatErrors.forEach(error => {
                expect(service.classifyError(error)).toBe(ErrorType.PERMANENT_FORMAT);
            });
        });

        it('should classify unknown errors as PERMANENT_BUSINESS', () => {
            const businessErrors = [
                new Error('Invalid business rule'),
                new Error('Data validation failed'),
                new Error('Unknown processing error')
            ];

            businessErrors.forEach(error => {
                expect(service.classifyError(error)).toBe(ErrorType.PERMANENT_BUSINESS);
            });
        });
    });

    describe('shouldRetry', () => {
        it('should return true for retryable errors within retry limit', () => {
            const networkError = new Error('ECONNRESET');
            const resourceError = new Error('ENOMEM');

            expect(service.shouldRetry(networkError, 0)).toBe(true);
            expect(service.shouldRetry(networkError, 2)).toBe(true);
            expect(service.shouldRetry(resourceError, 1)).toBe(true);
        });

        it('should return false for retryable errors exceeding retry limit', () => {
            const networkError = new Error('ECONNRESET');

            expect(service.shouldRetry(networkError, 3)).toBe(false);
            expect(service.shouldRetry(networkError, 5)).toBe(false);
        });

        it('should return false for permanent errors regardless of retry count', () => {
            const formatError = new Error('Invalid file format');
            const permissionError = new Error('EACCES');
            const businessError = new Error('Business logic error');

            expect(service.shouldRetry(formatError, 0)).toBe(false);
            expect(service.shouldRetry(permissionError, 1)).toBe(false);
            expect(service.shouldRetry(businessError, 2)).toBe(false);
        });
    });

    describe('calculateRetryDelay', () => {
        it('should calculate exponential backoff delays', () => {
            expect(service.calculateRetryDelay(0)).toBe(1000); // 1s
            expect(service.calculateRetryDelay(1)).toBe(2000); // 2s
            expect(service.calculateRetryDelay(2)).toBe(4000); // 4s
            expect(service.calculateRetryDelay(3)).toBe(8000); // 8s
        });

        it('should cap delay at maximum limit', () => {
            const maxDelay = 5 * 60 * 1000; // 5 minutes
            const largeRetryCount = 20;

            expect(service.calculateRetryDelay(largeRetryCount)).toBe(maxDelay);
        });
    });

    describe('handlePermanentFailure', () => {
        it('should log error details for permanent failures', async () => {
            const task: ProcessingTask = {
                taskId: 'test-task-1',
                fileId: 'file-1',
                filePath: '/tmp/test.csv',
                originalFileName: 'test.csv',
                fileSize: 1024,
                createdAt: new Date(),
                retryCount: 2
            };

            const error = new Error('Unsupported file format'); // Use a format error that will be classified correctly
            const logErrorSpy = jest.spyOn(service, 'logError').mockResolvedValue();

            await service.handlePermanentFailure(task, error);

            expect(logErrorSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    taskId: 'test-task-1',
                    errorType: ErrorType.PERMANENT_FORMAT,
                    errorMessage: 'Unsupported file format',
                    fileInfo: {
                        fileName: 'test.csv',
                        fileSize: 1024,
                        filePath: '/tmp/test.csv'
                    },
                    retryCount: 2
                })
            );
        });
    });

    describe('createErrorSummary', () => {
        it('should create comprehensive error summary', () => {
            const task: ProcessingTask = {
                taskId: 'test-task-1',
                fileId: 'file-1',
                filePath: '/tmp/test.csv',
                originalFileName: 'test.csv',
                fileSize: 1024,
                createdAt: new Date(),
                retryCount: 1
            };

            const error = new Error('Connection timeout');
            const summary = service.createErrorSummary(error, task);

            expect(summary).toContain('test-task-1');
            expect(summary).toContain('retryable_network');
            expect(summary).toContain('Connection timeout');
            expect(summary).toContain('Retryable: true');
            expect(summary).toContain('Retry count: 1/3');
        });
    });

    describe('getErrorStats', () => {
        it('should return current error handling configuration', () => {
            const stats = service.getErrorStats();

            expect(stats).toEqual({
                maxRetries: 3,
                baseDelay: 1000,
                systemErrorThreshold: 5
            });
        });
    });
});
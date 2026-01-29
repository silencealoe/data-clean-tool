import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QueueManagerService } from './queue-manager.service';
import { ProcessingTask, TaskStatus } from '../../common/types/queue.types';

// Mock Redis
jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
        lpush: jest.fn().mockResolvedValue(1),
        brpop: jest.fn().mockResolvedValue(['queue', JSON.stringify({
            taskId: 'test-task-1',
            fileId: 'file-1',
            filePath: '/tmp/test.csv',
            originalFileName: 'test.csv',
            fileSize: 1000,
            createdAt: new Date(),
            retryCount: 0,
        })]),
        hmset: jest.fn().mockResolvedValue('OK'),
        hgetall: jest.fn().mockResolvedValue({
            status: 'pending',
            progress: '0',
            createdAt: new Date().toISOString(),
        }),
        expire: jest.fn().mockResolvedValue(1),
        ping: jest.fn().mockResolvedValue('PONG'),
        llen: jest.fn().mockResolvedValue(5),
        hincrby: jest.fn().mockResolvedValue(1),
        del: jest.fn().mockResolvedValue(1),
        quit: jest.fn().mockResolvedValue('OK'),
        on: jest.fn(),
    }));
});

describe('QueueManagerService', () => {
    let service: QueueManagerService;
    let configService: ConfigService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                QueueManagerService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'redis') {
                                return {
                                    host: 'localhost',
                                    port: 6379,
                                    password: undefined,
                                    db: 0,
                                    connectTimeout: 5000,
                                    commandTimeout: 3000,
                                    enableReadyCheck: true,
                                    maxRetriesPerRequest: 3,
                                };
                            }
                            if (key === 'queue') {
                                return {
                                    queueName: 'test-queue',
                                    maxRetryAttempts: 3,
                                    taskTimeoutMs: 1800000,
                                    taskTtlSeconds: 604800,
                                    progressUpdateIntervalMs: 2000,
                                };
                            }
                            return null;
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<QueueManagerService>(QueueManagerService);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('enqueueTask', () => {
        it('should enqueue a task successfully', async () => {
            const task: ProcessingTask = {
                taskId: 'test-task-1',
                fileId: 'file-1',
                filePath: '/tmp/test.csv',
                originalFileName: 'test.csv',
                fileSize: 1000,
                createdAt: new Date(),
                retryCount: 0,
            };

            const result = await service.enqueueTask(task);
            expect(result).toBe(task.taskId);
        });
    });

    describe('dequeueTask', () => {
        it('should dequeue a task successfully', async () => {
            const task = await service.dequeueTask(1);

            expect(task).toBeDefined();
            expect(task).not.toBeNull();
            if (task) {
                expect(task.taskId).toBe('test-task-1');
                expect(task.fileId).toBe('file-1');
            }
        });
    });

    describe('setTaskStatus', () => {
        it('should set task status successfully', async () => {
            await expect(
                service.setTaskStatus('test-task-1', TaskStatus.PROCESSING, {
                    startedAt: new Date(),
                })
            ).resolves.not.toThrow();
        });
    });

    describe('getTaskStatus', () => {
        it('should get task status successfully', async () => {
            const status = await service.getTaskStatus('test-task-1');

            expect(status).toBeDefined();
            expect(status.taskId).toBe('test-task-1');
            expect(status.status).toBe('pending');
        });
    });

    describe('updateProgress', () => {
        it('should update progress successfully', async () => {
            const progress = {
                taskId: 'test-task-1',
                progress: 50,
                processedRows: 500,
                totalRows: 1000,
                currentPhase: 'processing',
            };

            await expect(
                service.updateProgress('test-task-1', progress)
            ).resolves.not.toThrow();
        });
    });

    describe('isHealthy', () => {
        it('should return true when Redis is healthy', async () => {
            const isHealthy = await service.isHealthy();
            expect(isHealthy).toBe(true);
        });
    });

    describe('getQueueStats', () => {
        it('should return queue statistics', async () => {
            const stats = await service.getQueueStats();

            expect(stats).toBeDefined();
            expect(stats.queueLength).toBe(5);
            expect(typeof stats.totalEnqueued).toBe('number');
        });
    });
});
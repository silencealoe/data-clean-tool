import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RecoveryManagerService } from './recovery-manager.service';
import { QueueManagerService } from './queue-manager.service';
import { TaskStatus } from '../../common/types/queue.types';

describe('RecoveryManagerService', () => {
    let service: RecoveryManagerService;
    let queueManager: jest.Mocked<QueueManagerService>;
    let configService: jest.Mocked<ConfigService>;

    const mockRedis = {
        keys: jest.fn(),
        hgetall: jest.fn(),
        pipeline: jest.fn(),
        exec: jest.fn(),
        ping: jest.fn(),
        quit: jest.fn(),
        get: jest.fn(),
        ttl: jest.fn(),
        expire: jest.fn(),
        status: 'ready'
    };

    beforeEach(async () => {
        const mockQueueManager = {
            getTaskStatus: jest.fn(),
            setTaskStatus: jest.fn(),
            updateProgress: jest.fn(),
            enqueueTask: jest.fn(),
        };

        const mockConfigService = {
            get: jest.fn().mockImplementation((key: string) => {
                if (key === 'redis') {
                    return {
                        host: 'localhost',
                        port: 6379,
                        password: '',
                        db: 0,
                        connectTimeout: 10000,
                        commandTimeout: 5000,
                        enableReadyCheck: true,
                        maxRetriesPerRequest: 3,
                    };
                }
                if (key === 'queue') {
                    return {
                        taskTtlSeconds: 604800,
                        recovery: {
                            abandonedTaskThresholdMs: 3600000,
                            maxRecoveryAttempts: 3,
                            batchSize: 50,
                            enableAutoRecovery: true,
                            checkIntervalMs: 600000,
                        }
                    };
                }
                if (key === 'queue.taskTtlSeconds') {
                    return 604800;
                }
                return undefined;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RecoveryManagerService,
                {
                    provide: QueueManagerService,
                    useValue: mockQueueManager,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<RecoveryManagerService>(RecoveryManagerService);
        queueManager = module.get(QueueManagerService);
        configService = module.get(ConfigService);

        // Mock Redis connection
        (service as any).redis = mockRedis;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('detectAbandonedTasks', () => {
        it('should detect tasks that have been processing for too long', async () => {
            const now = Date.now();
            const abandonedStartTime = new Date(now - 7200000); // 2 hours ago
            const recentStartTime = new Date(now - 1800000); // 30 minutes ago

            mockRedis.keys.mockResolvedValue(['task:status:task1', 'task:status:task2']);
            mockRedis.pipeline.mockReturnValue({
                hgetall: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([
                    [null, { status: 'processing', startedAt: abandonedStartTime.toISOString() }],
                    [null, { status: 'processing', startedAt: recentStartTime.toISOString() }],
                ])
            });

            const abandonedTasks = await service.detectAbandonedTasks();

            expect(abandonedTasks).toHaveLength(1);
            expect(abandonedTasks[0].taskId).toBe('task1');
            expect(abandonedTasks[0].status).toBe(TaskStatus.PROCESSING);
            expect(abandonedTasks[0].elapsedMs).toBeGreaterThan(3600000); // > 1 hour
        });

        it('should return empty array when no abandoned tasks found', async () => {
            mockRedis.keys.mockResolvedValue([]);

            const abandonedTasks = await service.detectAbandonedTasks();

            expect(abandonedTasks).toHaveLength(0);
        });

        it('should handle Redis errors gracefully', async () => {
            mockRedis.keys.mockRejectedValue(new Error('Redis connection failed'));

            const abandonedTasks = await service.detectAbandonedTasks();

            expect(abandonedTasks).toHaveLength(0);
        });
    });

    describe('recoverAbandonedTask', () => {
        it('should successfully recover an abandoned task', async () => {
            const taskId = 'abandoned-task-1';
            const now = Date.now();
            const startedAt = new Date(now - 7200000); // 2 hours ago

            queueManager.getTaskStatus.mockResolvedValue({
                taskId,
                status: TaskStatus.PROCESSING,
                progress: 50,
                createdAt: new Date(now - 7200000),
                startedAt,
                statistics: undefined
            });

            queueManager.setTaskStatus.mockResolvedValue();
            queueManager.updateProgress.mockResolvedValue();
            queueManager.enqueueTask.mockResolvedValue(taskId);

            // Mock task reconstruction
            mockRedis.get.mockResolvedValue(JSON.stringify({
                taskId,
                fileId: 'file-1',
                filePath: '/tmp/test.csv',
                originalFileName: 'test.csv',
                fileSize: 1000,
                createdAt: new Date(now - 7200000),
                retryCount: 0
            }));

            const result = await service.recoverAbandonedTask(taskId);

            expect(result).toBe(true);
            expect(queueManager.setTaskStatus).toHaveBeenCalledWith(
                taskId,
                TaskStatus.PENDING,
                expect.objectContaining({
                    recoveredAt: expect.any(Date),
                    recoveryReason: 'Task was abandoned and recovered'
                })
            );
            expect(queueManager.enqueueTask).toHaveBeenCalled();
        });

        it('should not recover task that is not in processing state', async () => {
            const taskId = 'completed-task-1';

            queueManager.getTaskStatus.mockResolvedValue({
                taskId,
                status: TaskStatus.COMPLETED,
                progress: 100,
                createdAt: new Date(),
                completedAt: new Date(),
                statistics: undefined
            });

            const result = await service.recoverAbandonedTask(taskId);

            expect(result).toBe(false);
            expect(queueManager.setTaskStatus).not.toHaveBeenCalled();
            expect(queueManager.enqueueTask).not.toHaveBeenCalled();
        });

        it('should not recover task that is not actually abandoned', async () => {
            const taskId = 'recent-task-1';
            const now = Date.now();
            const recentStartTime = new Date(now - 1800000); // 30 minutes ago

            queueManager.getTaskStatus.mockResolvedValue({
                taskId,
                status: TaskStatus.PROCESSING,
                progress: 25,
                createdAt: new Date(now - 1800000),
                startedAt: recentStartTime,
                statistics: undefined
            });

            const result = await service.recoverAbandonedTask(taskId);

            expect(result).toBe(false);
            expect(queueManager.setTaskStatus).not.toHaveBeenCalled();
            expect(queueManager.enqueueTask).not.toHaveBeenCalled();
        });
    });

    describe('resetTaskToPending', () => {
        it('should reset task status and progress', async () => {
            const taskId = 'task-to-reset';

            queueManager.setTaskStatus.mockResolvedValue();
            queueManager.updateProgress.mockResolvedValue();

            await service.resetTaskToPending(taskId);

            expect(queueManager.setTaskStatus).toHaveBeenCalledWith(
                taskId,
                TaskStatus.PENDING,
                expect.objectContaining({
                    recoveredAt: expect.any(Date),
                    recoveryReason: 'Task was abandoned and recovered'
                })
            );

            expect(queueManager.updateProgress).toHaveBeenCalledWith(
                taskId,
                expect.objectContaining({
                    taskId,
                    progress: 0,
                    processedRows: 0,
                    totalRows: 0,
                    currentPhase: 'recovered',
                    lastUpdated: expect.any(Date)
                })
            );
        });
    });

    describe('cleanupExpiredTasks', () => {
        it('should set TTL for tasks without expiration', async () => {
            mockRedis.keys
                .mockResolvedValueOnce(['task:status:task1', 'task:status:task2'])
                .mockResolvedValueOnce(['task:progress:task1', 'task:progress:task2']);

            mockRedis.ttl
                .mockResolvedValueOnce(-1) // No TTL
                .mockResolvedValueOnce(3600) // Has TTL
                .mockResolvedValueOnce(-1) // No TTL
                .mockResolvedValueOnce(7200); // Has TTL

            mockRedis.expire.mockResolvedValue(1);

            const result = await service.cleanupExpiredTasks();

            expect(mockRedis.expire).toHaveBeenCalledTimes(2);
            expect(mockRedis.expire).toHaveBeenCalledWith('task:status:task1', 604800);
            expect(mockRedis.expire).toHaveBeenCalledWith('task:progress:task1', 604800);
        });
    });

    describe('getRecoveryStatus', () => {
        it('should return current recovery configuration', () => {
            const status = service.getRecoveryStatus();

            expect(status).toEqual({
                abandonedTaskThresholdMs: 3600000,
                maxRecoveryAttempts: 3,
                recoveryBatchSize: 50,
                enableAutoRecovery: true,
                recoveryCheckIntervalMs: 600000,
                isPeriodicCheckActive: false
            });
        });
    });
});
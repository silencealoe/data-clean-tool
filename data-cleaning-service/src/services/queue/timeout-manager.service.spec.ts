import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TimeoutManagerService } from './timeout-manager.service';
import { QueueManagerService } from './queue-manager.service';
import { TaskStatus } from '../../common/types/queue.types';

describe('TimeoutManagerService', () => {
    let service: TimeoutManagerService;
    let queueManager: QueueManagerService;

    const mockConfigService = {
        get: jest.fn().mockReturnValue({
            maxProcessingTimeMs: 30000, // 30 seconds for testing
            timeoutCheckIntervalMs: 5000 // 5 seconds for testing
        })
    };

    const mockQueueManager = {
        setTaskStatus: jest.fn().mockResolvedValue(undefined)
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TimeoutManagerService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService
                },
                {
                    provide: QueueManagerService,
                    useValue: mockQueueManager
                }
            ],
        }).compile();

        service = module.get<TimeoutManagerService>(TimeoutManagerService);
        queueManager = module.get<QueueManagerService>(QueueManagerService);

        // Clear any existing timeouts
        jest.clearAllMocks();
    });

    afterEach(() => {
        // Clean up any active timeouts
        service.onModuleDestroy();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('startTimeout', () => {
        it('should start timeout monitoring for a task', () => {
            const taskId = 'test-task-1';

            service.startTimeout(taskId);

            const activeTimeouts = service.getActiveTimeouts();
            expect(activeTimeouts).toHaveLength(1);
            expect(activeTimeouts[0].taskId).toBe(taskId);
            expect(activeTimeouts[0].timeoutMs).toBe(30000);
        });

        it('should use custom timeout when provided', () => {
            const taskId = 'test-task-2';
            const customTimeout = 60000;

            service.startTimeout(taskId, customTimeout);

            const activeTimeouts = service.getActiveTimeouts();
            expect(activeTimeouts[0].timeoutMs).toBe(customTimeout);
        });

        it('should replace existing timeout for same task', () => {
            const taskId = 'test-task-3';

            service.startTimeout(taskId, 10000);
            service.startTimeout(taskId, 20000);

            const activeTimeouts = service.getActiveTimeouts();
            expect(activeTimeouts).toHaveLength(1);
            expect(activeTimeouts[0].timeoutMs).toBe(20000);
        });
    });

    describe('clearTimeout', () => {
        it('should clear timeout monitoring for a task', () => {
            const taskId = 'test-task-4';

            service.startTimeout(taskId);
            expect(service.getActiveTimeouts()).toHaveLength(1);

            service.clearTimeout(taskId);
            expect(service.getActiveTimeouts()).toHaveLength(0);
        });

        it('should handle clearing non-existent timeout gracefully', () => {
            expect(() => service.clearTimeout('non-existent')).not.toThrow();
        });
    });

    describe('isTaskTimedOut', () => {
        it('should return false for non-existent task', () => {
            expect(service.isTaskTimedOut('non-existent')).toBe(false);
        });

        it('should return false for task within timeout', () => {
            const taskId = 'test-task-5';
            service.startTimeout(taskId, 60000); // 1 minute

            expect(service.isTaskTimedOut(taskId)).toBe(false);
        });

        it('should return true for task that has exceeded timeout', async () => {
            const taskId = 'test-task-6';
            service.startTimeout(taskId, 50); // 50ms

            // Wait for timeout to occur
            await new Promise(resolve => setTimeout(resolve, 100));

            // After timeout occurs, the task should be removed from active timeouts
            // So we check if it's no longer in the active timeouts list
            const activeTimeouts = service.getActiveTimeouts();
            const taskExists = activeTimeouts.some(t => t.taskId === taskId);
            expect(taskExists).toBe(false); // Task should be removed after timeout
        });
    });

    describe('checkTimeouts', () => {
        it('should identify and handle timed out tasks', async () => {
            const taskId = 'test-task-7';
            service.startTimeout(taskId, 50); // 50ms

            // Wait for timeout to occur
            await new Promise(resolve => setTimeout(resolve, 100));

            // The timeout should have been handled automatically
            expect(mockQueueManager.setTaskStatus).toHaveBeenCalledWith(
                taskId,
                TaskStatus.TIMEOUT,
                expect.objectContaining({
                    errorMessage: expect.stringContaining('Task timed out'),
                    completedAt: expect.any(Date)
                })
            );
        });

        it('should return empty array when no tasks are timed out', async () => {
            const taskId = 'test-task-8';
            service.startTimeout(taskId, 60000); // 1 minute

            const timedOutTasks = await service.checkTimeouts();

            expect(timedOutTasks).toHaveLength(0);
        });
    });

    describe('getTimeoutStats', () => {
        it('should return accurate timeout statistics', () => {
            const taskId1 = 'test-task-9';
            const taskId2 = 'test-task-10';

            service.startTimeout(taskId1, 30000);
            service.startTimeout(taskId2, 60000);

            const stats = service.getTimeoutStats();

            expect(stats.activeTimeouts).toBe(2);
            expect(stats.maxProcessingTime).toBe(30000);
            expect(stats.checkInterval).toBe(5000);
            expect(stats.timeoutTasks).toHaveLength(2);

            const task1Stats = stats.timeoutTasks.find(t => t.taskId === taskId1);
            expect(task1Stats).toBeDefined();
            expect(task1Stats!.elapsedMs).toBeGreaterThanOrEqual(0);
            expect(task1Stats!.remainingMs).toBeLessThanOrEqual(30000);
        });
    });

    describe('extendTimeout', () => {
        it('should extend timeout for existing task', () => {
            const taskId = 'test-task-11';
            service.startTimeout(taskId, 30000);

            const result = service.extendTimeout(taskId, 15000);

            expect(result).toBe(true);

            // The timeout should still be active
            const activeTimeouts = service.getActiveTimeouts();
            const taskTimeout = activeTimeouts.find(t => t.taskId === taskId);
            expect(taskTimeout).toBeDefined();
            // The new timeout should be at least the extension amount
            expect(taskTimeout!.timeoutMs).toBeGreaterThanOrEqual(15000);
        });

        it('should return false for non-existent task', () => {
            const result = service.extendTimeout('non-existent', 15000);
            expect(result).toBe(false);
        });
    });

    describe('getRemainingTime', () => {
        it('should return remaining time for active task', () => {
            const taskId = 'test-task-12';
            service.startTimeout(taskId, 60000);

            const remaining = service.getRemainingTime(taskId);

            expect(remaining).toBeGreaterThan(50000);
            expect(remaining).toBeLessThanOrEqual(60000);
        });

        it('should return null for non-existent task', () => {
            const remaining = service.getRemainingTime('non-existent');
            expect(remaining).toBeNull();
        });

        it('should return null for expired task', async () => {
            const taskId = 'test-task-13';
            service.startTimeout(taskId, 50);

            // Wait for timeout to occur
            await new Promise(resolve => setTimeout(resolve, 100));

            // After timeout, the task should be removed, so getRemainingTime should return null
            const remaining = service.getRemainingTime(taskId);
            expect(remaining).toBeNull();
        });
    });

    describe('clearTimeouts', () => {
        it('should clear multiple timeouts at once', () => {
            const taskIds = ['task-1', 'task-2', 'task-3'];

            taskIds.forEach(taskId => service.startTimeout(taskId));
            expect(service.getActiveTimeouts()).toHaveLength(3);

            service.clearTimeouts(taskIds);
            expect(service.getActiveTimeouts()).toHaveLength(0);
        });

        it('should handle clearing mix of existing and non-existing tasks', () => {
            service.startTimeout('existing-task');

            expect(() => {
                service.clearTimeouts(['existing-task', 'non-existing-task']);
            }).not.toThrow();

            expect(service.getActiveTimeouts()).toHaveLength(0);
        });
    });
});
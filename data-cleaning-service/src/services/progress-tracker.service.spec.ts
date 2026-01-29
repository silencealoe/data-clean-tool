import { Test, TestingModule } from '@nestjs/testing';
import { ProgressTrackerService } from './progress-tracker.service';
import { QueueManagerInterface, ProgressInfo, TaskStatus } from '../common/types/queue.types';

describe('ProgressTrackerService', () => {
    let service: ProgressTrackerService;
    let mockQueueManager: jest.Mocked<QueueManagerInterface>;

    beforeEach(async () => {
        // Create mock QueueManager
        mockQueueManager = {
            enqueueTask: jest.fn(),
            dequeueTask: jest.fn(),
            setTaskStatus: jest.fn(),
            getTaskStatus: jest.fn(),
            updateProgress: jest.fn(),
            getProgress: jest.fn(),
            isHealthy: jest.fn(),
            getQueueStats: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProgressTrackerService,
                {
                    provide: 'QueueManagerInterface',
                    useValue: mockQueueManager,
                },
            ],
        }).compile();

        service = module.get<ProgressTrackerService>(ProgressTrackerService);
        // Inject the mock directly into the service
        (service as any).queueManager = mockQueueManager;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('updateProgress', () => {
        it('should update progress with calculated percentage', async () => {
            const taskId = 'test-task-1';
            const currentProgress: ProgressInfo = {
                taskId,
                progress: 0,
                processedRows: 0,
                totalRows: 100,
                currentPhase: 'processing',
                lastUpdated: new Date(),
            };

            mockQueueManager.getProgress.mockResolvedValue(currentProgress);
            mockQueueManager.updateProgress.mockResolvedValue();

            await service.updateProgress(taskId, {
                processedRows: 50,
                totalRows: 100,
                currentPhase: 'processing',
            });

            expect(mockQueueManager.updateProgress).toHaveBeenCalledWith(
                taskId,
                expect.objectContaining({
                    taskId,
                    progress: 50, // 50/100 * 100 = 50%
                    processedRows: 50,
                    totalRows: 100,
                    currentPhase: 'processing',
                    lastUpdated: expect.any(Date),
                })
            );
        });

        it('should calculate ETA when processing starts', async () => {
            const taskId = 'test-task-2';
            const currentProgress: ProgressInfo = {
                taskId,
                progress: 0,
                processedRows: 0,
                totalRows: 1000,
                currentPhase: 'processing',
                lastUpdated: new Date(),
            };

            mockQueueManager.getProgress.mockResolvedValue(currentProgress);
            mockQueueManager.updateProgress.mockResolvedValue();

            // First update to start tracking time
            await service.updateProgress(taskId, {
                processedRows: 100,
                totalRows: 1000,
                currentPhase: 'processing',
            });

            // Wait a bit and update again to test ETA calculation
            await new Promise(resolve => setTimeout(resolve, 10));

            await service.updateProgress(taskId, {
                processedRows: 200,
                totalRows: 1000,
                currentPhase: 'processing',
            });

            expect(mockQueueManager.updateProgress).toHaveBeenLastCalledWith(
                taskId,
                expect.objectContaining({
                    estimatedTimeRemaining: expect.any(Number),
                })
            );
        });

        it('should handle errors gracefully', async () => {
            const taskId = 'test-task-error';
            mockQueueManager.getProgress.mockRejectedValue(new Error('Redis error'));

            await expect(service.updateProgress(taskId, { processedRows: 10 })).rejects.toThrow('Redis error');
        });
    });

    describe('initializeProgress', () => {
        it('should initialize progress with correct values', async () => {
            const taskId = 'test-task-init';
            const totalRows = 500;
            const currentPhase = 'parsing';

            mockQueueManager.updateProgress.mockResolvedValue();

            await service.initializeProgress(taskId, totalRows, currentPhase);

            expect(mockQueueManager.updateProgress).toHaveBeenCalledWith(
                taskId,
                expect.objectContaining({
                    taskId,
                    progress: 0,
                    processedRows: 0,
                    totalRows: 500,
                    currentPhase: 'parsing',
                    lastUpdated: expect.any(Date),
                })
            );
        });

        it('should use default phase when not provided', async () => {
            const taskId = 'test-task-default';
            const totalRows = 300;

            mockQueueManager.updateProgress.mockResolvedValue();

            await service.initializeProgress(taskId, totalRows);

            expect(mockQueueManager.updateProgress).toHaveBeenCalledWith(
                taskId,
                expect.objectContaining({
                    currentPhase: 'initializing',
                })
            );
        });
    });

    describe('markCompleted', () => {
        it('should mark task as completed with 100% progress', async () => {
            const taskId = 'test-task-complete';
            const currentProgress: ProgressInfo = {
                taskId,
                progress: 95,
                processedRows: 950,
                totalRows: 1000,
                currentPhase: 'processing',
                lastUpdated: new Date(),
            };

            mockQueueManager.getProgress.mockResolvedValue(currentProgress);
            mockQueueManager.updateProgress.mockResolvedValue();

            await service.markCompleted(taskId);

            expect(mockQueueManager.updateProgress).toHaveBeenCalledWith(
                taskId,
                expect.objectContaining({
                    progress: 100,
                    processedRows: 1000, // Should match totalRows
                    currentPhase: 'completed',
                    estimatedTimeRemaining: 0,
                })
            );
        });
    });

    describe('markFailed', () => {
        it('should mark task as failed with error message', async () => {
            const taskId = 'test-task-failed';
            const errorMessage = 'File processing failed';
            const currentProgress: ProgressInfo = {
                taskId,
                progress: 30,
                processedRows: 300,
                totalRows: 1000,
                currentPhase: 'processing',
                lastUpdated: new Date(),
            };

            mockQueueManager.getProgress.mockResolvedValue(currentProgress);
            mockQueueManager.updateProgress.mockResolvedValue();

            await service.markFailed(taskId, errorMessage);

            expect(mockQueueManager.updateProgress).toHaveBeenCalledWith(
                taskId,
                expect.objectContaining({
                    currentPhase: 'failed',
                    estimatedTimeRemaining: 0,
                })
            );
        });
    });

    describe('getProcessingRate', () => {
        it('should return null when no start time is recorded', async () => {
            const taskId = 'test-task-no-start';
            const progress: ProgressInfo = {
                taskId,
                progress: 50,
                processedRows: 500,
                totalRows: 1000,
                currentPhase: 'processing',
                lastUpdated: new Date(),
            };

            mockQueueManager.getProgress.mockResolvedValue(progress);

            const rate = await service.getProcessingRate(taskId);
            expect(rate).toBeNull();
        });

        it('should calculate processing rate correctly', async () => {
            const taskId = 'test-task-rate';
            const progress: ProgressInfo = {
                taskId,
                progress: 50,
                processedRows: 500,
                totalRows: 1000,
                currentPhase: 'processing',
                lastUpdated: new Date(),
            };

            mockQueueManager.getProgress.mockResolvedValue(progress);

            // Simulate starting the task
            await service.updateProgress(taskId, { processedRows: 1 });

            // Wait longer to have some elapsed time
            await new Promise(resolve => setTimeout(resolve, 1000));

            const rate = await service.getProcessingRate(taskId);
            expect(rate).not.toBeNull();
            expect(rate?.rowsPerSecond).toBeGreaterThan(0);
            expect(rate?.elapsedSeconds).toBeGreaterThanOrEqual(1);
        });
    });

    describe('updatePhase', () => {
        it('should update phase without changing other progress data', async () => {
            const taskId = 'test-task-phase';
            const newPhase = 'validation';

            mockQueueManager.getProgress.mockResolvedValue({
                taskId,
                progress: 75,
                processedRows: 750,
                totalRows: 1000,
                currentPhase: 'processing',
                lastUpdated: new Date(),
            });
            mockQueueManager.updateProgress.mockResolvedValue();

            await service.updatePhase(taskId, newPhase);

            expect(mockQueueManager.updateProgress).toHaveBeenCalledWith(
                taskId,
                expect.objectContaining({
                    currentPhase: newPhase,
                })
            );
        });

        it('should update phase and processed rows when provided', async () => {
            const taskId = 'test-task-phase-rows';
            const newPhase = 'finalizing';
            const processedRows = 900;

            mockQueueManager.getProgress.mockResolvedValue({
                taskId,
                progress: 75,
                processedRows: 750,
                totalRows: 1000,
                currentPhase: 'processing',
                lastUpdated: new Date(),
            });
            mockQueueManager.updateProgress.mockResolvedValue();

            await service.updatePhase(taskId, newPhase, processedRows);

            expect(mockQueueManager.updateProgress).toHaveBeenCalledWith(
                taskId,
                expect.objectContaining({
                    currentPhase: newPhase,
                    processedRows: processedRows,
                })
            );
        });
    });

    describe('getActiveTasksSummary', () => {
        it('should return empty array when no active tasks', () => {
            const summary = service.getActiveTasksSummary();
            expect(summary).toEqual([]);
        });

        it('should return summary of active tasks', async () => {
            const taskId1 = 'task-1';
            const taskId2 = 'task-2';

            // Start tracking tasks by updating their progress
            mockQueueManager.getProgress.mockResolvedValue({
                taskId: taskId1,
                progress: 0,
                processedRows: 0,
                totalRows: 100,
                currentPhase: 'processing',
                lastUpdated: new Date(),
            });
            mockQueueManager.updateProgress.mockResolvedValue();

            await service.updateProgress(taskId1, { processedRows: 1 });
            await service.updateProgress(taskId2, { processedRows: 1 });

            const summary = service.getActiveTasksSummary();
            expect(summary).toHaveLength(2);
            expect(summary[0].taskId).toBe(taskId1);
            expect(summary[1].taskId).toBe(taskId2);
            expect(summary[0].elapsedMinutes).toBeGreaterThanOrEqual(0);
        });
    });

    describe('cleanup', () => {
        it('should remove task from internal tracking', async () => {
            const taskId = 'test-task-cleanup';

            // Start tracking the task
            mockQueueManager.getProgress.mockResolvedValue({
                taskId,
                progress: 0,
                processedRows: 0,
                totalRows: 100,
                currentPhase: 'processing',
                lastUpdated: new Date(),
            });
            mockQueueManager.updateProgress.mockResolvedValue();

            await service.updateProgress(taskId, { processedRows: 1 });

            // Verify task is being tracked
            let summary = service.getActiveTasksSummary();
            expect(summary).toHaveLength(1);

            // Cleanup the task
            service.cleanup(taskId);

            // Verify task is no longer tracked
            summary = service.getActiveTasksSummary();
            expect(summary).toHaveLength(0);
        });
    });
});
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AsyncProcessingController } from './async-processing.controller';
import { QueueManagerService } from './services/queue/queue-manager.service';
import { TaskProducerService } from './services/task-producer.service';
import { TaskStatus } from './common/types/queue.types';

describe('AsyncProcessingController', () => {
    let controller: AsyncProcessingController;
    let queueManagerService: jest.Mocked<QueueManagerService>;
    let taskProducerService: jest.Mocked<TaskProducerService>;

    beforeEach(async () => {
        const mockQueueManagerService = {
            getTaskStatus: jest.fn(),
            getProgress: jest.fn(),
        };

        const mockTaskProducerService = {};

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AsyncProcessingController],
            providers: [
                {
                    provide: QueueManagerService,
                    useValue: mockQueueManagerService,
                },
                {
                    provide: TaskProducerService,
                    useValue: mockTaskProducerService,
                },
            ],
        }).compile();

        controller = module.get<AsyncProcessingController>(AsyncProcessingController);
        queueManagerService = module.get(QueueManagerService);
        taskProducerService = module.get(TaskProducerService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('checkStatus', () => {
        it('should return task status and progress for valid task ID', async () => {
            const taskId = 'test-task-123';
            const mockStatusInfo = {
                taskId,
                status: TaskStatus.PROCESSING,
                progress: 50,
                createdAt: new Date(),
                startedAt: new Date(),
            };
            const mockProgressInfo = {
                taskId,
                progress: 50,
                processedRows: 500,
                totalRows: 1000,
                currentPhase: 'processing',
                lastUpdated: new Date(),
            };

            queueManagerService.getTaskStatus.mockResolvedValue(mockStatusInfo);
            queueManagerService.getProgress.mockResolvedValue(mockProgressInfo);

            const result = await controller.checkStatus(taskId);

            expect(result).toEqual({
                taskId,
                status: TaskStatus.PROCESSING,
                progress: 50,
                processedRows: 500,
                totalRows: 1000,
                currentPhase: 'processing',
                estimatedTimeRemaining: undefined,
                statistics: undefined,
                createdAt: mockStatusInfo.createdAt,
                startedAt: mockStatusInfo.startedAt,
                completedAt: undefined,
                errorMessage: undefined,
            });

            expect(queueManagerService.getTaskStatus).toHaveBeenCalledWith(taskId);
            expect(queueManagerService.getProgress).toHaveBeenCalledWith(taskId);
        });

        it('should throw NOT_FOUND exception for non-existent task', async () => {
            const taskId = 'non-existent-task';
            queueManagerService.getTaskStatus.mockRejectedValue(new Error('Task non-existent-task not found'));

            await expect(controller.checkStatus(taskId)).rejects.toThrow(
                new HttpException('Task not found', HttpStatus.NOT_FOUND)
            );
        });

        it('should throw INTERNAL_SERVER_ERROR for other errors', async () => {
            const taskId = 'test-task-123';
            queueManagerService.getTaskStatus.mockRejectedValue(new Error('Redis connection failed'));

            await expect(controller.checkStatus(taskId)).rejects.toThrow(
                new HttpException('Failed to get task status', HttpStatus.INTERNAL_SERVER_ERROR)
            );
        });

        it('should return completed task with statistics', async () => {
            const taskId = 'completed-task-123';
            const mockStatusInfo = {
                taskId,
                status: TaskStatus.COMPLETED,
                progress: 100,
                createdAt: new Date(),
                startedAt: new Date(),
                completedAt: new Date(),
                statistics: {
                    totalRows: 1000,
                    processedRows: 1000,
                    validRows: 950,
                    invalidRows: 50,
                    duplicateRows: 0,
                    processingTimeMs: 5000,
                },
            };
            const mockProgressInfo = {
                taskId,
                progress: 100,
                processedRows: 1000,
                totalRows: 1000,
                currentPhase: 'completed',
                lastUpdated: new Date(),
            };

            queueManagerService.getTaskStatus.mockResolvedValue(mockStatusInfo);
            queueManagerService.getProgress.mockResolvedValue(mockProgressInfo);

            const result = await controller.checkStatus(taskId);

            expect(result.status).toBe(TaskStatus.COMPLETED);
            expect(result.progress).toBe(100);
            expect(result.statistics).toEqual(mockStatusInfo.statistics);
            expect(result.completedAt).toBeDefined();
        });
    });
});
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AsyncProcessingController } from './async-processing.controller';
import { QueueManagerService } from './services/queue/queue-manager.service';
import { TaskProducerService } from './services/task-producer.service';
import { TaskStatus } from './common/types/queue.types';

describe('AsyncProcessingController (Integration)', () => {
    let app: INestApplication;
    let queueManagerService: jest.Mocked<QueueManagerService>;

    beforeEach(async () => {
        const mockQueueManagerService = {
            getTaskStatus: jest.fn(),
            getProgress: jest.fn(),
        };

        const mockTaskProducerService = {};

        const moduleFixture: TestingModule = await Test.createTestingModule({
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

        app = moduleFixture.createNestApplication();
        await app.init();

        queueManagerService = moduleFixture.get(QueueManagerService);
    });

    afterEach(async () => {
        await app.close();
    });

    describe('GET /api/data-cleaning/check-status/:taskId', () => {
        it('should return task status for valid task ID', async () => {
            const taskId = 'test-task-123';
            const mockStatusInfo = {
                taskId,
                status: TaskStatus.PROCESSING,
                progress: 75,
                createdAt: new Date('2024-01-01T10:00:00Z'),
                startedAt: new Date('2024-01-01T10:01:00Z'),
            };
            const mockProgressInfo = {
                taskId,
                progress: 75,
                processedRows: 750,
                totalRows: 1000,
                currentPhase: 'data-cleaning',
                estimatedTimeRemaining: 30000,
                lastUpdated: new Date('2024-01-01T10:05:00Z'),
            };

            queueManagerService.getTaskStatus.mockResolvedValue(mockStatusInfo);
            queueManagerService.getProgress.mockResolvedValue(mockProgressInfo);

            const response = await request(app.getHttpServer())
                .get(`/api/data-cleaning/check-status/${taskId}`)
                .expect(200);

            expect(response.body).toMatchObject({
                taskId,
                status: TaskStatus.PROCESSING,
                progress: 75,
                processedRows: 750,
                totalRows: 1000,
                currentPhase: 'data-cleaning',
                estimatedTimeRemaining: 30000,
            });

            expect(queueManagerService.getTaskStatus).toHaveBeenCalledWith(taskId);
            expect(queueManagerService.getProgress).toHaveBeenCalledWith(taskId);
        });

        it('should return 404 for non-existent task', async () => {
            const taskId = 'non-existent-task';
            queueManagerService.getTaskStatus.mockRejectedValue(new Error('Task non-existent-task not found'));

            const response = await request(app.getHttpServer())
                .get(`/api/data-cleaning/check-status/${taskId}`)
                .expect(404);

            expect(response.body.message).toBe('Task not found');
        });

        it('should return 500 for internal server errors', async () => {
            const taskId = 'test-task-123';
            queueManagerService.getTaskStatus.mockRejectedValue(new Error('Redis connection failed'));

            const response = await request(app.getHttpServer())
                .get(`/api/data-cleaning/check-status/${taskId}`)
                .expect(500);

            expect(response.body.message).toBe('Failed to get task status');
        });

        it('should return completed task with statistics', async () => {
            const taskId = 'completed-task-123';
            const mockStatusInfo = {
                taskId,
                status: TaskStatus.COMPLETED,
                progress: 100,
                createdAt: new Date('2024-01-01T10:00:00Z'),
                startedAt: new Date('2024-01-01T10:01:00Z'),
                completedAt: new Date('2024-01-01T10:10:00Z'),
                statistics: {
                    totalRows: 1000,
                    processedRows: 1000,
                    validRows: 950,
                    invalidRows: 50,
                    duplicateRows: 0,
                    processingTimeMs: 540000,
                },
            };
            const mockProgressInfo = {
                taskId,
                progress: 100,
                processedRows: 1000,
                totalRows: 1000,
                currentPhase: 'completed',
                lastUpdated: new Date('2024-01-01T10:10:00Z'),
            };

            queueManagerService.getTaskStatus.mockResolvedValue(mockStatusInfo);
            queueManagerService.getProgress.mockResolvedValue(mockProgressInfo);

            const response = await request(app.getHttpServer())
                .get(`/api/data-cleaning/check-status/${taskId}`)
                .expect(200);

            expect(response.body).toMatchObject({
                taskId,
                status: TaskStatus.COMPLETED,
                progress: 100,
                processedRows: 1000,
                totalRows: 1000,
                currentPhase: 'completed',
                statistics: {
                    totalRows: 1000,
                    processedRows: 1000,
                    validRows: 950,
                    invalidRows: 50,
                    duplicateRows: 0,
                    processingTimeMs: 540000,
                },
            });

            expect(response.body.completedAt).toBeDefined();
        });
    });
});
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataCleaningController } from './data-cleaning.controller';
import { TaskProducerService } from './services/task-producer.service';
import { QueueManagerService } from './services/queue/queue-manager.service';
import { FileRecordService } from './services/file-record.service';
import { FileService } from './services/file.service';
import { ParserService } from './services/parser.service';
import { DataCleanerService } from './services/data-cleaner.service';
import { ExportService } from './services/export.service';
import { DatabasePersistenceService } from './services/database-persistence.service';
import { ParallelProcessingManagerService } from './services/parallel/parallel-processing-manager.service';
import { FileRecord, CleanData, ErrorLog } from './entities';
import redisConfig from './config/redis.config';
import queueConfig from './config/queue.config';

describe('DataCleaningController Integration', () => {
    let controller: DataCleaningController;
    let taskProducer: TaskProducerService;
    let queueManager: QueueManagerService;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [redisConfig, queueConfig],
                }),
                TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    entities: [FileRecord, CleanData, ErrorLog],
                    synchronize: true,
                }),
                TypeOrmModule.forFeature([FileRecord, CleanData, ErrorLog]),
            ],
            controllers: [DataCleaningController],
            providers: [
                TaskProducerService,
                QueueManagerService,
                FileRecordService,
                FileService,
                ParserService,
                DataCleanerService,
                ExportService,
                DatabasePersistenceService,
                ParallelProcessingManagerService,
            ],
        }).compile();

        controller = module.get<DataCleaningController>(DataCleaningController);
        taskProducer = module.get<TaskProducerService>(TaskProducerService);
        queueManager = module.get<QueueManagerService>(QueueManagerService);
    });

    afterAll(async () => {
        // Clean up Redis connections
        await queueManager.onModuleDestroy();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
        expect(taskProducer).toBeDefined();
        expect(queueManager).toBeDefined();
    });

    it('should integrate upload with task producer successfully', async () => {
        // Skip this test if Redis is not available
        const isHealthy = await queueManager.isHealthy();
        if (!isHealthy) {
            console.log('Skipping integration test - Redis not available');
            return;
        }

        const mockFile: Express.Multer.File = {
            fieldname: 'file',
            originalname: 'test.csv',
            encoding: '7bit',
            mimetype: 'text/csv',
            size: 1024,
            buffer: Buffer.from('name,age\nJohn,25\nJane,30'),
            destination: '',
            filename: '',
            path: '',
            stream: null as any,
        };

        try {
            // Act
            const result = await controller.uploadFile(mockFile);

            // Assert
            expect(result).toBeDefined();
            expect(result.jobId).toBeDefined();
            expect(result.fileId).toBeDefined();
            expect(result.message).toBe('文件上传成功，开始处理');
            expect(result.totalRows).toBe(0);

            // Verify task was created in queue
            const taskStatus = await queueManager.getTaskStatus(result.jobId);
            expect(taskStatus.taskId).toBe(result.jobId);
            expect(taskStatus.status).toBe('pending');

            // Verify progress was initialized
            const progress = await queueManager.getProgress(result.jobId);
            expect(progress.taskId).toBe(result.jobId);
            expect(progress.progress).toBe(0);

        } catch (error) {
            console.log('Integration test failed:', error.message);
            // Don't fail the test if Redis is not available
            if (error.message.includes('Redis') || error.message.includes('ECONNREFUSED')) {
                console.log('Skipping test due to Redis connection issues');
                return;
            }
            throw error;
        }
    });
});
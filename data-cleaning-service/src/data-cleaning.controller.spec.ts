import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { DataCleaningController } from './data-cleaning.controller';
import { TaskProducerService } from './services/task-producer.service';
import { FileRecordService } from './services/file-record.service';
import { FileService } from './services/file.service';
import { ParserService } from './services/parser.service';
import { DataCleanerService } from './services/data-cleaner.service';
import { ExportService } from './services/export.service';
import { DatabasePersistenceService } from './services/database-persistence.service';
import { ParallelProcessingManagerService } from './services/parallel/parallel-processing-manager.service';

describe('DataCleaningController - Upload Integration', () => {
    let controller: DataCleaningController;
    let taskProducerService: jest.Mocked<TaskProducerService>;
    let fileRecordService: jest.Mocked<FileRecordService>;

    beforeEach(async () => {
        const mockTaskProducerService = {
            validateFileForTask: jest.fn(),
            createProcessingTask: jest.fn(),
        };

        const mockFileRecordService = {
            createFileRecord: jest.fn(),
        };

        const mockFileService = {
            validateFile: jest.fn(),
        };

        const mockParserService = {};
        const mockDataCleanerService = {};
        const mockExportService = {};
        const mockDatabasePersistenceService = {};
        const mockParallelProcessingManagerService = {};

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DataCleaningController],
            providers: [
                {
                    provide: TaskProducerService,
                    useValue: mockTaskProducerService,
                },
                {
                    provide: FileRecordService,
                    useValue: mockFileRecordService,
                },
                {
                    provide: FileService,
                    useValue: mockFileService,
                },
                {
                    provide: ParserService,
                    useValue: mockParserService,
                },
                {
                    provide: DataCleanerService,
                    useValue: mockDataCleanerService,
                },
                {
                    provide: ExportService,
                    useValue: mockExportService,
                },
                {
                    provide: DatabasePersistenceService,
                    useValue: mockDatabasePersistenceService,
                },
                {
                    provide: ParallelProcessingManagerService,
                    useValue: mockParallelProcessingManagerService,
                },
            ],
        }).compile();

        controller = module.get<DataCleaningController>(DataCleaningController);
        taskProducerService = module.get(TaskProducerService);
        fileRecordService = module.get(FileRecordService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('uploadFile', () => {
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
            stream: null as any,
        };

        const mockFileRecord = {
            id: 'file-record-id',
            jobId: 'job-123',
            originalFileName: 'test.csv',
            fileSize: 1024,
            fileType: 'csv',
            mimeType: 'text/csv',
        };

        it('should successfully upload file and create task', async () => {
            // Arrange
            taskProducerService.validateFileForTask.mockReturnValue(true);
            fileRecordService.createFileRecord.mockResolvedValue(mockFileRecord as any);
            taskProducerService.createProcessingTask.mockResolvedValue('task-123');

            // Act
            const result = await controller.uploadFile(mockFile);

            // Assert
            expect(result).toEqual({
                jobId: 'task-123',
                taskId: 'task-123',
                fileId: 'file-record-id',
                message: '文件上传成功，开始处理',
                totalRows: 0,
                status: 'pending',
            });

            expect(taskProducerService.validateFileForTask).toHaveBeenCalledWith(mockFile);
            expect(fileRecordService.createFileRecord).toHaveBeenCalled();
            expect(taskProducerService.createProcessingTask).toHaveBeenCalledWith(mockFile, mockFileRecord);
        });

        it('should throw error when no file is uploaded', async () => {
            // Act & Assert
            await expect(controller.uploadFile(null as any)).rejects.toThrow(
                new HttpException('No file uploaded', HttpStatus.BAD_REQUEST)
            );
        });

        it('should throw error when file validation fails', async () => {
            // Arrange
            taskProducerService.validateFileForTask.mockReturnValue(false);

            // Act & Assert
            await expect(controller.uploadFile(mockFile)).rejects.toThrow(
                new HttpException('File validation failed', HttpStatus.BAD_REQUEST)
            );

            expect(taskProducerService.validateFileForTask).toHaveBeenCalledWith(mockFile);
        });

        it('should handle task creation errors', async () => {
            // Arrange
            taskProducerService.validateFileForTask.mockReturnValue(true);
            fileRecordService.createFileRecord.mockResolvedValue(mockFileRecord as any);
            taskProducerService.createProcessingTask.mockRejectedValue(new Error('Queue error'));

            // Act & Assert
            await expect(controller.uploadFile(mockFile)).rejects.toThrow(
                new HttpException('File upload failed', HttpStatus.INTERNAL_SERVER_ERROR)
            );
        });
    });
});
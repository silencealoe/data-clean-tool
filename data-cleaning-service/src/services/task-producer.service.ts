import { Injectable, Logger } from '@nestjs/common';
import { QueueManagerService } from './queue/queue-manager.service';
import { FileService } from './file.service';
import { FileRecordService } from './file-record.service';
import { ProcessingTask } from '../common/types/queue.types';
import { FileRecord } from '../entities/file-record.entity';

@Injectable()
export class TaskProducerService {
    private readonly logger = new Logger(TaskProducerService.name);

    constructor(
        private readonly queueManager: QueueManagerService,
        private readonly fileService: FileService,
        private readonly fileRecordService: FileRecordService
    ) { }

    /**
     * Create and enqueue a processing task for uploaded file
     * @param file - The uploaded file
     * @param fileRecord - The file record from database
     * @returns Promise<string> - The task ID
     */
    async createProcessingTask(
        file: Express.Multer.File,
        fileRecord: FileRecord
    ): Promise<string> {
        this.logger.log(`Creating processing task for file: ${file.originalname}, jobId: ${fileRecord.jobId}`);

        try {
            // Save temporary file
            const tempFilePath = await this.fileService.saveTemporaryFile(file);
            this.logger.log(`Temporary file saved: ${tempFilePath}`);

            // Create task object
            const task: ProcessingTask = {
                taskId: fileRecord.jobId,
                fileId: fileRecord.id,
                filePath: tempFilePath,
                originalFileName: file.originalname,
                fileSize: file.size,
                createdAt: new Date(),
                retryCount: 0
            };

            // Enqueue task
            await this.queueManager.enqueueTask(task);
            this.logger.log(`Task ${task.taskId} enqueued successfully`);

            // Update file record with task information
            await this.updateFileRecordForTask(fileRecord.id, task.taskId);

            return task.taskId;

        } catch (error) {
            this.logger.error(`Failed to create processing task for file ${file.originalname}:`, error);
            throw error;
        }
    }

    /**
     * Update file record with task-related information
     * @param fileRecordId - The file record ID
     * @param taskId - The task ID
     */
    private async updateFileRecordForTask(fileRecordId: string, taskId: string): Promise<void> {
        try {
            const fileRecord = await this.fileRecordService.getFileRecord(fileRecordId);

            // Update the file record with task information
            fileRecord.taskId = taskId;
            fileRecord.queueStatus = 'pending';
            fileRecord.enqueuedAt = new Date();

            // Save the updated record
            await this.fileRecordService.updateFileRecordWithTaskInfo(fileRecord);

            this.logger.log(`File record ${fileRecordId} associated with task ${taskId}`);
        } catch (error) {
            this.logger.error(`Failed to update file record ${fileRecordId} with task ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * Validate file before creating task
     * @param file - The uploaded file
     * @returns boolean - Whether file is valid for processing
     */
    validateFileForTask(file: Express.Multer.File): boolean {
        if (!file) {
            this.logger.warn('No file provided for task creation');
            return false;
        }

        const validation = this.fileService.validateFile(file);
        if (!validation.isValid) {
            this.logger.warn(`File validation failed: ${validation.error}`);
            return false;
        }

        return true;
    }

    /**
     * Get task status from queue manager
     * @param taskId - The task ID
     * @returns Promise<TaskStatusInfo> - Task status information
     */
    async getTaskStatus(taskId: string) {
        try {
            return await this.queueManager.getTaskStatus(taskId);
        } catch (error) {
            this.logger.error(`Failed to get task status for ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * Get task progress from queue manager
     * @param taskId - The task ID
     * @returns Promise<ProgressInfo> - Task progress information
     */
    async getTaskProgress(taskId: string) {
        try {
            return await this.queueManager.getProgress(taskId);
        } catch (error) {
            this.logger.error(`Failed to get task progress for ${taskId}:`, error);
            throw error;
        }
    }
}
import {
    Controller,
    Get,
    Param,
    HttpStatus,
    HttpException,
    Logger
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam
} from '@nestjs/swagger';
import { QueueManagerService } from './services/queue/queue-manager.service';
import { TaskProducerService } from './services/task-producer.service';
import { TaskStatus } from './common/types/queue.types';
import { ErrorResponseDto } from './common/dto';

/**
 * Response DTO for async task status query
 */
export class TaskStatusResponse {
    taskId: string;
    status: TaskStatus;
    progress: number;
    processedRows: number;
    totalRows: number;
    currentPhase: string;
    estimatedTimeRemaining?: number;
    statistics?: any;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    errorMessage?: string;
}

@ApiTags('async-processing')
@Controller('api/data-cleaning')
export class AsyncProcessingController {
    private readonly logger = new Logger(AsyncProcessingController.name);

    constructor(
        private readonly queueManager: QueueManagerService,
        private readonly taskProducer: TaskProducerService
    ) { }

    @Get('check-status/:taskId')
    @ApiOperation({
        summary: '查询任务状态和进度',
        description: '根据任务ID查询异步处理任务的状态、进度和统计信息'
    })
    @ApiParam({
        name: 'taskId',
        description: '任务ID',
        example: 'job_123456789'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回任务状态和进度信息',
        schema: {
            type: 'object',
            properties: {
                taskId: { type: 'string', description: '任务ID' },
                status: {
                    type: 'string',
                    enum: ['pending', 'processing', 'completed', 'failed', 'timeout'],
                    description: '任务状态'
                },
                progress: { type: 'number', description: '进度百分比 (0-100)' },
                processedRows: { type: 'number', description: '已处理行数' },
                totalRows: { type: 'number', description: '总行数' },
                currentPhase: { type: 'string', description: '当前处理阶段' },
                estimatedTimeRemaining: { type: 'number', description: '预估剩余时间(毫秒)' },
                statistics: { type: 'object', description: '处理统计信息' },
                createdAt: { type: 'string', format: 'date-time', description: '创建时间' },
                startedAt: { type: 'string', format: 'date-time', description: '开始时间' },
                completedAt: { type: 'string', format: 'date-time', description: '完成时间' },
                errorMessage: { type: 'string', description: '错误消息' }
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '任务不存在',
        type: ErrorResponseDto
    })
    async checkStatus(@Param('taskId') taskId: string): Promise<TaskStatusResponse> {
        this.logger.log(`查询任务状态: ${taskId}`);

        try {
            // Get task status from queue manager
            const statusInfo = await this.queueManager.getTaskStatus(taskId);
            const progressInfo = await this.queueManager.getProgress(taskId);

            const response: TaskStatusResponse = {
                taskId,
                status: statusInfo.status,
                progress: progressInfo.progress,
                processedRows: progressInfo.processedRows,
                totalRows: progressInfo.totalRows,
                currentPhase: progressInfo.currentPhase,
                estimatedTimeRemaining: progressInfo.estimatedTimeRemaining,
                statistics: statusInfo.statistics,
                createdAt: statusInfo.createdAt,
                startedAt: statusInfo.startedAt,
                completedAt: statusInfo.completedAt,
                errorMessage: statusInfo.errorMessage
            };

            this.logger.log(`任务 ${taskId} 状态查询成功: ${statusInfo.status}, 进度: ${progressInfo.progress}%`);
            return response;

        } catch (error) {
            this.logger.error(`查询任务状态失败: ${error.message}`, error.stack);

            if (error.message.includes('not found')) {
                throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
            }

            throw new HttpException(
                'Failed to get task status',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
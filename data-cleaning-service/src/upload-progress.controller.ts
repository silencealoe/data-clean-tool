/**
 * 文件上传进度查询控制器
 */

import {
    Controller,
    Get,
    Param,
    HttpStatus,
    HttpException,
    Logger,
    Sse,
    MessageEvent,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
} from '@nestjs/swagger';
import { Observable, interval, map, filter } from 'rxjs';
import { UploadProgressService, UploadProgress } from './services/upload-progress.service';
import { ErrorResponseDto } from './common/dto';

/**
 * 上传进度响应DTO
 */
export class UploadProgressResponseDto {
    uploadId: string;
    fileName: string;
    totalSize: number;
    uploadedSize: number;
    progress: number;
    speed: number;
    status: 'uploading' | 'completed' | 'failed';
    estimatedTimeRemaining?: number;
}

@ApiTags('upload-progress')
@Controller('api/upload-progress')
export class UploadProgressController {
    private readonly logger = new Logger(UploadProgressController.name);

    constructor(private readonly uploadProgressService: UploadProgressService) { }

    @Get(':uploadId')
    @ApiOperation({
        summary: '查询上传进度',
        description: '根据上传ID查询文件上传的实时进度信息'
    })
    @ApiParam({
        name: 'uploadId',
        description: '上传ID',
        example: 'upload_123456789'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回上传进度信息',
        schema: {
            type: 'object',
            properties: {
                uploadId: { type: 'string', description: '上传ID' },
                fileName: { type: 'string', description: '文件名' },
                totalSize: { type: 'number', description: '文件总大小(字节)' },
                uploadedSize: { type: 'number', description: '已上传大小(字节)' },
                progress: { type: 'number', description: '上传进度百分比(0-100)' },
                speed: { type: 'number', description: '上传速度(字节/秒)' },
                status: {
                    type: 'string',
                    enum: ['uploading', 'completed', 'failed'],
                    description: '上传状态'
                },
                estimatedTimeRemaining: { type: 'number', description: '预估剩余时间(秒)' }
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '上传记录不存在',
        type: ErrorResponseDto
    })
    async getUploadProgress(@Param('uploadId') uploadId: string): Promise<UploadProgressResponseDto> {
        this.logger.log(`查询上传进度: ${uploadId}`);

        try {
            const progress = this.uploadProgressService.getProgress(uploadId);

            if (!progress) {
                throw new HttpException('Upload not found', HttpStatus.NOT_FOUND);
            }

            // 计算预估剩余时间
            let estimatedTimeRemaining: number | undefined;
            if (progress.status === 'uploading' && progress.speed > 0) {
                const remainingBytes = progress.totalSize - progress.uploadedSize;
                estimatedTimeRemaining = Math.ceil(remainingBytes / progress.speed);
            }

            const response: UploadProgressResponseDto = {
                uploadId: progress.uploadId,
                fileName: progress.fileName,
                totalSize: progress.totalSize,
                uploadedSize: progress.uploadedSize,
                progress: Math.round(progress.progress * 100) / 100, // 保留2位小数
                speed: Math.round(progress.speed),
                status: progress.status,
                estimatedTimeRemaining,
            };

            return response;

        } catch (error) {
            this.logger.error(`查询上传进度失败: ${error.message}`, error.stack);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                'Failed to get upload progress',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('active/all')
    @ApiOperation({
        summary: '查询所有活跃上传',
        description: '获取当前所有正在进行的文件上传进度'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回所有活跃上传列表',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    uploadId: { type: 'string' },
                    fileName: { type: 'string' },
                    progress: { type: 'number' },
                    status: { type: 'string' }
                }
            }
        }
    })
    async getAllActiveUploads(): Promise<UploadProgressResponseDto[]> {
        this.logger.log('查询所有活跃上传');

        try {
            const activeUploads = this.uploadProgressService.getAllActiveUploads();

            return activeUploads.map(progress => ({
                uploadId: progress.uploadId,
                fileName: progress.fileName,
                totalSize: progress.totalSize,
                uploadedSize: progress.uploadedSize,
                progress: Math.round(progress.progress * 100) / 100,
                speed: Math.round(progress.speed),
                status: progress.status,
            }));

        } catch (error) {
            this.logger.error(`查询活跃上传失败: ${error.message}`, error.stack);
            throw new HttpException(
                'Failed to get active uploads',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Sse('stream/:uploadId')
    @ApiOperation({
        summary: '实时上传进度流',
        description: '通过Server-Sent Events实时推送上传进度更新'
    })
    @ApiParam({
        name: 'uploadId',
        description: '上传ID',
        example: 'upload_123456789'
    })
    streamUploadProgress(@Param('uploadId') uploadId: string): Observable<MessageEvent> {
        this.logger.log(`开始流式推送上传进度: ${uploadId}`);

        return interval(500).pipe( // 每500ms检查一次
            map(() => {
                const progress = this.uploadProgressService.getProgress(uploadId);
                return progress;
            }),
            filter((progress): progress is UploadProgress => progress !== null),
            map((progress) => {
                // 计算预估剩余时间
                let estimatedTimeRemaining: number | undefined;
                if (progress.status === 'uploading' && progress.speed > 0) {
                    const remainingBytes = progress.totalSize - progress.uploadedSize;
                    estimatedTimeRemaining = Math.ceil(remainingBytes / progress.speed);
                }

                const data: UploadProgressResponseDto = {
                    uploadId: progress.uploadId,
                    fileName: progress.fileName,
                    totalSize: progress.totalSize,
                    uploadedSize: progress.uploadedSize,
                    progress: Math.round(progress.progress * 100) / 100,
                    speed: Math.round(progress.speed),
                    status: progress.status,
                    estimatedTimeRemaining,
                };

                return {
                    data: JSON.stringify(data),
                    type: 'progress',
                } as MessageEvent;
            })
        );
    }
}
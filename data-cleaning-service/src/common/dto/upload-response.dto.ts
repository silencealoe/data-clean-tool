import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for file upload
 */
export class UploadResponseDto {
    @ApiProperty({
        description: '任务ID，用于后续查询处理状态',
        example: 'job_123456789'
    })
    jobId: string;

    @ApiPropertyOptional({
        description: '任务ID的别名，与jobId相同，用于异步处理状态查询',
        example: 'job_123456789'
    })
    taskId?: string;

    @ApiProperty({
        description: '文件ID，用于文件管理',
        example: 'file_987654321'
    })
    fileId: string;

    @ApiProperty({
        description: '响应消息',
        example: '文件上传成功，开始处理'
    })
    message: string;

    @ApiProperty({
        description: '文件总行数',
        example: 1000
    })
    totalRows: number;

    @ApiPropertyOptional({
        description: '处理状态',
        enum: ['pending', 'processing', 'completed', 'failed'],
        example: 'pending'
    })
    status?: string;
}

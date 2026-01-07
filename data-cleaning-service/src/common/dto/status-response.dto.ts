import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Statistics } from '../types';

/**
 * Response DTO for status query
 */
export class StatusResponseDto {
    @ApiProperty({
        description: '任务ID',
        example: 'job_123456789'
    })
    jobId: string;

    @ApiProperty({
        description: '处理状态',
        enum: ['processing', 'completed', 'failed'],
        example: 'completed'
    })
    status: 'processing' | 'completed' | 'failed';

    @ApiProperty({
        description: '处理进度百分比',
        minimum: 0,
        maximum: 100,
        example: 100
    })
    progress: number;

    @ApiPropertyOptional({
        description: '处理统计信息（仅在完成时提供）',
        type: 'object',
        properties: {
            totalRows: { type: 'number', description: '总行数' },
            cleanedRows: { type: 'number', description: '清洗成功行数' },
            exceptionRows: { type: 'number', description: '异常行数' },
            processingTime: { type: 'number', description: '处理时间（毫秒）' }
        }
    })
    statistics?: Statistics;
}

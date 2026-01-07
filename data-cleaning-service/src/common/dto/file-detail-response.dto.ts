import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Statistics } from '../types';

/**
 * Response DTO for file detail
 */
export class FileDetailResponseDto {
    @ApiProperty({
        description: '文件详细信息',
        type: 'object',
        properties: {
            id: { type: 'string', description: '文件ID' },
            jobId: { type: 'string', description: '任务ID' },
            originalFileName: { type: 'string', description: '原始文件名' },
            fileSize: { type: 'number', description: '文件大小（字节）' },
            fileType: { type: 'string', description: '文件类型' },
            mimeType: { type: 'string', description: 'MIME类型' },
            status: { type: 'string', description: '处理状态' },
            uploadedAt: { type: 'string', format: 'date-time', description: '上传时间' },
            completedAt: { type: 'string', format: 'date-time', description: '完成时间', nullable: true },
            totalRows: { type: 'number', description: '总行数', nullable: true },
            cleanedRows: { type: 'number', description: '清洗成功行数', nullable: true },
            exceptionRows: { type: 'number', description: '异常行数', nullable: true },
            processingTime: { type: 'number', description: '处理时间（毫秒）', nullable: true },
            errorMessage: { type: 'string', description: '错误信息', nullable: true }
        }
    })
    file: any;

    @ApiPropertyOptional({
        description: '处理统计信息',
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
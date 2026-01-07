import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Error response DTO
 */
export class ErrorResponseDto {
    @ApiProperty({
        description: 'HTTP状态码',
        example: 400
    })
    statusCode: number;

    @ApiProperty({
        description: '错误代码',
        example: 'UNSUPPORTED_FILE_TYPE'
    })
    errorCode: string;

    @ApiProperty({
        description: '错误消息',
        example: '不支持的文件类型，请上传Excel文件'
    })
    message: string;

    @ApiPropertyOptional({
        description: '详细错误信息',
        example: { field: 'file', reason: 'Invalid MIME type' }
    })
    details?: any;

    @ApiProperty({
        description: '时间戳',
        example: '2024-01-15T10:30:00.000Z'
    })
    timestamp: string;
}
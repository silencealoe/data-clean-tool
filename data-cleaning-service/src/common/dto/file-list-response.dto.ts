import { ApiProperty } from '@nestjs/swagger';

/**
 * File record for list response
 */
export class FileRecordDto {
    @ApiProperty({
        description: '文件ID',
        example: 'file_987654321'
    })
    id: string;

    @ApiProperty({
        description: '任务ID',
        example: 'job_123456789'
    })
    jobId: string;

    @ApiProperty({
        description: '原始文件名',
        example: 'customer_data.xlsx'
    })
    originalFileName: string;

    @ApiProperty({
        description: '文件大小（字节）',
        example: 1048576
    })
    fileSize: number;

    @ApiProperty({
        description: '文件类型',
        example: 'xlsx'
    })
    fileType: string;

    @ApiProperty({
        description: '处理状态',
        enum: ['pending', 'processing', 'completed', 'failed'],
        example: 'completed'
    })
    status: string;

    @ApiProperty({
        description: '上传时间',
        example: '2024-01-15T10:30:00.000Z'
    })
    uploadedAt: Date;

    @ApiProperty({
        description: '完成时间',
        example: '2024-01-15T10:35:00.000Z',
        nullable: true
    })
    completedAt: Date | null;

    @ApiProperty({
        description: '总行数',
        example: 1000,
        nullable: true
    })
    totalRows: number | null;

    @ApiProperty({
        description: '清洗成功行数',
        example: 950,
        nullable: true
    })
    cleanedRows: number | null;

    @ApiProperty({
        description: '异常行数',
        example: 50,
        nullable: true
    })
    exceptionRows: number | null;
}

/**
 * Response DTO for file list
 */
export class FileListResponseDto {
    @ApiProperty({
        description: '文件记录列表',
        type: [FileRecordDto]
    })
    files: FileRecordDto[];

    @ApiProperty({
        description: '总记录数',
        example: 100
    })
    total: number;

    @ApiProperty({
        description: '当前页码',
        example: 1
    })
    page: number;

    @ApiProperty({
        description: '每页数量',
        example: 10
    })
    pageSize: number;
}
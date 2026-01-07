import { IsOptional, IsInt, Min, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FileStatus } from '../types';

/**
 * DTO for listing files with filters
 */
export class ListFilesDto {
    @ApiPropertyOptional({
        description: '页码',
        minimum: 1,
        default: 1,
        example: 1
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({
        description: '每页数量',
        minimum: 1,
        default: 10,
        example: 10
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    pageSize?: number = 10;

    @ApiPropertyOptional({
        description: '文件状态筛选',
        enum: FileStatus,
        example: FileStatus.COMPLETED
    })
    @IsOptional()
    @IsEnum(FileStatus)
    status?: FileStatus;

    @ApiPropertyOptional({
        description: '开始日期（ISO格式）',
        example: '2024-01-01T00:00:00.000Z'
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({
        description: '结束日期（ISO格式）',
        example: '2024-12-31T23:59:59.999Z'
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;
}

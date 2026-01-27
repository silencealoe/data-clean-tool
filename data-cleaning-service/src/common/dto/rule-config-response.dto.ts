import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, ValidateNested, IsNumber, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { RuleConfiguration, ValidationResult } from '../types/rule-engine.types';

/**
 * Response DTO for rule configuration operations
 */
export class RuleConfigResponseDto {
    @ApiProperty({
        description: '操作是否成功',
        example: true
    })
    success: boolean;

    @ApiPropertyOptional({
        description: '规则配置数据',
        type: 'object',
        additionalProperties: true
    })
    configuration?: RuleConfiguration;

    @ApiPropertyOptional({
        description: '操作消息',
        example: '配置更新成功'
    })
    message?: string;

    @ApiPropertyOptional({
        description: '错误信息',
        example: '配置验证失败'
    })
    error?: string;

    @ApiPropertyOptional({
        description: '操作元数据',
        type: 'object',
        additionalProperties: true
    })
    metadata?: Record<string, any>;
}

/**
 * Response DTO for configuration history
 */
export class ConfigHistoryResponseDto {
    @ApiProperty({
        description: '历史配置列表',
        type: 'array',
        items: { type: 'object' }
    })
    history: RuleConfiguration[];

    @ApiProperty({
        description: '历史记录总数',
        example: 5
    })
    total: number;
}

/**
 * Response DTO for configuration statistics
 */
export class ConfigStatsResponseDto {
    @ApiProperty({
        description: '当前配置版本',
        example: '1.0.0'
    })
    currentVersion: string;

    @ApiProperty({
        description: '历史记录数量',
        example: 5
    })
    historySize: number;

    @ApiProperty({
        description: '配置字段总数',
        example: 10
    })
    totalFields: number;

    @ApiProperty({
        description: '规则总数',
        example: 25
    })
    totalRules: number;

    @ApiPropertyOptional({
        description: '最后更新时间',
        example: '2024-01-01T00:00:00.000Z'
    })
    lastUpdated?: string;

    @ApiProperty({
        description: '是否已初始化',
        example: true
    })
    isInitialized: boolean;
}

/**
 * Rule Metadata DTO
 */
export class RuleMetadataDto {
    @ApiProperty({ description: '配置名称' })
    @IsString()
    name: string;

    @ApiProperty({ description: '配置描述' })
    @IsString()
    description: string;

    @ApiProperty({ description: '配置版本' })
    @IsString()
    version: string;

    @ApiProperty({ description: '优先级' })
    @IsNumber()
    priority: number;

    @ApiPropertyOptional({ description: '配置作者' })
    @IsOptional()
    @IsString()
    author?: string;

    @ApiPropertyOptional({ description: '创建时间' })
    @IsOptional()
    @IsString()
    createdAt?: string;

    @ApiPropertyOptional({ description: '更新时间' })
    @IsOptional()
    @IsString()
    updatedAt?: string;
}

/**
 * Field Rule DTO
 */
export class FieldRuleDto {
    @ApiProperty({ description: '规则名称' })
    @IsString()
    name: string;

    @ApiProperty({ description: '验证策略' })
    @IsString()
    strategy: string;

    @ApiProperty({
        description: '规则参数',
        type: 'object',
        additionalProperties: true
    })
    @IsObject()
    params: Record<string, any>;

    @ApiProperty({ description: '是否必填' })
    @IsBoolean()
    required: boolean;

    @ApiPropertyOptional({ description: '规则优先级' })
    @IsOptional()
    @IsNumber()
    priority?: number;

    @ApiPropertyOptional({ description: '错误消息' })
    @IsOptional()
    @IsString()
    errorMessage?: string;
}

/**
 * Global Settings DTO
 */
export class GlobalSettingsDto {
    @ApiProperty({ description: '严格模式' })
    @IsBoolean()
    strictMode: boolean;

    @ApiProperty({ description: '错误时继续' })
    @IsBoolean()
    continueOnError: boolean;

    @ApiProperty({ description: '最大错误数' })
    @IsNumber()
    maxErrors: number;

    @ApiPropertyOptional({ description: '启用缓存' })
    @IsOptional()
    @IsBoolean()
    enableCaching?: boolean;

    @ApiPropertyOptional({ description: '缓存超时' })
    @IsOptional()
    @IsNumber()
    cacheTimeout?: number;

    @ApiPropertyOptional({ description: '并行处理' })
    @IsOptional()
    @IsBoolean()
    parallelProcessing?: boolean;

    @ApiPropertyOptional({ description: '最大并行任务数' })
    @IsOptional()
    @IsNumber()
    maxParallelTasks?: number;

    @ApiPropertyOptional({ description: '日志级别' })
    @IsOptional()
    @IsString()
    logLevel?: string;

    @ApiPropertyOptional({ description: '启用性能监控' })
    @IsOptional()
    @IsBoolean()
    enablePerformanceMonitoring?: boolean;
}

/**
 * Rule Configuration DTO
 */
export class RuleConfigurationDto {
    @ApiProperty({ description: '规则元数据', type: RuleMetadataDto })
    @ValidateNested()
    @Type(() => RuleMetadataDto)
    metadata: RuleMetadataDto;

    @ApiProperty({
        description: '字段规则映射',
        type: 'object',
        additionalProperties: {
            type: 'array',
            items: { $ref: '#/components/schemas/FieldRuleDto' }
        }
    })
    @IsObject()
    fieldRules: Record<string, FieldRuleDto[]>;

    @ApiProperty({ description: '全局设置', type: GlobalSettingsDto })
    @ValidateNested()
    @Type(() => GlobalSettingsDto)
    globalSettings: GlobalSettingsDto;
}

/**
 * Request DTO for configuration update
 */
export class UpdateConfigRequestDto {
    @ApiProperty({
        description: '规则配置',
        type: RuleConfigurationDto
    })
    @ValidateNested()
    @Type(() => RuleConfigurationDto)
    configuration: RuleConfigurationDto;

    @ApiPropertyOptional({
        description: '更新描述',
        example: '更新手机号验证规则'
    })
    @IsOptional()
    @IsString()
    description?: string;
}

/**
 * Request DTO for configuration rollback
 */
export class RollbackConfigRequestDto {
    @ApiPropertyOptional({
        description: '要回滚到的版本号，不提供则回滚到上一版本',
        example: '1.0.0'
    })
    @IsOptional()
    @IsString()
    version?: string;

    @ApiPropertyOptional({
        description: '回滚原因',
        example: '新配置导致验证错误'
    })
    @IsOptional()
    @IsString()
    reason?: string;
}
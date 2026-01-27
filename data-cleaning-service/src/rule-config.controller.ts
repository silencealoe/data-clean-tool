import {
    Controller,
    Get,
    Post,
    Put,
    Body,
    Param,
    Query,
    HttpStatus,
    HttpException,
    Logger,
    UseGuards,
    ValidationPipe
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiBody,
    ApiBearerAuth
} from '@nestjs/swagger';
import {
    RuleConfigResponseDto,
    ConfigHistoryResponseDto,
    ConfigStatsResponseDto,
    UpdateConfigRequestDto,
    RuleConfigurationDto,
    RollbackConfigRequestDto,
    ErrorResponseDto
} from './common/dto';
import { ConfigurationManagerService } from './services/rule-engine/configuration-manager.service';
import { RuleConfiguration, ValidationResult } from './common/types/rule-engine.types';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('rule-configuration')
@Controller('api/rule-config')
export class RuleConfigController {
    private readonly logger = new Logger(RuleConfigController.name);

    constructor(
        private readonly configurationManager: ConfigurationManagerService
    ) { }

    @Get('current')
    @ApiOperation({
        summary: '获取当前规则配置',
        description: '获取当前生效的规则配置，包含所有字段规则和全局设置'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回当前配置',
        type: RuleConfigResponseDto
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '获取配置失败',
        type: ErrorResponseDto
    })
    async getCurrentConfiguration(): Promise<RuleConfigResponseDto> {
        this.logger.log('获取当前规则配置');

        try {
            // Ensure configuration manager is initialized
            await this.configurationManager.initialize();

            let configuration: RuleConfiguration;
            let isDefaultConfig = false;

            try {
                configuration = this.configurationManager.getCurrentConfiguration();
            } catch (error) {
                this.logger.warn('无法获取当前配置，使用默认配置:', error.message);
                // Load default configuration from file
                configuration = await this.loadDefaultConfiguration();
                isDefaultConfig = true;
            }

            return {
                success: true,
                configuration,
                message: isDefaultConfig ? '成功获取默认配置' : '成功获取当前配置',
                metadata: {
                    timestamp: new Date().toISOString(),
                    version: configuration.metadata.version,
                    isDefault: isDefaultConfig,
                    source: isDefaultConfig ? 'default-rules.json' : 'configuration-manager'
                }
            };

        } catch (error) {
            this.logger.error('获取当前配置失败:', error.message, error.stack);
            throw new HttpException(
                `Failed to get current configuration: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Put('update')
    @ApiOperation({
        summary: '更新规则配置',
        description: '更新规则配置并进行验证，支持热重载'
    })
    @ApiBody({
        description: '配置更新请求',
        type: UpdateConfigRequestDto
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '配置更新成功',
        type: RuleConfigResponseDto
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '配置验证失败',
        type: ErrorResponseDto
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '配置更新失败',
        type: ErrorResponseDto
    })
    async updateConfiguration(
        @Body(ValidationPipe) request: UpdateConfigRequestDto
    ): Promise<RuleConfigResponseDto> {
        this.logger.log(`更新规则配置: ${request.configuration.metadata.name} v${request.configuration.metadata.version}`);

        try {
            // Ensure configuration manager is initialized
            await this.configurationManager.initialize();

            // Convert DTO to internal type
            const ruleConfiguration: RuleConfiguration = {
                metadata: request.configuration.metadata,
                fieldRules: request.configuration.fieldRules,
                globalSettings: request.configuration.globalSettings
            };

            // Update configuration with validation
            const result = await this.configurationManager.updateConfiguration(ruleConfiguration);

            if (!result.success) {
                throw new HttpException(
                    result.error || 'Configuration validation failed',
                    HttpStatus.BAD_REQUEST
                );
            }

            // 立即触发配置重新加载以确保新配置生效
            try {
                await this.configurationManager.reloadConfiguration();
                this.logger.log('Configuration reloaded successfully after update');
            } catch (reloadError) {
                this.logger.warn('Failed to reload configuration after update, but update was successful:', reloadError.message);
                // 不抛出错误，因为更新本身是成功的
            }

            return {
                success: true,
                configuration: result.value,
                message: '配置更新成功，新配置已生效',
                metadata: {
                    ...result.metadata,
                    description: request.description,
                    timestamp: new Date().toISOString(),
                    reloadTriggered: true
                }
            };

        } catch (error) {
            this.logger.error('配置更新失败:', error.message, error.stack);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                `Failed to update configuration: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('reload')
    @ApiOperation({
        summary: '重新加载配置',
        description: '从配置源重新加载规则配置'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '配置重载成功',
        type: RuleConfigResponseDto
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '配置重载失败',
        type: ErrorResponseDto
    })
    async reloadConfiguration(): Promise<RuleConfigResponseDto> {
        this.logger.log('重新加载规则配置');

        try {
            // Ensure configuration manager is initialized
            await this.configurationManager.initialize();

            // Reload configuration from source
            await this.configurationManager.reloadConfiguration();

            const configuration = this.configurationManager.getCurrentConfiguration();

            return {

                success: true,
                configuration,
                message: '配置重载成功',
                metadata: {
                    timestamp: new Date().toISOString(),
                    version: configuration.metadata.version,
                    source: 'reload'
                }
            };

        } catch (error) {
            this.logger.error('配置重载失败:', error.message, error.stack);
            throw new HttpException(
                `Failed to reload configuration: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('history')
    @ApiOperation({
        summary: '获取配置历史',
        description: '获取规则配置的历史版本记录'
    })
    @ApiQuery({
        name: 'limit',
        description: '返回记录数量限制',
        required: false,
        type: Number,
        example: 10
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回配置历史',
        type: ConfigHistoryResponseDto
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '获取配置历史失败',
        type: ErrorResponseDto
    })
    async getConfigurationHistory(
        @Query('limit') limit?: string
    ): Promise<ConfigHistoryResponseDto> {
        this.logger.log(`获取配置历史，限制: ${limit || '无限制'}`);

        try {
            // Ensure configuration manager is initialized
            await this.configurationManager.initialize();

            const history = this.configurationManager.getConfigurationHistory();
            const limitNum = limit ? parseInt(limit, 10) : undefined;
            const limitedHistory = limitNum ? history.slice(0, limitNum) : history;

            return {
                history: limitedHistory,
                total: history.length
            };

        } catch (error) {
            this.logger.error('获取配置历史失败:', error.message, error.stack);
            throw new HttpException(
                `Failed to get configuration history: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('rollback')
    @ApiOperation({
        summary: '回滚配置',
        description: '回滚到指定版本或上一个版本的规则配置'
    })
    @ApiBody({
        description: '回滚配置请求',
        type: RollbackConfigRequestDto
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '配置回滚成功',
        type: RuleConfigResponseDto
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '回滚失败，版本不存在或无效',
        type: ErrorResponseDto
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '配置回滚失败',
        type: ErrorResponseDto
    })
    async rollbackConfiguration(
        @Body(ValidationPipe) request: RollbackConfigRequestDto
    ): Promise<RuleConfigResponseDto> {
        this.logger.log(`回滚配置${request.version ? ` 到版本 ${request.version}` : ' 到上一版本'}`);

        try {
            // Ensure configuration manager is initialized
            await this.configurationManager.initialize();

            // Perform rollback
            const result = await this.configurationManager.rollbackConfiguration(request.version);

            if (!result.success) {
                throw new HttpException(
                    result.error || 'Configuration rollback failed',
                    HttpStatus.BAD_REQUEST
                );
            }

            return {
                success: true,
                configuration: result.value,
                message: '配置回滚成功',
                metadata: {
                    ...result.metadata,
                    reason: request.reason,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            this.logger.error('配置回滚失败:', error.message, error.stack);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                `Failed to rollback configuration: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('stats')
    @ApiOperation({
        summary: '获取配置统计',
        description: '获取规则配置的统计信息，包括版本、字段数、规则数等'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '成功返回配置统计',
        type: ConfigStatsResponseDto
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '获取配置统计失败',
        type: ErrorResponseDto
    })
    async getConfigurationStats(): Promise<ConfigStatsResponseDto> {
        this.logger.log('获取配置统计信息');

        try {
            // Ensure configuration manager is initialized
            await this.configurationManager.initialize();

            const stats = this.configurationManager.getConfigurationStats();

            return {
                currentVersion: stats.currentVersion,
                historySize: stats.historySize,
                totalFields: stats.totalFields,
                totalRules: stats.totalRules,
                lastUpdated: stats.lastUpdated?.toISOString(),
                isInitialized: stats.isInitialized
            };

        } catch (error) {
            this.logger.error('获取配置统计失败:', error.message, error.stack);
            throw new HttpException(
                `Failed to get configuration stats: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Load default configuration from default-rules.json file
     * @returns Default rule configuration
     */
    private async loadDefaultConfiguration(): Promise<RuleConfiguration> {
        try {
            const defaultRulesPath = path.join(process.cwd(), 'src', 'config', 'rule-engine', 'default-rules.json');

            if (!fs.existsSync(defaultRulesPath)) {
                this.logger.error(`Default rules file not found at: ${defaultRulesPath}`);
                throw new Error('Default configuration file not found');
            }

            const defaultRulesContent = fs.readFileSync(defaultRulesPath, 'utf-8');
            const defaultConfig = JSON.parse(defaultRulesContent) as RuleConfiguration;

            this.logger.log('Successfully loaded default configuration from default-rules.json');
            return defaultConfig;

        } catch (error) {
            this.logger.error('Failed to load default configuration:', error.message);

            // Fallback to minimal default configuration
            return {
                metadata: {
                    name: 'minimal-default-rules',
                    description: '最小默认规则配置（文件加载失败时的回退配置）',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {},
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10,
                    enableCaching: true,
                    cacheTimeout: 3600,
                    parallelProcessing: true,
                    maxParallelTasks: 4,
                    logLevel: 'info',
                    enablePerformanceMonitoring: true
                }
            };
        }
    }
}
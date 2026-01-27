/**
 * Configuration Manager Service
 * 
 * Manages the lifecycle of rule configurations including loading, updating, validation,
 * version control, and rollback functionality. Implements requirements 4.3, 4.4, and 4.5
 * from the dynamic rule engine specification.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
    RuleConfiguration,
    ValidationResult,
    ConfigurationManager as IConfigurationManager,
    FieldRule,
    ValidationErrorType
} from '../../common/types/rule-engine.types';
import { RuleLoaderService } from './rule-loader.service';
import { ConfigValidatorService } from './config-validator.service';
import {
    CACHE_CONFIG,
    FILE_MONITORING,
    DEFAULT_RULE_TEMPLATE
} from '../../common/constants/rule-engine.constants';

/**
 * Configuration version entry for history tracking
 */
interface ConfigurationVersion {
    version: string;
    configuration: RuleConfiguration;
    timestamp: Date;
    source: string;
    checksum: string;
    description?: string;
}

/**
 * Configuration change event data
 */
interface ConfigurationChangeEvent {
    type: 'loaded' | 'updated' | 'rolled_back' | 'validation_failed';
    version: string;
    timestamp: Date;
    source: string;
    success: boolean;
    error?: string;
}

/**
 * Configuration manager service implementation
 */
@Injectable()
export class ConfigurationManagerService extends EventEmitter implements IConfigurationManager {
    private readonly logger = new Logger(ConfigurationManagerService.name);

    private currentConfiguration: RuleConfiguration | null = null;
    private configurationHistory: ConfigurationVersion[] = [];
    private readonly maxHistorySize = 50;
    private isInitialized = false;
    private initializationPromise: Promise<void> | null = null;

    constructor(
        private readonly ruleLoader: RuleLoaderService,
        private readonly configValidator: ConfigValidatorService
    ) {
        super();
        this.logger.log('ConfigurationManagerService initialized');
    }

    /**
     * Initialize the configuration manager
     * @returns Promise that resolves when initialization is complete
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.performInitialization();
        return this.initializationPromise;
    }

    /**
     * Perform the actual initialization
     */
    private async performInitialization(): Promise<void> {
        try {
            this.logger.log('Initializing configuration manager...');

            // 首先尝试加载保存的当前配置
            let config: RuleConfiguration;
            try {
                config = await this.loadSavedConfiguration();
                this.logger.log('Loaded saved configuration from current-config.json');
            } catch (error) {
                this.logger.debug('No saved configuration found, loading with fallback chain');
                // Load initial configuration with fallback chain
                config = await this.ruleLoader.loadWithFallback();
            }

            // Validate the loaded configuration
            const validationResult = await this.configValidator.validateConfiguration(config);
            if (!validationResult.success) {
                this.logger.warn('Initial configuration validation failed, using default template');
                this.currentConfiguration = this.createDefaultConfiguration();
            } else {
                this.currentConfiguration = config;
            }

            // Add to history
            this.addToHistory(this.currentConfiguration, 'initialization', 'Initial configuration load');

            this.isInitialized = true;
            this.logger.log(`Configuration manager initialized with config: ${this.currentConfiguration.metadata.name}`);

            // Emit initialization event
            this.emitConfigurationChange({
                type: 'loaded',
                version: this.currentConfiguration.metadata.version,
                timestamp: new Date(),
                source: 'initialization',
                success: true
            });

        } catch (error) {
            this.logger.error('Failed to initialize configuration manager:', error);

            // Fallback to default configuration
            this.currentConfiguration = this.createDefaultConfiguration();
            this.addToHistory(this.currentConfiguration, 'fallback', 'Fallback to default configuration');

            this.isInitialized = true;

            this.emitConfigurationChange({
                type: 'loaded',
                version: this.currentConfiguration.metadata.version,
                timestamp: new Date(),
                source: 'fallback',
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get field rules for a specific field
     * @param fieldName Field name to get rules for
     * @returns Array of field rules
     */
    getFieldRules(fieldName: string): FieldRule[] {
        this.ensureInitialized();

        if (!this.currentConfiguration) {
            this.logger.warn('No current configuration available, returning empty rules');
            return [];
        }

        const rules = this.currentConfiguration.fieldRules[fieldName] || [];

        // Sort rules by priority (higher priority first)
        return rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }

    /**
     * Get current rule configuration
     * @returns Current rule configuration
     */
    getCurrentConfiguration(): RuleConfiguration {
        this.ensureInitialized();

        if (!this.currentConfiguration) {
            this.logger.warn('No current configuration available, returning default template');
            return this.createDefaultConfiguration();
        }

        // Return a deep copy to prevent external modifications
        return JSON.parse(JSON.stringify(this.currentConfiguration));
    }

    /**
     * Reload configuration from source
     * @returns Promise that resolves when reload is complete
     */
    async reloadConfiguration(): Promise<void> {
        try {
            this.logger.log('Reloading configuration from source...');

            // Load configuration with fallback chain
            const newConfig = await this.ruleLoader.loadWithFallback();

            // Validate the new configuration
            const validationResult = await this.configValidator.validateConfiguration(newConfig);
            if (!validationResult.success) {
                const errorMessage = `Configuration validation failed: ${validationResult.error}`;
                this.logger.error(errorMessage);

                this.emitConfigurationChange({
                    type: 'validation_failed',
                    version: newConfig.metadata?.version || 'unknown',
                    timestamp: new Date(),
                    source: 'reload',
                    success: false,
                    error: errorMessage
                });

                throw new Error(errorMessage);
            }

            // Check if configuration actually changed
            if (this.currentConfiguration && this.calculateChecksum(newConfig) === this.calculateChecksum(this.currentConfiguration)) {
                this.logger.debug('Configuration unchanged, skipping reload');
                return;
            }

            // Update current configuration
            const previousConfig = this.currentConfiguration;
            this.currentConfiguration = newConfig;

            // Add to history
            this.addToHistory(newConfig, 'reload', 'Configuration reloaded from source');

            // Clear rule loader cache to ensure fresh data
            this.ruleLoader.clearCache();

            this.logger.log(`Configuration reloaded successfully: ${newConfig.metadata.name} v${newConfig.metadata.version}`);

            this.emitConfigurationChange({
                type: 'loaded',
                version: newConfig.metadata.version,
                timestamp: new Date(),
                source: 'reload',
                success: true
            });

        } catch (error) {
            this.logger.error('Failed to reload configuration:', error);
            throw error;
        }
    }

    /**
     * Update configuration with validation
     * @param config New configuration to apply
     * @returns Validation result
     */
    async updateConfiguration(config: RuleConfiguration): Promise<ValidationResult> {
        try {
            this.logger.log(`Updating configuration: ${config.metadata.name} v${config.metadata.version}`);

            // Validate the new configuration
            const validationResult = await this.configValidator.validateConfiguration(config);
            if (!validationResult.success) {
                this.logger.warn('Configuration validation failed during update:', validationResult.error);

                this.emitConfigurationChange({
                    type: 'validation_failed',
                    version: config.metadata.version,
                    timestamp: new Date(),
                    source: 'update',
                    success: false,
                    error: validationResult.error
                });

                return validationResult;
            }

            // Check if configuration actually changed
            // Temporarily disable this check to allow all updates
            // TODO: Investigate why checksum comparison is preventing valid updates
            const configChanged = true; // this.currentConfiguration ? this.calculateChecksum(config) !== this.calculateChecksum(this.currentConfiguration) : true;

            if (!configChanged && this.currentConfiguration) {
                this.logger.debug('Configuration unchanged, skipping update');
                this.logger.debug(`Current config checksum: ${this.calculateChecksum(this.currentConfiguration)}`);
                this.logger.debug(`New config checksum: ${this.calculateChecksum(config)}`);
                this.logger.debug(`Current config version: ${this.currentConfiguration.metadata.version}`);
                this.logger.debug(`New config version: ${config.metadata.version}`);
                return {
                    success: true,
                    value: config,
                    metadata: { message: 'Configuration unchanged' }
                };
            }

            // Store previous configuration for potential rollback
            const previousConfig = this.currentConfiguration;

            // Apply the new configuration
            this.currentConfiguration = config;

            // Add to history
            this.addToHistory(config, 'update', 'Configuration updated via API');

            // Update the rule loader's current configuration
            this.ruleLoader.setCurrentConfiguration(config);

            // 清除规则缓存以确保使用新配置
            this.ruleLoader.clearCache();

            // 保存配置到文件系统（新增功能）
            try {
                await this.saveConfigurationToFile(config);
                this.logger.log('Configuration saved to file system successfully');
            } catch (saveError) {
                this.logger.warn('Failed to save configuration to file system:', saveError.message);
                // 不抛出错误，因为内存更新已经成功
            }

            this.logger.log(`Configuration updated successfully: ${config.metadata.name} v${config.metadata.version}`);

            this.emitConfigurationChange({
                type: 'updated',
                version: config.metadata.version,
                timestamp: new Date(),
                source: 'update',
                success: true
            });

            // 触发自动重新加载通知
            this.notifyConfigurationReload();

            return {
                success: true,
                value: config,
                metadata: {
                    previousVersion: previousConfig?.metadata.version,
                    newVersion: config.metadata.version,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            this.logger.error('Failed to update configuration:', error);

            this.emitConfigurationChange({
                type: 'validation_failed',
                version: config.metadata?.version || 'unknown',
                timestamp: new Date(),
                source: 'update',
                success: false,
                error: error.message
            });

            return {
                success: false,
                error: `Configuration update failed: ${error.message}`,
                errorCode: ValidationErrorType.CONFIGURATION_ERROR
            };
        }
    }

    /**
     * 通知配置重新加载
     * 发送事件通知所有监听器配置已更新
     */
    private notifyConfigurationReload(): void {
        this.logger.log('Notifying configuration reload to all listeners');
        this.emit('configurationReloaded', {
            timestamp: new Date(),
            configuration: this.currentConfiguration
        });
    }

    /**
     * Get configuration history
     * @returns Array of historical configurations
     */
    getConfigurationHistory(): RuleConfiguration[] {
        return this.configurationHistory
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .map(entry => entry.configuration);
    }

    /**
     * Get detailed configuration history with metadata
     * @returns Array of configuration version entries
     */
    getDetailedConfigurationHistory(): ConfigurationVersion[] {
        return [...this.configurationHistory]
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    /**
     * Rollback to previous configuration
     * @param version Optional specific version to rollback to
     * @returns Validation result of rollback operation
     */
    async rollbackConfiguration(version?: string): Promise<ValidationResult> {
        try {
            this.logger.log(`Rolling back configuration${version ? ` to version ${version}` : ' to previous version'}`);

            if (this.configurationHistory.length === 0) {
                const errorMessage = 'No configuration history available for rollback';
                this.logger.error(errorMessage);
                return {
                    success: false,
                    error: errorMessage,
                    errorCode: ValidationErrorType.CONFIGURATION_ERROR
                };
            }

            let targetConfig: ConfigurationVersion | undefined;

            if (version) {
                // Find specific version
                targetConfig = this.configurationHistory.find(entry => entry.version === version);
                if (!targetConfig) {
                    const errorMessage = `Configuration version ${version} not found in history`;
                    this.logger.error(errorMessage);
                    return {
                        success: false,
                        error: errorMessage,
                        errorCode: ValidationErrorType.CONFIGURATION_ERROR
                    };
                }
            } else {
                // Get the most recent version (excluding current if it's in history)
                const sortedHistory = this.configurationHistory
                    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

                // Skip the current configuration if it's the most recent in history
                const currentChecksum = this.currentConfiguration ? this.calculateChecksum(this.currentConfiguration) : null;
                targetConfig = sortedHistory.find(entry => entry.checksum !== currentChecksum);

                if (!targetConfig) {
                    const errorMessage = 'No previous configuration available for rollback';
                    this.logger.error(errorMessage);
                    return {
                        success: false,
                        error: errorMessage,
                        errorCode: ValidationErrorType.CONFIGURATION_ERROR
                    };
                }
            }

            // Validate the target configuration before rollback
            const validationResult = await this.configValidator.validateConfiguration(targetConfig.configuration);
            if (!validationResult.success) {
                const errorMessage = `Target configuration validation failed: ${validationResult.error}`;
                this.logger.error(errorMessage);
                return {
                    success: false,
                    error: errorMessage,
                    errorCode: ValidationErrorType.CONFIGURATION_ERROR
                };
            }

            // Store current configuration for history
            const previousConfig = this.currentConfiguration;

            // Apply the rollback
            this.currentConfiguration = targetConfig.configuration;

            // Add rollback entry to history
            this.addToHistory(
                targetConfig.configuration,
                'rollback',
                `Rolled back to version ${targetConfig.version} from ${targetConfig.timestamp.toISOString()}`
            );

            // Update the rule loader's current configuration
            this.ruleLoader.setCurrentConfiguration(targetConfig.configuration);

            this.logger.log(`Configuration rolled back successfully to version ${targetConfig.version}`);

            this.emitConfigurationChange({
                type: 'rolled_back',
                version: targetConfig.version,
                timestamp: new Date(),
                source: 'rollback',
                success: true
            });

            return {
                success: true,
                value: targetConfig.configuration,
                metadata: {
                    rolledBackFrom: previousConfig?.metadata.version,
                    rolledBackTo: targetConfig.version,
                    rollbackTimestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            this.logger.error('Failed to rollback configuration:', error);
            return {
                success: false,
                error: `Configuration rollback failed: ${error.message}`,
                errorCode: ValidationErrorType.CONFIGURATION_ERROR
            };
        }
    }

    /**
     * Get configuration statistics
     * @returns Configuration statistics object
     */
    getConfigurationStats(): {
        currentVersion: string;
        historySize: number;
        totalFields: number;
        totalRules: number;
        lastUpdated: Date | null;
        isInitialized: boolean;
    } {
        const currentConfig = this.currentConfiguration;
        const totalRules = currentConfig ?
            Object.values(currentConfig.fieldRules).reduce((sum, rules) => sum + rules.length, 0) : 0;

        const lastHistoryEntry = this.configurationHistory
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

        return {
            currentVersion: currentConfig?.metadata.version || 'none',
            historySize: this.configurationHistory.length,
            totalFields: currentConfig ? Object.keys(currentConfig.fieldRules).length : 0,
            totalRules,
            lastUpdated: lastHistoryEntry?.timestamp || null,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Clear configuration history
     * @param keepRecent Number of recent entries to keep (default: 5)
     */
    clearConfigurationHistory(keepRecent: number = 5): void {
        if (this.configurationHistory.length <= keepRecent) {
            this.logger.debug('Configuration history is already within the keep limit');
            return;
        }

        const sortedHistory = this.configurationHistory
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        this.configurationHistory = sortedHistory.slice(0, keepRecent);

        this.logger.log(`Configuration history cleared, kept ${keepRecent} recent entries`);
    }

    /**
     * Ensure the configuration manager is initialized
     */
    private ensureInitialized(): void {
        if (!this.isInitialized) {
            throw new Error('Configuration manager not initialized. Call initialize() first.');
        }
    }

    /**
     * Add configuration to history
     * @param config Configuration to add
     * @param source Source of the configuration change
     * @param description Optional description
     */
    private addToHistory(config: RuleConfiguration, source: string, description?: string): void {
        const checksum = this.calculateChecksum(config);

        // Don't add duplicate configurations
        if (this.configurationHistory.some(entry => entry.checksum === checksum)) {
            this.logger.debug('Configuration already exists in history, skipping');
            return;
        }

        const historyEntry: ConfigurationVersion = {
            version: config.metadata.version,
            configuration: JSON.parse(JSON.stringify(config)), // Deep copy
            timestamp: new Date(),
            source,
            checksum,
            description
        };

        this.configurationHistory.push(historyEntry);

        // Maintain history size limit
        if (this.configurationHistory.length > this.maxHistorySize) {
            const removed = this.configurationHistory.shift();
            this.logger.debug(`Removed oldest configuration from history: ${removed?.version}`);
        }

        this.logger.debug(`Added configuration to history: ${config.metadata.name} v${config.metadata.version}`);
    }

    /**
     * Calculate checksum for configuration
     * @param config Configuration to calculate checksum for
     * @returns Checksum string
     */
    private calculateChecksum(config: RuleConfiguration): string {
        // Simple checksum based on JSON string
        const configString = JSON.stringify(config, Object.keys(config).sort());
        let hash = 0;
        for (let i = 0; i < configString.length; i++) {
            const char = configString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }

    /**
     * Create default configuration
     * @returns Default rule configuration
     */
    private createDefaultConfiguration(): RuleConfiguration {
        return {
            ...DEFAULT_RULE_TEMPLATE,
            metadata: {
                ...DEFAULT_RULE_TEMPLATE.metadata,
                name: 'default-fallback-rules',
                description: '默认回退规则配置（配置管理器生成）',
                version: `1.0.0-${Date.now()}`
            }
        };
    }

    /**
     * Emit configuration change event
     * @param event Configuration change event data
     */
    private emitConfigurationChange(event: ConfigurationChangeEvent): void {
        this.emit('configurationChanged', event);
        this.logger.debug(`Configuration change event emitted: ${event.type} - ${event.version}`);
    }

    /**
     * Get event emitter for configuration changes
     * @returns Event emitter instance
     */
    getEventEmitter(): EventEmitter {
        return this;
    }

    /**
     * Load saved configuration from file system
     * @returns Saved configuration
     */
    private async loadSavedConfiguration(): Promise<RuleConfiguration> {
        const fs = await import('fs').then(m => m.promises);
        const path = await import('path');

        const configPath = path.join(process.cwd(), 'current-config.json');

        try {
            await fs.access(configPath);
            const configContent = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configContent) as RuleConfiguration;

            // 验证配置
            const validationResult = await this.configValidator.validateConfiguration(config);
            if (!validationResult.success) {
                throw new Error(`Saved configuration validation failed: ${validationResult.error}`);
            }

            return config;
        } catch (error) {
            this.logger.debug(`Failed to load saved configuration: ${error.message}`);
            throw error;
        }
    }

    /**
     * Save configuration to file system
     * @param config Configuration to save
     */
    private async saveConfigurationToFile(config: RuleConfiguration): Promise<void> {
        const fs = await import('fs').then(m => m.promises);
        const path = await import('path');

        try {
            // 确定保存路径 - 使用 current-config.json 作为当前配置文件
            const configPath = path.join(process.cwd(), 'current-config.json');

            // 创建备份（如果文件存在）
            try {
                await fs.access(configPath);
                const backupPath = path.join(process.cwd(), `current-config.backup.${Date.now()}.json`);
                await fs.copyFile(configPath, backupPath);
                this.logger.debug(`Configuration backup created: ${backupPath}`);
            } catch (error) {
                // 文件不存在，无需备份
                this.logger.debug('No existing configuration file to backup');
            }

            // 格式化配置为JSON
            const configJson = JSON.stringify(config, null, 2);

            // 原子写入：先写入临时文件，然后重命名
            const tempPath = `${configPath}.tmp`;
            await fs.writeFile(tempPath, configJson, 'utf8');
            await fs.rename(tempPath, configPath);

            this.logger.log(`Configuration saved to: ${configPath}`);

        } catch (error) {
            this.logger.error('Failed to save configuration to file:', error);
            throw error;
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        this.logger.log('Cleaning up configuration manager...');
        this.removeAllListeners();
        this.configurationHistory = [];
        this.currentConfiguration = null;
        this.isInitialized = false;
        this.initializationPromise = null;
    }
}
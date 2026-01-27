/**
 * Rule Loader Service
 * 
 * Responsible for loading rule configurations from various sources:
 * - Files (JSON configuration files)
 * - Database (future implementation)
 * - Environment variables
 * 
 * Implements JSON schema validation and configuration caching for performance optimization.
 */

import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
    RuleConfiguration,
    ValidationResult,
    RuleLoader as IRuleLoader,
    ValidationErrorType
} from '../../common/types/rule-engine.types';
import { SchemaValidator } from '../../common/utils/schema-validator';
import {
    CONFIG_PATHS,
    CACHE_CONFIG,
    DEFAULT_RULE_TEMPLATE,
    DEFAULT_ERROR_MESSAGES
} from '../../common/constants/rule-engine.constants';

/**
 * Cache entry interface for storing cached configurations
 */
interface CacheEntry {
    configuration: RuleConfiguration;
    timestamp: number;
    source: string;
}

/**
 * Rule loader service implementation
 */
@Injectable()
export class RuleLoaderService implements IRuleLoader {
    private readonly logger = new Logger(RuleLoaderService.name);
    private readonly schemaValidator: SchemaValidator;
    private readonly configCache = new Map<string, CacheEntry>();

    constructor() {
        this.schemaValidator = new SchemaValidator();
        this.logger.log('RuleLoaderService initialized');
    }

    /**
     * Load rules from a JSON configuration file
     * @param filePath Path to the configuration file (relative to project root)
     * @returns Promise resolving to rule configuration
     */
    async loadFromFile(filePath: string): Promise<RuleConfiguration> {
        const cacheKey = `file:${filePath}`;

        try {
            // Check cache first
            const cachedConfig = this.getCachedConfiguration(cacheKey);
            if (cachedConfig) {
                this.logger.debug(`Returning cached configuration for file: ${filePath}`);
                return cachedConfig;
            }

            // Resolve absolute path
            const absolutePath = this.resolveConfigPath(filePath);

            // Check if file exists
            await this.validateFileExists(absolutePath);

            // Read and parse file
            const fileContent = await fs.readFile(absolutePath, 'utf-8');
            const parsedConfig = JSON.parse(fileContent);

            // Validate configuration against schema
            const validationResult = this.validateConfiguration(parsedConfig);
            if (!validationResult.success) {
                throw new Error(`Configuration validation failed: ${validationResult.error}`);
            }

            const configuration = validationResult.value as RuleConfiguration;

            // Cache the configuration
            this.cacheConfiguration(cacheKey, configuration, `file:${filePath}`);

            this.logger.log(`Successfully loaded configuration from file: ${filePath}`);
            return configuration;

        } catch (error) {
            // 对于自定义配置文件，使用debug级别记录错误
            if (filePath === CONFIG_PATHS.CUSTOM_CONFIG_FILE) {
                this.logger.debug(`Custom configuration file not found or invalid: ${filePath}`);
            } else {
                this.logger.error(`Failed to load configuration from file ${filePath}:`, error.message);
            }

            // If it's the default config file and it fails, return template
            if (filePath === CONFIG_PATHS.DEFAULT_CONFIG_FILE) {
                this.logger.warn('Using default rule template as fallback');
                return this.createDefaultConfiguration();
            }

            throw error;
        }
    }

    /**
     * Load rules from database (placeholder implementation)
     * @returns Promise resolving to rule configuration
     */
    async loadFromDatabase(): Promise<RuleConfiguration> {
        const cacheKey = 'database:rules';

        try {
            // Check cache first
            const cachedConfig = this.getCachedConfiguration(cacheKey);
            if (cachedConfig) {
                this.logger.debug('Returning cached database configuration');
                return cachedConfig;
            }

            // TODO: Implement database loading logic
            // For now, return default configuration
            this.logger.warn('Database loading not yet implemented, using default configuration');

            const configuration = this.createDefaultConfiguration();
            this.cacheConfiguration(cacheKey, configuration, 'database');

            return configuration;

        } catch (error) {
            this.logger.error('Failed to load configuration from database:', error.message);
            throw error;
        }
    }

    /**
     * Load rules from environment variables
     * @returns Partial rule configuration from environment
     */
    loadFromEnvironment(): Partial<RuleConfiguration> {
        try {
            this.logger.debug('Loading configuration from environment variables');

            const envConfig: Partial<RuleConfiguration> = {};

            // Load metadata from environment
            if (process.env.RULE_CONFIG_NAME) {
                envConfig.metadata = {
                    name: process.env.RULE_CONFIG_NAME,
                    description: process.env.RULE_CONFIG_DESCRIPTION || 'Configuration from environment',
                    version: process.env.RULE_CONFIG_VERSION || '1.0.0',
                    priority: parseInt(process.env.RULE_CONFIG_PRIORITY || '100', 10)
                };
            }

            // Load global settings from environment
            if (process.env.RULE_STRICT_MODE !== undefined ||
                process.env.RULE_CONTINUE_ON_ERROR !== undefined ||
                process.env.RULE_MAX_ERRORS !== undefined) {

                envConfig.globalSettings = {
                    strictMode: process.env.RULE_STRICT_MODE === 'true',
                    continueOnError: process.env.RULE_CONTINUE_ON_ERROR !== 'false',
                    maxErrors: parseInt(process.env.RULE_MAX_ERRORS || '10', 10)
                };
            }

            // Load field rules from environment (JSON format)
            if (process.env.RULE_FIELD_RULES) {
                try {
                    envConfig.fieldRules = JSON.parse(process.env.RULE_FIELD_RULES);
                } catch (parseError) {
                    this.logger.warn('Failed to parse RULE_FIELD_RULES from environment:', parseError.message);
                }
            }

            this.logger.log('Successfully loaded partial configuration from environment');
            return envConfig;

        } catch (error) {
            this.logger.error('Failed to load configuration from environment:', error.message);
            return {};
        }
    }

    /**
     * Validate rule configuration against JSON schema
     * @param config Configuration to validate
     * @returns Validation result
     */
    validateConfiguration(config: any): ValidationResult {
        try {
            // Use the schema validator to validate the configuration
            const result = this.schemaValidator.validateRuleConfiguration(config);

            if (result.success) {
                this.logger.debug('Configuration validation successful');
            } else {
                this.logger.warn('Configuration validation failed:', result.error);
            }

            return result;

        } catch (error) {
            this.logger.error('Configuration validation error:', error.message);
            return {
                success: false,
                error: `Configuration validation failed: ${error.message}`,
                errorCode: ValidationErrorType.CONFIGURATION_ERROR
            };
        }
    }

    /**
     * Clear configuration cache
     * @param cacheKey Optional specific cache key to clear, if not provided clears all
     */
    clearCache(cacheKey?: string): void {
        if (cacheKey) {
            this.configCache.delete(cacheKey);
            this.logger.debug(`Cleared cache for key: ${cacheKey}`);
        } else {
            this.configCache.clear();
            this.logger.debug('Cleared all configuration cache');
        }
    }

    /**
     * Get cache statistics
     * @returns Cache statistics object
     */
    getCacheStats(): {
        size: number;
        entries: Array<{ key: string; source: string; age: number }>;
    } {
        const entries = Array.from(this.configCache.entries()).map(([key, entry]) => ({
            key,
            source: entry.source,
            age: Date.now() - entry.timestamp
        }));

        return {
            size: this.configCache.size,
            entries
        };
    }

    /**
     * Load configuration with fallback chain
     * Tries multiple sources in order: custom file -> default file -> environment -> template
     * @param customFilePath Optional custom file path to try first
     * @returns Promise resolving to rule configuration
     */
    async loadWithFallback(customFilePath?: string): Promise<RuleConfiguration> {
        const sources = [
            ...(customFilePath ? [customFilePath] : []),
            CONFIG_PATHS.CUSTOM_CONFIG_FILE,
            CONFIG_PATHS.DEFAULT_CONFIG_FILE
        ];

        for (const source of sources) {
            try {
                const config = await this.loadFromFile(source);

                // Merge with environment overrides
                const envConfig = this.loadFromEnvironment();
                const mergedConfig = this.mergeConfigurations(config, envConfig);

                this.logger.log(`Successfully loaded configuration from: ${source}`);
                return mergedConfig;

            } catch (error) {
                // 对于可选的配置文件，使用debug级别而不是error级别
                if (source === CONFIG_PATHS.CUSTOM_CONFIG_FILE) {
                    this.logger.debug(`Optional configuration file not found: ${source}`);
                } else {
                    this.logger.debug(`Failed to load from ${source}, trying next source:`, error.message);
                }
                continue;
            }
        }

        // If all file sources fail, try environment only
        try {
            const envConfig = this.loadFromEnvironment();
            if (envConfig.metadata && envConfig.fieldRules && envConfig.globalSettings) {
                this.logger.log('Using configuration from environment variables');
                return envConfig as RuleConfiguration;
            }
        } catch (error) {
            this.logger.debug('Environment configuration incomplete:', error.message);
        }

        // Final fallback to default template
        this.logger.warn('All configuration sources failed, using default template');
        return this.createDefaultConfiguration();
    }

    /**
     * Get cached configuration if valid and not expired
     * @param cacheKey Cache key to lookup
     * @returns Cached configuration or null if not found/expired
     */
    private getCachedConfiguration(cacheKey: string): RuleConfiguration | null {
        const entry = this.configCache.get(cacheKey);

        if (!entry) {
            return null;
        }

        // Check if cache entry is expired
        const age = Date.now() - entry.timestamp;
        if (age > CACHE_CONFIG.CONFIG_CACHE_TTL) {
            this.configCache.delete(cacheKey);
            this.logger.debug(`Cache entry expired for key: ${cacheKey}`);
            return null;
        }

        return entry.configuration;
    }

    /**
     * Cache a configuration with metadata
     * @param cacheKey Cache key
     * @param configuration Configuration to cache
     * @param source Source identifier
     */
    private cacheConfiguration(cacheKey: string, configuration: RuleConfiguration, source: string): void {
        // Implement LRU-like behavior by removing oldest entries if cache is full
        if (this.configCache.size >= CACHE_CONFIG.MAX_CACHE_SIZE) {
            const oldestKey = this.configCache.keys().next().value;
            this.configCache.delete(oldestKey);
            this.logger.debug(`Removed oldest cache entry: ${oldestKey}`);
        }

        this.configCache.set(cacheKey, {
            configuration,
            timestamp: Date.now(),
            source
        });

        this.logger.debug(`Cached configuration with key: ${cacheKey}`);
    }

    /**
     * Resolve configuration file path to absolute path
     * @param filePath Relative file path
     * @returns Absolute file path
     */
    private resolveConfigPath(filePath: string): string {
        // If already absolute, return as-is
        if (filePath.startsWith('/') || filePath.match(/^[A-Za-z]:/)) {
            return filePath;
        }

        // Resolve relative to project root (assuming we're in src/services/rule-engine)
        return join(process.cwd(), 'src', filePath);
    }

    /**
     * Validate that a file exists and is readable
     * @param filePath Absolute file path
     */
    private async validateFileExists(filePath: string): Promise<void> {
        try {
            const stats = await fs.stat(filePath);
            if (!stats.isFile()) {
                throw new Error(`Path is not a file: ${filePath}`);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Configuration file not found: ${filePath}`);
            }
            throw new Error(`Cannot access configuration file: ${filePath} - ${error.message}`);
        }
    }

    /**
     * Create default rule configuration from template
     * @returns Default rule configuration
     */
    private createDefaultConfiguration(): RuleConfiguration {
        return {
            ...DEFAULT_RULE_TEMPLATE,
            metadata: {
                ...DEFAULT_RULE_TEMPLATE.metadata,
                name: 'fallback-default-rules',
                description: '默认回退规则配置（从模板生成）'
            }
        };
    }

    /**
     * Get current rule configuration (from cache or load default)
     * @returns Current rule configuration
     */
    getCurrentConfiguration(): RuleConfiguration | null {
        try {
            // Try to get from cache first
            const cachedConfig = this.getCachedConfiguration('current');
            if (cachedConfig) {
                return cachedConfig;
            }

            // If no cached config, try to load default synchronously
            // This is a fallback - in production, configuration should be loaded at startup
            this.logger.warn('No current configuration in cache, returning default template');
            return this.createDefaultConfiguration();

        } catch (error) {
            this.logger.error('Failed to get current configuration:', error.message);
            return null;
        }
    }

    /**
     * Set current configuration in cache
     * @param config Configuration to set as current
     */
    setCurrentConfiguration(config: RuleConfiguration): void {
        this.cacheConfiguration('current', config, 'manual');
        this.logger.log('Current configuration updated');
    }

    /**
     * Update the current configuration
     * @param config New configuration to set
     * @returns Promise resolving when configuration is updated
     */
    async updateConfiguration(config: RuleConfiguration): Promise<void> {
        try {
            // Validate the configuration first
            const validationResult = this.validateConfiguration(config);
            if (!validationResult.success) {
                throw new Error(`Configuration validation failed: ${validationResult.error}`);
            }

            // Set as current configuration
            this.setCurrentConfiguration(config);

            // Optionally persist to file (for now, just cache it)
            // TODO: Implement persistence to default config file if needed

            this.logger.log(`Configuration updated: ${config.metadata.name} v${config.metadata.version}`);

        } catch (error) {
            this.logger.error('Failed to update configuration:', error.message);
            throw error;
        }
    }

    /**
     * Merge two rule configurations, with the second taking precedence
     * @param base Base configuration
     * @param override Override configuration (partial)
     * @returns Merged configuration
     */
    private mergeConfigurations(
        base: RuleConfiguration,
        override: Partial<RuleConfiguration>
    ): RuleConfiguration {
        return {
            metadata: { ...base.metadata, ...override.metadata },
            fieldRules: { ...base.fieldRules, ...override.fieldRules },
            globalSettings: { ...base.globalSettings, ...override.globalSettings }
        };
    }
}
/**
 * Dynamic Rule Engine Types and Interfaces
 * 
 * This file contains all the core interfaces and type definitions for the dynamic rule engine
 * that will replace hardcoded validation logic with configurable rules.
 */

/**
 * Validation strategy interface - defines the contract for all field validation implementations
 */
export interface ValidationStrategy<T = any> {
    /**
     * Strategy name, used for identification and registration
     */
    readonly name: string;

    /**
     * Strategy description
     */
    readonly description: string;

    /**
     * Execute validation logic
     * @param value The value to validate
     * @param params Validation parameters
     * @returns Validation result
     */
    validate(value: any, params: ValidationParams): ValidationResult<T>;

    /**
     * Validate if parameters are valid for this strategy
     * @param params Validation parameters
     * @returns Parameter validation result
     */
    validateParams(params: ValidationParams): boolean;
}

/**
 * Rule configuration interface - defines the structure of JSON rule configurations
 */
export interface RuleConfiguration {
    /**
     * Rule metadata
     */
    metadata: RuleMetadata;

    /**
     * Field rules mapping - maps field names to their validation rules
     */
    fieldRules: Record<string, FieldRule[]>;

    /**
     * Global settings that apply to all rules
     */
    globalSettings: GlobalSettings;
}

/**
 * Rule metadata interface
 */
export interface RuleMetadata {
    /**
     * Rule configuration name
     */
    name: string;

    /**
     * Rule configuration description
     */
    description: string;

    /**
     * Configuration version
     */
    version: string;

    /**
     * Rule priority (higher numbers take precedence)
     */
    priority: number;
}

/**
 * Field rule interface - defines validation rules for a specific field
 */
export interface FieldRule {
    /**
     * Rule name for identification
     */
    name: string;

    /**
     * Validation strategy type to use
     */
    strategy: string;

    /**
     * Parameters for the validation strategy
     */
    params: ValidationParams;

    /**
     * Whether this rule is required
     */
    required: boolean;

    /**
     * Rule priority (higher numbers take precedence)
     */
    priority?: number;

    /**
     * Custom error message template (optional)
     */
    errorMessage?: string;

    /**
     * Rule condition for conditional validation (optional)
     */
    condition?: RuleCondition;
}

/**
 * Global settings interface
 */
export interface GlobalSettings {
    /**
     * Whether to use strict mode validation
     */
    strictMode: boolean;

    /**
     * Whether to continue processing on validation errors
     */
    continueOnError: boolean;

    /**
     * Maximum number of errors to collect before stopping
     */
    maxErrors: number;

    /**
     * Whether to enable caching mechanism
     */
    enableCaching?: boolean;

    /**
     * Cache timeout in seconds
     */
    cacheTimeout?: number;

    /**
     * Whether to enable parallel processing
     */
    parallelProcessing?: boolean;

    /**
     * Maximum number of parallel tasks
     */
    maxParallelTasks?: number;

    /**
     * Log level for the rule engine
     */
    logLevel?: string;

    /**
     * Whether to enable performance monitoring
     */
    enablePerformanceMonitoring?: boolean;
}

/**
 * Rule condition interface for conditional validation
 */
export interface RuleCondition {
    /**
     * Field to check condition against
     */
    field: string;

    /**
     * Condition operator
     */
    operator: ConditionOperator;

    /**
     * Value to compare against
     */
    value: any;
}

/**
 * Condition operators for rule conditions
 */
export enum ConditionOperator {
    EQUALS = 'equals',
    NOT_EQUALS = 'not_equals',
    GREATER_THAN = 'greater_than',
    LESS_THAN = 'less_than',
    CONTAINS = 'contains',
    NOT_CONTAINS = 'not_contains',
    IS_EMPTY = 'is_empty',
    IS_NOT_EMPTY = 'is_not_empty'
}

/**
 * Validation result interface - returned by validation strategies
 */
export interface ValidationResult<T = any> {
    /**
     * Whether validation was successful
     */
    success: boolean;

    /**
     * Cleaned/processed value (if successful)
     */
    value?: T;

    /**
     * Error message (if validation failed)
     */
    error?: string;

    /**
     * Error code for programmatic handling
     */
    errorCode?: string;

    /**
     * Additional metadata about the validation
     */
    metadata?: Record<string, any>;
}

/**
 * Union type for all validation parameter types
 */
export type ValidationParams =
    | RegexParams
    | RangeParams
    | LengthParams
    | PhoneParams
    | DateParams
    | AddressParams
    | CustomParams;

/**
 * Regular expression validation parameters
 */
export interface RegexParams {
    /**
     * Regular expression pattern
     */
    pattern: string;

    /**
     * Regular expression flags (optional)
     */
    flags?: string;

    /**
     * Whether to use multiline mode (optional)
     */
    multiline?: boolean;
}

/**
 * Range validation parameters
 */
export interface RangeParams {
    /**
     * Minimum value (optional)
     */
    min?: number;

    /**
     * Maximum value (optional)
     */
    max?: number;

    /**
     * Whether range bounds are inclusive (default: true)
     */
    inclusive?: boolean;
}

/**
 * Length validation parameters
 */
export interface LengthParams {
    /**
     * Minimum length (optional)
     */
    minLength?: number;

    /**
     * Maximum length (optional)
     */
    maxLength?: number;

    /**
     * Exact length requirement (optional)
     */
    exactLength?: number;
}

/**
 * Phone number validation parameters
 */
export interface PhoneParams {
    /**
     * Whether to remove spaces during cleaning
     */
    removeSpaces?: boolean;

    /**
     * Whether to remove dashes during cleaning
     */
    removeDashes?: boolean;

    /**
     * Whether to remove country code during cleaning
     */
    removeCountryCode?: boolean;

    /**
     * Whether to allow landline numbers
     */
    allowLandline?: boolean;
}

/**
 * Date validation parameters
 */
export interface DateParams {
    /**
     * Accepted date formats
     */
    formats?: string[];

    /**
     * Minimum year allowed
     */
    minYear?: number;

    /**
     * Maximum year allowed
     */
    maxYear?: number;

    /**
     * Timezone for date processing
     */
    timezone?: string;
}

/**
 * Address validation parameters
 */
export interface AddressParams {
    /**
     * Whether province is required
     */
    requireProvince?: boolean;

    /**
     * Whether city is required
     */
    requireCity?: boolean;

    /**
     * Whether district is required
     */
    requireDistrict?: boolean;

    /**
     * Whether to validate address components
     */
    validateComponents?: boolean;
}

/**
 * Custom validation parameters for extensibility
 */
export interface CustomParams {
    /**
     * Flexible parameter structure for custom strategies
     */
    [key: string]: any;
}

/**
 * Validation error types enumeration
 */
export enum ValidationErrorType {
    INVALID_FORMAT = 'INVALID_FORMAT',
    OUT_OF_RANGE = 'OUT_OF_RANGE',
    REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
    STRATEGY_NOT_FOUND = 'STRATEGY_NOT_FOUND',
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
    PROCESSING_ERROR = 'PROCESSING_ERROR'
}

/**
 * Validation error class for structured error handling
 */
export class ValidationError extends Error {
    constructor(
        public readonly type: ValidationErrorType,
        public readonly field: string,
        public readonly originalValue: any,
        message: string,
        public readonly metadata?: Record<string, any>,
        // 新增字段以支持详细错误信息
        public readonly rule?: string,
        public readonly expectedFormat?: string,
        public readonly strategy?: string,
        public readonly parameters?: Record<string, any>,
        public readonly errorCode?: string
    ) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Field processing result interface
 */
export interface FieldProcessingResult {
    /**
     * Field name that was processed
     */
    fieldName: string;

    /**
     * Original value before processing
     */
    originalValue: any;

    /**
     * Processed/cleaned value
     */
    processedValue?: any;

    /**
     * Whether processing was successful
     */
    success: boolean;

    /**
     * Validation errors encountered
     */
    errors: ValidationError[];

    /**
     * Applied rules information
     */
    appliedRules: string[];
}

/**
 * Rule engine processing result interface
 */
export interface RuleEngineResult {
    /**
     * Overall processing success
     */
    success: boolean;

    /**
     * Field processing results
     */
    fieldResults: FieldProcessingResult[];

    /**
     * Processed row data
     */
    processedData: Record<string, any>;

    /**
     * All validation errors
     */
    errors: ValidationError[];

    /**
     * Processing metadata
     */
    metadata: {
        processingTime: number;
        rulesApplied: number;
        fieldsProcessed: number;
        parallelProcessing?: boolean;
        performanceMetrics?: PerformanceMetrics;
    };
}

/**
 * Strategy factory interface for creating validation strategies
 */
export interface StrategyFactory {
    /**
     * Register a new validation strategy
     */
    registerStrategy(strategy: ValidationStrategy): void;

    /**
     * Create a validation strategy instance by name
     */
    createStrategy(strategyName: string): ValidationStrategy | null;

    /**
     * Get all available strategy names
     */
    getAvailableStrategies(): string[];

    /**
     * Check if a strategy is registered
     */
    hasStrategy(strategyName: string): boolean;
}

/**
 * Rule loader interface for loading rule configurations
 */
export interface RuleLoader {
    /**
     * Load rules from a file
     */
    loadFromFile(filePath: string): Promise<RuleConfiguration>;

    /**
     * Load rules from database
     */
    loadFromDatabase(): Promise<RuleConfiguration>;

    /**
     * Load rules from environment variables
     */
    loadFromEnvironment(): Partial<RuleConfiguration>;

    /**
     * Validate rule configuration structure
     */
    validateConfiguration(config: RuleConfiguration): ValidationResult;
}

/**
 * Configuration manager interface for managing rule configurations
 */
export interface ConfigurationManager {
    /**
     * Get field rules for a specific field
     */
    getFieldRules(fieldName: string): FieldRule[];

    /**
     * Get current rule configuration
     */
    getCurrentConfiguration(): RuleConfiguration;

    /**
     * Reload configuration from source
     */
    reloadConfiguration(): Promise<void>;

    /**
     * Update configuration with validation
     */
    updateConfiguration(config: RuleConfiguration): Promise<ValidationResult>;

    /**
     * Get configuration history
     */
    getConfigurationHistory(): RuleConfiguration[];

    /**
     * Rollback to previous configuration
     */
    rollbackConfiguration(version?: string): Promise<ValidationResult>;
}

/**
 * Field processor interface for processing individual fields
 */
export interface FieldProcessor {
    /**
     * Process a single field with its rules
     */
    processField(
        fieldName: string,
        value: any,
        columnType: string
    ): Promise<FieldProcessingResult>;

    /**
     * Get applicable rules for a field
     */
    getFieldRules(fieldName: string, columnType: string): FieldRule[];
}

/**
 * Rule engine interface - main engine for processing data with rules
 */
export interface RuleEngine {
    /**
     * Clean a single row of data
     */
    cleanRow(
        rowData: Record<string, any>,
        columnTypes: Record<string, string>
    ): Promise<RuleEngineResult>;

    /**
     * Clean multiple rows of data
     */
    cleanBatch(
        rows: Record<string, any>[],
        columnTypes: Record<string, string>
    ): Promise<RuleEngineResult[]>;

    /**
     * Get current rule engine configuration
     */
    getConfiguration(): RuleConfiguration;

    /**
     * Update rule engine configuration
     */
    updateConfiguration(config: RuleConfiguration): Promise<ValidationResult>;
}

/**
 * Cache entry interface for strategy caching
 */
export interface CacheEntry {
    /**
     * Cache entry expiration timestamp
     */
    expiresAt: number;
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
    /**
     * Number of cache hits
     */
    hits: number;

    /**
     * Number of cache misses
     */
    misses: number;

    /**
     * Number of cache evictions
     */
    evictions: number;

    /**
     * Current cache size
     */
    size: number;

    /**
     * Cache hit rate (0-1)
     */
    hitRate: number;
}

/**
 * Parallel processing configuration interface
 */
export interface ParallelProcessingConfig {
    /**
     * Maximum number of concurrent field validations
     */
    maxConcurrency: number;

    /**
     * Batch size for parallel processing
     */
    batchSize: number;

    /**
     * Timeout for individual field processing (ms)
     */
    fieldTimeoutMs: number;

    /**
     * Whether to enable parallel processing
     */
    enabled: boolean;
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
    /**
     * Total processing time in milliseconds
     */
    totalTime: number;

    /**
     * Average time per field in milliseconds
     */
    avgFieldTime: number;

    /**
     * Number of fields processed in parallel
     */
    parallelFields: number;

    /**
     * Cache hit rate during processing
     */
    cacheHitRate: number;

    /**
     * Memory usage statistics
     */
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
    };
}
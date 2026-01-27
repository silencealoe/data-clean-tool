/**
 * Rule Configuration Types
 * Frontend types for rule configuration functionality
 */

/**
 * Rule configuration interface - main configuration object
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
    operator: ConditionOperatorType;

    /**
     * Value to compare against
     */
    value: any;
}

/**
 * Condition operators for rule conditions
 */
export const ConditionOperator = {
    EQUALS: 'equals',
    NOT_EQUALS: 'not_equals',
    GREATER_THAN: 'greater_than',
    LESS_THAN: 'less_than',
    CONTAINS: 'contains',
    NOT_CONTAINS: 'not_contains',
    IS_EMPTY: 'is_empty',
    IS_NOT_EMPTY: 'is_not_empty'
} as const;

export type ConditionOperatorType = typeof ConditionOperator[keyof typeof ConditionOperator];

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

// API Response Types

/**
 * Response interface for rule configuration operations
 */
export interface RuleConfigResponse {
    /**
     * Whether the operation was successful
     */
    success: boolean;

    /**
     * Rule configuration data (if successful)
     */
    configuration?: RuleConfiguration;

    /**
     * Operation message
     */
    message?: string;

    /**
     * Error message (if failed)
     */
    error?: string;

    /**
     * Additional metadata
     */
    metadata?: Record<string, any>;
}

/**
 * Response interface for configuration history
 */
export interface ConfigHistoryResponse {
    /**
     * List of historical configurations
     */
    history: RuleConfiguration[];

    /**
     * Total number of history records
     */
    total: number;
}

/**
 * Response interface for configuration statistics
 */
export interface ConfigStatsResponse {
    /**
     * Current configuration version
     */
    currentVersion: string;

    /**
     * Number of history records
     */
    historySize: number;

    /**
     * Total number of configured fields
     */
    totalFields: number;

    /**
     * Total number of rules
     */
    totalRules: number;

    /**
     * Last update timestamp
     */
    lastUpdated?: string;

    /**
     * Whether the configuration is initialized
     */
    isInitialized: boolean;
}

// Request Types

/**
 * Request interface for configuration update
 */
export interface UpdateConfigRequest {
    /**
     * Rule configuration to update
     */
    configuration: RuleConfiguration;

    /**
     * Optional description of the update
     */
    description?: string;
}

/**
 * Request interface for configuration rollback
 */
export interface RollbackConfigRequest {
    /**
     * Version to rollback to (optional, defaults to previous version)
     */
    version?: string;

    /**
     * Reason for rollback (optional)
     */
    reason?: string;
}

// Form Types for UI Components

/**
 * Form data for rule metadata editing
 */
export interface RuleMetadataFormData {
    name: string;
    description: string;
    version: string;
    priority: number;
}

/**
 * Form data for global settings editing
 */
export interface GlobalSettingsFormData {
    strictMode: boolean;
    continueOnError: boolean;
    maxErrors: number;
    enableCaching: boolean;
    cacheTimeout: number;
    parallelProcessing: boolean;
    maxParallelTasks: number;
    logLevel: string;
    enablePerformanceMonitoring: boolean;
}

/**
 * Form data for field rule editing
 */
export interface FieldRuleFormData {
    name: string;
    strategy: string;
    params: ValidationParams;
    required: boolean;
    priority: number;
    errorMessage: string;
}

/**
 * Available validation strategies for UI selection
 */
export const VALIDATION_STRATEGIES = [
    { value: 'regex', label: '正则表达式验证', description: '使用正则表达式进行格式验证' },
    { value: 'range', label: '数值范围验证', description: '验证数值是否在指定范围内' },
    { value: 'length', label: '长度验证', description: '验证字符串长度是否符合要求' },
    { value: 'phone', label: '手机号验证', description: '验证和清洗手机号格式' },
    { value: 'date', label: '日期验证', description: '验证和标准化日期格式' },
    { value: 'address', label: '地址验证', description: '验证和标准化地址信息' }
] as const;

/**
 * Available log levels for global settings
 */
export const LOG_LEVELS = [
    { value: 'error', label: 'Error' },
    { value: 'warn', label: 'Warning' },
    { value: 'info', label: 'Info' },
    { value: 'debug', label: 'Debug' }
] as const;

/**
 * Type for validation strategy values
 */
export type ValidationStrategyType = typeof VALIDATION_STRATEGIES[number]['value'];

/**
 * Type for log level values
 */
export type LogLevelType = typeof LOG_LEVELS[number]['value'];
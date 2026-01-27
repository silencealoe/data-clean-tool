/**
 * Rule Engine Constants
 * 
 * Contains all constants used by the dynamic rule engine
 */

/**
 * Default validation strategy names
 */
export const VALIDATION_STRATEGIES = {
    REGEX: 'regex',
    RANGE: 'range',
    LENGTH: 'length',
    PHONE: 'phone',
    DATE: 'date',
    ADDRESS: 'address',
    CUSTOM: 'custom',
    // Legacy cleaner service adapters
    PHONE_CLEANER: 'phone-cleaner',
    DATE_CLEANER: 'date-cleaner',
    ADDRESS_CLEANER: 'address-cleaner'
} as const;

/**
 * Default error messages for validation failures
 */
export const DEFAULT_ERROR_MESSAGES = {
    INVALID_FORMAT: '字段格式不正确',
    OUT_OF_RANGE: '字段值超出允许范围',
    REQUIRED_FIELD_MISSING: '必填字段缺失',
    STRATEGY_NOT_FOUND: '未找到指定的验证策略',
    CONFIGURATION_ERROR: '规则配置错误',
    PROCESSING_ERROR: '处理过程中发生错误',
    REGEX_PATTERN_INVALID: '正则表达式模式无效',
    LENGTH_CONSTRAINT_VIOLATED: '字段长度不符合要求',
    PHONE_FORMAT_INVALID: '手机号格式不正确',
    DATE_FORMAT_INVALID: '日期格式不正确',
    ADDRESS_FORMAT_INVALID: '地址格式不正确'
} as const;

/**
 * Configuration file paths and names
 */
export const CONFIG_PATHS = {
    DEFAULT_CONFIG_FILE: 'config/rule-engine/default-rules.json',
    CUSTOM_CONFIG_FILE: 'config/rule-engine/custom-rules.json',
    SCHEMA_FILE: 'common/schemas/rule-configuration.schema.json'
} as const;

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
    STRATEGY_CACHE_TTL: 3600000, // 1 hour in milliseconds
    CONFIG_CACHE_TTL: 1800000,   // 30 minutes in milliseconds
    MAX_CACHE_SIZE: 1000,        // Maximum number of cached items
    CACHE_KEY_PREFIX: 'rule_engine:'
} as const;

/**
 * Performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
    MAX_PROCESSING_TIME_MS: 5000,     // Maximum time for processing a single row
    MAX_BATCH_SIZE: 1000,             // Maximum number of rows to process in a batch
    PARALLEL_PROCESSING_THRESHOLD: 100, // Minimum rows to enable parallel processing
    MAX_CONCURRENT_WORKERS: 4         // Maximum number of concurrent workers
} as const;

/**
 * Validation limits
 */
export const VALIDATION_LIMITS = {
    MAX_FIELD_RULES: 10,              // Maximum rules per field
    MAX_ERROR_MESSAGE_LENGTH: 500,    // Maximum length of error messages
    MAX_REGEX_PATTERN_LENGTH: 1000,   // Maximum length of regex patterns
    MAX_CUSTOM_PARAMS: 50,            // Maximum number of custom parameters
    MIN_PRIORITY: 0,                  // Minimum rule priority
    MAX_PRIORITY: 1000                // Maximum rule priority
} as const;

/**
 * File monitoring configuration
 */
export const FILE_MONITORING = {
    WATCH_DEBOUNCE_MS: 1000,          // Debounce time for file changes
    MAX_RELOAD_ATTEMPTS: 3,           // Maximum attempts to reload configuration
    RELOAD_RETRY_DELAY_MS: 5000       // Delay between reload attempts
} as const;

/**
 * API endpoint paths for configuration management
 */
export const API_ENDPOINTS = {
    GET_CONFIG: '/api/rule-engine/config',
    UPDATE_CONFIG: '/api/rule-engine/config',
    VALIDATE_CONFIG: '/api/rule-engine/config/validate',
    GET_HISTORY: '/api/rule-engine/config/history',
    ROLLBACK_CONFIG: '/api/rule-engine/config/rollback',
    GET_STRATEGIES: '/api/rule-engine/strategies',
    RELOAD_CONFIG: '/api/rule-engine/config/reload'
} as const;

/**
 * Logging configuration
 */
export const LOGGING_CONFIG = {
    LOG_LEVEL: 'info',
    LOG_VALIDATION_ERRORS: true,
    LOG_PERFORMANCE_METRICS: true,
    LOG_CONFIG_CHANGES: true,
    MAX_LOG_ENTRIES: 10000
} as const;

/**
 * Regular expressions for common validation patterns
 */
export const COMMON_PATTERNS = {
    CHINESE_MOBILE: '^1[3-9]\\d{9}$',
    EMAIL: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    CHINESE_ID_CARD: '^[1-9]\\d{5}(18|19|20)\\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\\d{3}[0-9Xx]$',
    CHINESE_LANDLINE: '^0\\d{2,3}-?\\d{7,8}$',
    POSTAL_CODE: '^\\d{6}$',
    DATE_YYYY_MM_DD: '^\\d{4}-\\d{2}-\\d{2}$',
    DATE_YYYY_MM_DD_SLASH: '^\\d{4}/\\d{2}/\\d{2}$',
    CHINESE_NAME: '^[\\u4e00-\\u9fa5]{2,10}$'
} as const;

/**
 * Default rule configuration template
 */
export const DEFAULT_RULE_TEMPLATE = {
    metadata: {
        name: 'default-rules',
        description: '默认数据清洗规则配置',
        version: '1.0.0',
        priority: 100
    },
    fieldRules: {},
    globalSettings: {
        strictMode: false,
        continueOnError: true,
        maxErrors: 10
    }
} as const;
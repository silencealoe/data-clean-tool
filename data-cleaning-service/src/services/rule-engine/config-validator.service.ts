/**
 * Configuration Validator Service
 * 
 * Validates rule configurations for completeness, correctness, and detects conflicts.
 * Implements requirements 6.1, 6.2, 6.3, and 9.5 from the dynamic rule engine specification.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
    RuleConfiguration,
    FieldRule,
    ValidationResult,
    ValidationErrorType,
    RegexParams,
    RangeParams,
    LengthParams,
    PhoneParams,
    DateParams,
    AddressParams,
    ValidationParams
} from '../../common/types/rule-engine.types';
import { SchemaValidator } from '../../common/utils/schema-validator';
import {
    VALIDATION_STRATEGIES,
    DEFAULT_ERROR_MESSAGES,
    VALIDATION_LIMITS,
    COMMON_PATTERNS
} from '../../common/constants/rule-engine.constants';

/**
 * Configuration validation error interface
 */
export interface ConfigValidationError {
    type: 'schema' | 'field' | 'regex' | 'conflict' | 'parameter';
    field?: string;
    rule?: string;
    message: string;
    severity: 'error' | 'warning';
    details?: any;
}

/**
 * Rule conflict information
 */
export interface RuleConflict {
    field: string;
    conflictingRules: string[];
    conflictType: 'duplicate_strategy' | 'contradictory_params' | 'logical_conflict';
    description: string;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult extends ValidationResult {
    errors: ConfigValidationError[];
    warnings: ConfigValidationError[];
    conflicts: RuleConflict[];
    validatedFields: string[];
    summary: {
        totalFields: number;
        totalRules: number;
        errorCount: number;
        warningCount: number;
        conflictCount: number;
    };
}

/**
 * Configuration validator service implementation
 */
@Injectable()
export class ConfigValidatorService {
    private readonly logger = new Logger(ConfigValidatorService.name);
    private readonly schemaValidator: SchemaValidator;

    constructor() {
        this.schemaValidator = new SchemaValidator();
        this.logger.log('ConfigValidatorService initialized');
    }

    /**
     * Validate a complete rule configuration
     * @param config Rule configuration to validate
     * @returns Detailed validation result
     */
    async validateConfiguration(config: any): Promise<ConfigValidationResult> {
        const startTime = Date.now();
        const errors: ConfigValidationError[] = [];
        const warnings: ConfigValidationError[] = [];
        const conflicts: RuleConflict[] = [];
        const validatedFields: string[] = [];

        try {
            // Step 1: JSON Schema validation (Requirement 6.1)
            const schemaResult = this.schemaValidator.validateRuleConfiguration(config);
            if (!schemaResult.success) {
                errors.push({
                    type: 'schema',
                    message: `Schema validation failed: ${schemaResult.error}`,
                    severity: 'error',
                    details: schemaResult.metadata
                });

                // If schema validation fails, we can't proceed with detailed validation
                return this.createValidationResult(false, errors, warnings, conflicts, validatedFields, config);
            }

            const validConfig = schemaResult.value as RuleConfiguration;

            // Step 2: Field name validation (Requirement 6.2)
            const fieldValidationResults = await this.validateFieldNames(validConfig);
            errors.push(...fieldValidationResults.errors);
            warnings.push(...fieldValidationResults.warnings);
            validatedFields.push(...fieldValidationResults.validFields);

            // Step 3: Rule parameter validation including regex patterns (Requirement 6.2, 6.3)
            const paramValidationResults = await this.validateRuleParameters(validConfig);
            errors.push(...paramValidationResults.errors);
            warnings.push(...paramValidationResults.warnings);

            // Step 4: Rule conflict detection (Requirement 9.5)
            const conflictResults = await this.detectRuleConflicts(validConfig);
            conflicts.push(...conflictResults);

            // Step 5: Additional semantic validation
            const semanticResults = await this.validateSemanticRules(validConfig);
            errors.push(...semanticResults.errors);
            warnings.push(...semanticResults.warnings);

            const processingTime = Date.now() - startTime;
            this.logger.debug(`Configuration validation completed in ${processingTime}ms`);

            const success = errors.length === 0;
            return this.createValidationResult(success, errors, warnings, conflicts, validatedFields, validConfig);

        } catch (error) {
            this.logger.error('Configuration validation failed with exception:', error);
            errors.push({
                type: 'schema',
                message: `Validation process failed: ${error.message}`,
                severity: 'error',
                details: { originalError: error }
            });

            return this.createValidationResult(false, errors, warnings, conflicts, validatedFields, config);
        }
    }

    /**
     * Validate field names for correctness and consistency
     * @param config Rule configuration
     * @returns Field validation results
     */
    private async validateFieldNames(config: RuleConfiguration): Promise<{
        errors: ConfigValidationError[];
        warnings: ConfigValidationError[];
        validFields: string[];
    }> {
        const errors: ConfigValidationError[] = [];
        const warnings: ConfigValidationError[] = [];
        const validFields: string[] = [];

        for (const [fieldName, rules] of Object.entries(config.fieldRules)) {
            // Validate field name format
            if (!this.isValidFieldName(fieldName)) {
                errors.push({
                    type: 'field',
                    field: fieldName,
                    message: `Invalid field name format: ${fieldName}. Field names must start with a letter and contain only letters, numbers, and underscores.`,
                    severity: 'error'
                });
                continue;
            }

            // Check for empty rule arrays
            if (!rules || rules.length === 0) {
                warnings.push({
                    type: 'field',
                    field: fieldName,
                    message: `Field ${fieldName} has no validation rules defined`,
                    severity: 'warning'
                });
                continue;
            }

            // Check for too many rules per field
            if (rules.length > VALIDATION_LIMITS.MAX_FIELD_RULES) {
                warnings.push({
                    type: 'field',
                    field: fieldName,
                    message: `Field ${fieldName} has ${rules.length} rules, which exceeds the recommended maximum of ${VALIDATION_LIMITS.MAX_FIELD_RULES}`,
                    severity: 'warning'
                });
            }

            validFields.push(fieldName);
        }

        return { errors, warnings, validFields };
    }

    /**
     * Validate rule parameters including regex patterns
     * @param config Rule configuration
     * @returns Parameter validation results
     */
    private async validateRuleParameters(config: RuleConfiguration): Promise<{
        errors: ConfigValidationError[];
        warnings: ConfigValidationError[];
    }> {
        const errors: ConfigValidationError[] = [];
        const warnings: ConfigValidationError[] = [];

        for (const [fieldName, rules] of Object.entries(config.fieldRules)) {
            for (const rule of rules) {
                // Validate strategy exists
                if (!this.isValidStrategy(rule.strategy)) {
                    errors.push({
                        type: 'parameter',
                        field: fieldName,
                        rule: rule.name,
                        message: `Unknown validation strategy: ${rule.strategy}`,
                        severity: 'error'
                    });
                    continue;
                }

                // Validate parameters based on strategy type
                const paramValidation = await this.validateStrategyParameters(rule.strategy, rule.params, fieldName, rule.name);
                errors.push(...paramValidation.errors);
                warnings.push(...paramValidation.warnings);

                // Validate error message length
                if (rule.errorMessage && rule.errorMessage.length > VALIDATION_LIMITS.MAX_ERROR_MESSAGE_LENGTH) {
                    warnings.push({
                        type: 'parameter',
                        field: fieldName,
                        rule: rule.name,
                        message: `Error message is too long (${rule.errorMessage.length} characters). Consider shortening it.`,
                        severity: 'warning'
                    });
                }
            }
        }

        return { errors, warnings };
    }

    /**
     * Validate parameters for specific strategy types
     * @param strategy Strategy name
     * @param params Parameters to validate
     * @param fieldName Field name for error reporting
     * @param ruleName Rule name for error reporting
     * @returns Parameter validation results
     */
    private async validateStrategyParameters(
        strategy: string,
        params: ValidationParams,
        fieldName: string,
        ruleName: string
    ): Promise<{
        errors: ConfigValidationError[];
        warnings: ConfigValidationError[];
    }> {
        const errors: ConfigValidationError[] = [];
        const warnings: ConfigValidationError[] = [];

        switch (strategy) {
            case VALIDATION_STRATEGIES.REGEX:
                const regexValidation = this.validateRegexParameters(params as RegexParams, fieldName, ruleName);
                errors.push(...regexValidation.errors);
                warnings.push(...regexValidation.warnings);
                break;

            case VALIDATION_STRATEGIES.RANGE:
                const rangeValidation = this.validateRangeParameters(params as RangeParams, fieldName, ruleName);
                errors.push(...rangeValidation.errors);
                warnings.push(...rangeValidation.warnings);
                break;

            case VALIDATION_STRATEGIES.LENGTH:
                const lengthValidation = this.validateLengthParameters(params as LengthParams, fieldName, ruleName);
                errors.push(...lengthValidation.errors);
                warnings.push(...lengthValidation.warnings);
                break;

            case VALIDATION_STRATEGIES.PHONE:
                const phoneValidation = this.validatePhoneParameters(params as PhoneParams, fieldName, ruleName);
                warnings.push(...phoneValidation.warnings);
                break;

            case VALIDATION_STRATEGIES.DATE:
                const dateValidation = this.validateDateParameters(params as DateParams, fieldName, ruleName);
                errors.push(...dateValidation.errors);
                warnings.push(...dateValidation.warnings);
                break;

            case VALIDATION_STRATEGIES.ADDRESS:
                const addressValidation = this.validateAddressParameters(params as AddressParams, fieldName, ruleName);
                warnings.push(...addressValidation.warnings);
                break;

            default:
                // Custom strategy - basic validation only
                if (Object.keys(params).length > VALIDATION_LIMITS.MAX_CUSTOM_PARAMS) {
                    warnings.push({
                        type: 'parameter',
                        field: fieldName,
                        rule: ruleName,
                        message: `Custom strategy has ${Object.keys(params).length} parameters, which may impact performance`,
                        severity: 'warning'
                    });
                }
                break;
        }

        return { errors, warnings };
    }

    /**
     * Validate regex parameters and patterns
     * @param params Regex parameters
     * @param fieldName Field name
     * @param ruleName Rule name
     * @returns Validation results
     */
    private validateRegexParameters(
        params: RegexParams,
        fieldName: string,
        ruleName: string
    ): {
        errors: ConfigValidationError[];
        warnings: ConfigValidationError[];
    } {
        const errors: ConfigValidationError[] = [];
        const warnings: ConfigValidationError[] = [];

        // Validate pattern exists
        if (!params.pattern) {
            errors.push({
                type: 'regex',
                field: fieldName,
                rule: ruleName,
                message: 'Regex pattern is required but not provided',
                severity: 'error'
            });
            return { errors, warnings };
        }

        // Validate pattern length
        if (params.pattern.length > VALIDATION_LIMITS.MAX_REGEX_PATTERN_LENGTH) {
            warnings.push({
                type: 'regex',
                field: fieldName,
                rule: ruleName,
                message: `Regex pattern is very long (${params.pattern.length} characters) and may impact performance`,
                severity: 'warning'
            });
        }

        // Validate regex syntax
        try {
            new RegExp(params.pattern, params.flags);
        } catch (regexError) {
            errors.push({
                type: 'regex',
                field: fieldName,
                rule: ruleName,
                message: `Invalid regex pattern: ${regexError.message}`,
                severity: 'error',
                details: { pattern: params.pattern, flags: params.flags }
            });
            return { errors, warnings };
        }

        // Validate flags
        if (params.flags && !/^[gimsuvy]*$/.test(params.flags)) {
            errors.push({
                type: 'regex',
                field: fieldName,
                rule: ruleName,
                message: `Invalid regex flags: ${params.flags}. Valid flags are: g, i, m, s, u, v, y`,
                severity: 'error'
            });
        }

        // Check for potentially problematic patterns
        if (this.isPotentiallyProblematicRegex(params.pattern)) {
            warnings.push({
                type: 'regex',
                field: fieldName,
                rule: ruleName,
                message: 'Regex pattern may cause performance issues due to complexity',
                severity: 'warning',
                details: { pattern: params.pattern }
            });
        }

        return { errors, warnings };
    }

    /**
     * Validate range parameters
     * @param params Range parameters
     * @param fieldName Field name
     * @param ruleName Rule name
     * @returns Validation results
     */
    private validateRangeParameters(
        params: RangeParams,
        fieldName: string,
        ruleName: string
    ): {
        errors: ConfigValidationError[];
        warnings: ConfigValidationError[];
    } {
        const errors: ConfigValidationError[] = [];
        const warnings: ConfigValidationError[] = [];

        // Check if at least one bound is specified
        if (params.min === undefined && params.max === undefined) {
            errors.push({
                type: 'parameter',
                field: fieldName,
                rule: ruleName,
                message: 'Range validation requires at least min or max value',
                severity: 'error'
            });
            return { errors, warnings };
        }

        // Validate min <= max if both are specified
        if (params.min !== undefined && params.max !== undefined && params.min > params.max) {
            errors.push({
                type: 'parameter',
                field: fieldName,
                rule: ruleName,
                message: `Invalid range: min (${params.min}) is greater than max (${params.max})`,
                severity: 'error'
            });
        }

        // Check for very large ranges that might indicate configuration errors
        if (params.min !== undefined && params.max !== undefined) {
            const range = params.max - params.min;
            if (range > 1000000) {
                warnings.push({
                    type: 'parameter',
                    field: fieldName,
                    rule: ruleName,
                    message: `Very large range (${range}) detected. Please verify this is intentional.`,
                    severity: 'warning'
                });
            }
        }

        return { errors, warnings };
    }

    /**
     * Validate length parameters
     * @param params Length parameters
     * @param fieldName Field name
     * @param ruleName Rule name
     * @returns Validation results
     */
    private validateLengthParameters(
        params: LengthParams,
        fieldName: string,
        ruleName: string
    ): {
        errors: ConfigValidationError[];
        warnings: ConfigValidationError[];
    } {
        const errors: ConfigValidationError[] = [];
        const warnings: ConfigValidationError[] = [];

        // Check if at least one constraint is specified
        if (params.minLength === undefined && params.maxLength === undefined && params.exactLength === undefined) {
            errors.push({
                type: 'parameter',
                field: fieldName,
                rule: ruleName,
                message: 'Length validation requires at least one constraint (minLength, maxLength, or exactLength)',
                severity: 'error'
            });
            return { errors, warnings };
        }

        // Validate minLength <= maxLength if both are specified
        if (params.minLength !== undefined && params.maxLength !== undefined && params.minLength > params.maxLength) {
            errors.push({
                type: 'parameter',
                field: fieldName,
                rule: ruleName,
                message: `Invalid length range: minLength (${params.minLength}) is greater than maxLength (${params.maxLength})`,
                severity: 'error'
            });
        }

        // Check for conflicts with exactLength
        if (params.exactLength !== undefined) {
            if (params.minLength !== undefined && params.minLength !== params.exactLength) {
                warnings.push({
                    type: 'parameter',
                    field: fieldName,
                    rule: ruleName,
                    message: 'exactLength conflicts with minLength. exactLength will take precedence.',
                    severity: 'warning'
                });
            }
            if (params.maxLength !== undefined && params.maxLength !== params.exactLength) {
                warnings.push({
                    type: 'parameter',
                    field: fieldName,
                    rule: ruleName,
                    message: 'exactLength conflicts with maxLength. exactLength will take precedence.',
                    severity: 'warning'
                });
            }
        }

        // Validate non-negative values
        if (params.minLength !== undefined && params.minLength < 0) {
            errors.push({
                type: 'parameter',
                field: fieldName,
                rule: ruleName,
                message: 'minLength cannot be negative',
                severity: 'error'
            });
        }

        if (params.maxLength !== undefined && params.maxLength < 0) {
            errors.push({
                type: 'parameter',
                field: fieldName,
                rule: ruleName,
                message: 'maxLength cannot be negative',
                severity: 'error'
            });
        }

        if (params.exactLength !== undefined && params.exactLength < 0) {
            errors.push({
                type: 'parameter',
                field: fieldName,
                rule: ruleName,
                message: 'exactLength cannot be negative',
                severity: 'error'
            });
        }

        return { errors, warnings };
    }

    /**
     * Validate phone parameters
     * @param params Phone parameters
     * @param fieldName Field name
     * @param ruleName Rule name
     * @returns Validation results
     */
    private validatePhoneParameters(
        params: PhoneParams,
        fieldName: string,
        ruleName: string
    ): {
        warnings: ConfigValidationError[];
    } {
        const warnings: ConfigValidationError[] = [];

        // Phone parameters are mostly boolean flags, so just check for reasonable combinations
        if (params.removeCountryCode && params.allowLandline) {
            warnings.push({
                type: 'parameter',
                field: fieldName,
                rule: ruleName,
                message: 'Removing country code while allowing landlines may cause validation issues',
                severity: 'warning'
            });
        }

        return { warnings };
    }

    /**
     * Validate date parameters
     * @param params Date parameters
     * @param fieldName Field name
     * @param ruleName Rule name
     * @returns Validation results
     */
    private validateDateParameters(
        params: DateParams,
        fieldName: string,
        ruleName: string
    ): {
        errors: ConfigValidationError[];
        warnings: ConfigValidationError[];
    } {
        const errors: ConfigValidationError[] = [];
        const warnings: ConfigValidationError[] = [];

        // Validate year range
        if (params.minYear !== undefined && params.maxYear !== undefined && params.minYear > params.maxYear) {
            errors.push({
                type: 'parameter',
                field: fieldName,
                rule: ruleName,
                message: `Invalid year range: minYear (${params.minYear}) is greater than maxYear (${params.maxYear})`,
                severity: 'error'
            });
        }

        // Validate year values are reasonable
        const currentYear = new Date().getFullYear();
        if (params.minYear !== undefined && (params.minYear < 1000 || params.minYear > currentYear + 100)) {
            warnings.push({
                type: 'parameter',
                field: fieldName,
                rule: ruleName,
                message: `minYear (${params.minYear}) seems unreasonable. Consider if this is correct.`,
                severity: 'warning'
            });
        }

        if (params.maxYear !== undefined && (params.maxYear < 1000 || params.maxYear > currentYear + 100)) {
            warnings.push({
                type: 'parameter',
                field: fieldName,
                rule: ruleName,
                message: `maxYear (${params.maxYear}) seems unreasonable. Consider if this is correct.`,
                severity: 'warning'
            });
        }

        // Validate date formats if provided
        if (params.formats && params.formats.length === 0) {
            warnings.push({
                type: 'parameter',
                field: fieldName,
                rule: ruleName,
                message: 'Empty formats array provided. Default formats will be used.',
                severity: 'warning'
            });
        }

        return { errors, warnings };
    }

    /**
     * Validate address parameters
     * @param params Address parameters
     * @param fieldName Field name
     * @param ruleName Rule name
     * @returns Validation results
     */
    private validateAddressParameters(
        params: AddressParams,
        fieldName: string,
        ruleName: string
    ): {
        warnings: ConfigValidationError[];
    } {
        const warnings: ConfigValidationError[] = [];

        // Address parameters are mostly boolean flags, minimal validation needed
        if (!params.requireProvince && !params.requireCity && !params.requireDistrict) {
            warnings.push({
                type: 'parameter',
                field: fieldName,
                rule: ruleName,
                message: 'No address components are required. This may result in very lenient validation.',
                severity: 'warning'
            });
        }

        return { warnings };
    }

    /**
     * Detect rule conflicts within the configuration
     * @param config Rule configuration
     * @returns Array of detected conflicts
     */
    private async detectRuleConflicts(config: RuleConfiguration): Promise<RuleConflict[]> {
        const conflicts: RuleConflict[] = [];

        for (const [fieldName, rules] of Object.entries(config.fieldRules)) {
            // Check for duplicate strategies
            const strategyCount = new Map<string, string[]>();
            for (const rule of rules) {
                if (!strategyCount.has(rule.strategy)) {
                    strategyCount.set(rule.strategy, []);
                }
                strategyCount.get(rule.strategy)!.push(rule.name);
            }

            // Report duplicate strategies
            for (const [strategy, ruleNames] of Array.from(strategyCount.entries())) {
                if (ruleNames.length > 1) {
                    conflicts.push({
                        field: fieldName,
                        conflictingRules: ruleNames,
                        conflictType: 'duplicate_strategy',
                        description: `Multiple rules use the same strategy '${strategy}' for field '${fieldName}'. This may cause unexpected behavior.`
                    });
                }
            }

            // Check for contradictory parameters
            const contradictoryConflicts = this.detectContradictoryParameters(fieldName, rules);
            conflicts.push(...contradictoryConflicts);

            // Check for logical conflicts
            const logicalConflicts = this.detectLogicalConflicts(fieldName, rules);
            conflicts.push(...logicalConflicts);
        }

        return conflicts;
    }

    /**
     * Detect contradictory parameters between rules
     * @param fieldName Field name
     * @param rules Field rules
     * @returns Array of contradictory conflicts
     */
    private detectContradictoryParameters(fieldName: string, rules: FieldRule[]): RuleConflict[] {
        const conflicts: RuleConflict[] = [];

        // Check for contradictory length constraints
        const lengthRules = rules.filter(rule => rule.strategy === VALIDATION_STRATEGIES.LENGTH);
        if (lengthRules.length > 1) {
            const minLengths: number[] = [];
            const maxLengths: number[] = [];
            const exactLengths: number[] = [];

            for (const rule of lengthRules) {
                const params = rule.params as LengthParams;
                if (params.minLength !== undefined) minLengths.push(params.minLength);
                if (params.maxLength !== undefined) maxLengths.push(params.maxLength);
                if (params.exactLength !== undefined) exactLengths.push(params.exactLength);
            }

            // Check for conflicting exact lengths
            if (exactLengths.length > 1 && new Set(exactLengths).size > 1) {
                conflicts.push({
                    field: fieldName,
                    conflictingRules: lengthRules.map(r => r.name),
                    conflictType: 'contradictory_params',
                    description: `Multiple length rules specify different exact lengths: ${exactLengths.join(', ')}`
                });
            }

            // Check for impossible ranges
            if (minLengths.length > 0 && maxLengths.length > 0) {
                const maxMin = Math.max(...minLengths);
                const minMax = Math.min(...maxLengths);
                if (maxMin > minMax) {
                    conflicts.push({
                        field: fieldName,
                        conflictingRules: lengthRules.map(r => r.name),
                        conflictType: 'contradictory_params',
                        description: `Length constraints create impossible range: min ${maxMin} > max ${minMax}`
                    });
                }
            }
        }

        // Check for contradictory range constraints
        const rangeRules = rules.filter(rule => rule.strategy === VALIDATION_STRATEGIES.RANGE);
        if (rangeRules.length > 1) {
            const minValues: number[] = [];
            const maxValues: number[] = [];

            for (const rule of rangeRules) {
                const params = rule.params as RangeParams;
                if (params.min !== undefined) minValues.push(params.min);
                if (params.max !== undefined) maxValues.push(params.max);
            }

            if (minValues.length > 0 && maxValues.length > 0) {
                const maxMin = Math.max(...minValues);
                const minMax = Math.min(...maxValues);
                if (maxMin > minMax) {
                    conflicts.push({
                        field: fieldName,
                        conflictingRules: rangeRules.map(r => r.name),
                        conflictType: 'contradictory_params',
                        description: `Range constraints create impossible range: min ${maxMin} > max ${minMax}`
                    });
                }
            }
        }

        return conflicts;
    }

    /**
     * Detect logical conflicts between rules
     * @param fieldName Field name
     * @param rules Field rules
     * @returns Array of logical conflicts
     */
    private detectLogicalConflicts(fieldName: string, rules: FieldRule[]): RuleConflict[] {
        const conflicts: RuleConflict[] = [];

        // Check for conflicting regex patterns
        const regexRules = rules.filter(rule => rule.strategy === VALIDATION_STRATEGIES.REGEX);
        if (regexRules.length > 1) {
            // This is a simplified check - in practice, detecting regex conflicts is complex
            const patterns = regexRules.map(rule => (rule.params as RegexParams).pattern);
            const uniquePatterns = new Set(patterns);

            if (patterns.length !== uniquePatterns.size) {
                // Duplicate patterns found
                const duplicateRules = regexRules.filter((rule, index) =>
                    patterns.indexOf((rule.params as RegexParams).pattern) !== index
                );

                if (duplicateRules.length > 0) {
                    conflicts.push({
                        field: fieldName,
                        conflictingRules: duplicateRules.map(r => r.name),
                        conflictType: 'logical_conflict',
                        description: 'Multiple regex rules with identical patterns detected'
                    });
                }
            }
        }

        // Check for required vs optional conflicts
        const requiredRules = rules.filter(rule => rule.required);
        const optionalRules = rules.filter(rule => !rule.required);

        if (requiredRules.length > 0 && optionalRules.length > 0) {
            // This is actually not a conflict, but worth noting
            // We could add a warning here if needed
        }

        return conflicts;
    }

    /**
     * Validate semantic rules and business logic
     * @param config Rule configuration
     * @returns Semantic validation results
     */
    private async validateSemanticRules(config: RuleConfiguration): Promise<{
        errors: ConfigValidationError[];
        warnings: ConfigValidationError[];
    }> {
        const errors: ConfigValidationError[] = [];
        const warnings: ConfigValidationError[] = [];

        // Validate metadata consistency
        if (config.metadata.priority < VALIDATION_LIMITS.MIN_PRIORITY ||
            config.metadata.priority > VALIDATION_LIMITS.MAX_PRIORITY) {
            warnings.push({
                type: 'parameter',
                message: `Priority ${config.metadata.priority} is outside recommended range (${VALIDATION_LIMITS.MIN_PRIORITY}-${VALIDATION_LIMITS.MAX_PRIORITY})`,
                severity: 'warning'
            });
        }

        // Validate global settings consistency
        if (config.globalSettings.maxErrors <= 0) {
            errors.push({
                type: 'parameter',
                message: 'maxErrors must be greater than 0',
                severity: 'error'
            });
        }

        if (config.globalSettings.maxErrors > 1000) {
            warnings.push({
                type: 'parameter',
                message: `maxErrors (${config.globalSettings.maxErrors}) is very high and may impact performance`,
                severity: 'warning'
            });
        }

        // Check for empty field rules
        if (Object.keys(config.fieldRules).length === 0) {
            warnings.push({
                type: 'field',
                message: 'No field rules defined. Configuration will have no effect.',
                severity: 'warning'
            });
        }

        return { errors, warnings };
    }

    /**
     * Create a comprehensive validation result
     * @param success Overall validation success
     * @param errors Validation errors
     * @param warnings Validation warnings
     * @param conflicts Rule conflicts
     * @param validatedFields Successfully validated fields
     * @param config Original configuration
     * @returns Complete validation result
     */
    private createValidationResult(
        success: boolean,
        errors: ConfigValidationError[],
        warnings: ConfigValidationError[],
        conflicts: RuleConflict[],
        validatedFields: string[],
        config: any
    ): ConfigValidationResult {
        const totalRules: number = (config && config.fieldRules) ?
            (Object.values(config.fieldRules) as any[]).reduce((sum: number, rules: any) => {
                return sum + (Array.isArray(rules) ? rules.length : 0);
            }, 0) : 0;

        return {
            success,
            value: success ? config : undefined,
            error: success ? undefined : `Configuration validation failed with ${errors.length} errors`,
            errorCode: success ? undefined : ValidationErrorType.CONFIGURATION_ERROR,
            errors,
            warnings,
            conflicts,
            validatedFields,
            summary: {
                totalFields: validatedFields.length,
                totalRules,
                errorCount: errors.length,
                warningCount: warnings.length,
                conflictCount: conflicts.length
            },
            metadata: {
                validationTimestamp: new Date().toISOString(),
                validatorVersion: '1.0.0'
            }
        };
    }

    /**
     * Check if a field name is valid
     * @param fieldName Field name to validate
     * @returns True if valid, false otherwise
     */
    private isValidFieldName(fieldName: string): boolean {
        // Field names can be English (start with letter, contain letters/numbers/underscores) 
        // or Chinese characters, or mixed
        if (!fieldName || fieldName.trim().length === 0) {
            return false;
        }

        // Allow Chinese characters, English letters, numbers, underscores, and common punctuation
        // Chinese characters: \u4e00-\u9fff
        // Allow field names like: "name", "姓名", "phone_number", "手机号", "user_id", etc.
        return /^[\u4e00-\u9fffa-zA-Z][\u4e00-\u9fffa-zA-Z0-9_\s]*$/.test(fieldName.trim());
    }

    /**
     * Check if a strategy is valid
     * @param strategy Strategy name to validate
     * @returns True if valid, false otherwise
     */
    private isValidStrategy(strategy: string): boolean {
        return Object.values(VALIDATION_STRATEGIES).includes(strategy as any);
    }

    /**
     * Check if a regex pattern is potentially problematic
     * @param pattern Regex pattern to check
     * @returns True if potentially problematic, false otherwise
     */
    private isPotentiallyProblematicRegex(pattern: string): boolean {
        // Check for patterns that might cause catastrophic backtracking
        const problematicPatterns = [
            /\(\?\!\.\*\)/,  // Negative lookahead with .*
            /\(\.\*\)\+/,    // .* followed by +
            /\(\.\*\)\*/,    // .* followed by *
            /\(\.\+\)\+/,    // .+ followed by +
            /\(\.\+\)\*/,    // .+ followed by *
        ];

        return problematicPatterns.some(problematic => problematic.test(pattern)) ||
            pattern.length > 200 || // Very long patterns
            (pattern.match(/\(/g) || []).length > 10; // Too many groups
    }
}
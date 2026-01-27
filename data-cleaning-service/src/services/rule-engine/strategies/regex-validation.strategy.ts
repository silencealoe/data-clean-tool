import { Logger } from '@nestjs/common';
import {
    ValidationStrategy,
    ValidationResult,
    ValidationParams,
    RegexParams,
    ValidationError,
    ValidationErrorType
} from '../../../common/types/rule-engine.types';
import { VALIDATION_STRATEGIES, DEFAULT_ERROR_MESSAGES } from '../../../common/constants/rule-engine.constants';

/**
 * Regular Expression Validation Strategy
 * 
 * Validates field values against regular expression patterns.
 * Supports pattern flags and multiline mode.
 * 
 * Requirements: 需求 1.2
 */
export class RegexValidationStrategy implements ValidationStrategy<string> {
    readonly name = VALIDATION_STRATEGIES.REGEX;
    readonly description = '正则表达式验证策略，用于验证字段值是否匹配指定的正则表达式模式';

    private readonly logger = new Logger(RegexValidationStrategy.name);

    /**
     * Execute regex validation logic
     * @param value The value to validate
     * @param params Regex validation parameters
     * @returns Validation result
     */
    validate(value: any, params: ValidationParams): ValidationResult<string> {
        const regexParams = params as RegexParams;

        // Validate parameters first
        if (!this.validateParams(regexParams)) {
            return {
                success: false,
                error: DEFAULT_ERROR_MESSAGES.CONFIGURATION_ERROR,
                errorCode: ValidationErrorType.CONFIGURATION_ERROR,
                metadata: { strategy: this.name, params: regexParams }
            };
        }

        // Handle null/undefined values
        if (value === null || value === undefined) {
            return {
                success: false,
                error: DEFAULT_ERROR_MESSAGES.REQUIRED_FIELD_MISSING,
                errorCode: ValidationErrorType.REQUIRED_FIELD_MISSING,
                metadata: { strategy: this.name, originalValue: value }
            };
        }

        // Convert value to string for regex validation
        const stringValue = String(value);

        try {
            // Create regex with flags
            const flags = regexParams.flags || '';
            const regex = new RegExp(regexParams.pattern, flags);

            // Test the pattern
            const isMatch = regex.test(stringValue);

            if (isMatch) {
                return {
                    success: true,
                    value: stringValue,
                    metadata: {
                        strategy: this.name,
                        pattern: regexParams.pattern,
                        flags: flags,
                        originalValue: value
                    }
                };
            } else {
                return {
                    success: false,
                    error: DEFAULT_ERROR_MESSAGES.INVALID_FORMAT,
                    errorCode: ValidationErrorType.INVALID_FORMAT,
                    metadata: {
                        strategy: this.name,
                        pattern: regexParams.pattern,
                        flags: flags,
                        originalValue: value,
                        stringValue: stringValue
                    }
                };
            }
        } catch (error) {
            this.logger.error(`Regex validation error: ${error.message}`, {
                pattern: regexParams.pattern,
                flags: regexParams.flags,
                value: stringValue
            });

            return {
                success: false,
                error: DEFAULT_ERROR_MESSAGES.REGEX_PATTERN_INVALID,
                errorCode: ValidationErrorType.PROCESSING_ERROR,
                metadata: {
                    strategy: this.name,
                    pattern: regexParams.pattern,
                    originalValue: value,
                    error: error.message
                }
            };
        }
    }

    /**
     * Validate if parameters are valid for regex strategy
     * @param params Validation parameters
     * @returns True if parameters are valid, false otherwise
     */
    validateParams(params: ValidationParams): boolean {
        if (!params) {
            this.logger.error('Regex validation parameters are required');
            return false;
        }

        const regexParams = params as RegexParams;

        // Pattern is required
        if (!regexParams.pattern || typeof regexParams.pattern !== 'string') {
            this.logger.error('Regex pattern must be a non-empty string');
            return false;
        }

        // Validate pattern length
        if (regexParams.pattern.length > 1000) {
            this.logger.error('Regex pattern is too long (max 1000 characters)');
            return false;
        }

        // Validate flags if provided
        if (regexParams.flags !== undefined) {
            if (typeof regexParams.flags !== 'string') {
                this.logger.error('Regex flags must be a string');
                return false;
            }

            // Check for valid regex flags
            const validFlags = /^[gimsuvy]*$/;
            if (!validFlags.test(regexParams.flags)) {
                this.logger.error('Invalid regex flags provided');
                return false;
            }
        }

        // Validate multiline flag if provided
        if (regexParams.multiline !== undefined && typeof regexParams.multiline !== 'boolean') {
            this.logger.error('Multiline flag must be a boolean');
            return false;
        }

        // Test if the pattern is valid by creating a regex
        try {
            new RegExp(regexParams.pattern, regexParams.flags || '');
        } catch (error) {
            this.logger.error(`Invalid regex pattern: ${error.message}`);
            return false;
        }

        return true;
    }
}
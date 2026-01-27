import { Logger } from '@nestjs/common';
import {
    ValidationStrategy,
    ValidationResult,
    ValidationParams,
    LengthParams,
    ValidationError,
    ValidationErrorType
} from '../../../common/types/rule-engine.types';
import { VALIDATION_STRATEGIES, DEFAULT_ERROR_MESSAGES } from '../../../common/constants/rule-engine.constants';

/**
 * Length Validation Strategy
 * 
 * Validates that string field values meet specified length constraints.
 * Supports minimum length, maximum length, and exact length validation.
 * 
 * Requirements: 需求 1.4
 */
export class LengthValidationStrategy implements ValidationStrategy<string> {
    readonly name = VALIDATION_STRATEGIES.LENGTH;
    readonly description = '长度验证策略，用于验证字符串字段是否符合指定的长度约束';

    private readonly logger = new Logger(LengthValidationStrategy.name);

    /**
     * Execute length validation logic
     * @param value The value to validate
     * @param params Length validation parameters
     * @returns Validation result
     */
    validate(value: any, params: ValidationParams): ValidationResult<string> {
        const lengthParams = params as LengthParams;

        // Validate parameters first
        if (!this.validateParams(lengthParams)) {
            return {
                success: false,
                error: DEFAULT_ERROR_MESSAGES.CONFIGURATION_ERROR,
                errorCode: ValidationErrorType.CONFIGURATION_ERROR,
                metadata: { strategy: this.name, params: lengthParams }
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

        // Convert value to string for length validation
        const stringValue = String(value);
        const actualLength = stringValue.length;

        // Check exact length constraint first (takes precedence)
        if (lengthParams.exactLength !== undefined) {
            if (actualLength === lengthParams.exactLength) {
                return {
                    success: true,
                    value: stringValue,
                    metadata: {
                        strategy: this.name,
                        originalValue: value,
                        actualLength: actualLength,
                        exactLength: lengthParams.exactLength
                    }
                };
            } else {
                return {
                    success: false,
                    error: DEFAULT_ERROR_MESSAGES.LENGTH_CONSTRAINT_VIOLATED,
                    errorCode: ValidationErrorType.INVALID_FORMAT,
                    metadata: {
                        strategy: this.name,
                        originalValue: value,
                        actualLength: actualLength,
                        exactLength: lengthParams.exactLength,
                        violation: 'exact_length'
                    }
                };
            }
        }

        // Check minimum length constraint
        if (lengthParams.minLength !== undefined) {
            if (actualLength < lengthParams.minLength) {
                return {
                    success: false,
                    error: DEFAULT_ERROR_MESSAGES.LENGTH_CONSTRAINT_VIOLATED,
                    errorCode: ValidationErrorType.INVALID_FORMAT,
                    metadata: {
                        strategy: this.name,
                        originalValue: value,
                        actualLength: actualLength,
                        minLength: lengthParams.minLength,
                        violation: 'minimum_length'
                    }
                };
            }
        }

        // Check maximum length constraint
        if (lengthParams.maxLength !== undefined) {
            if (actualLength > lengthParams.maxLength) {
                return {
                    success: false,
                    error: DEFAULT_ERROR_MESSAGES.LENGTH_CONSTRAINT_VIOLATED,
                    errorCode: ValidationErrorType.INVALID_FORMAT,
                    metadata: {
                        strategy: this.name,
                        originalValue: value,
                        actualLength: actualLength,
                        maxLength: lengthParams.maxLength,
                        violation: 'maximum_length'
                    }
                };
            }
        }

        // All length constraints satisfied
        return {
            success: true,
            value: stringValue,
            metadata: {
                strategy: this.name,
                originalValue: value,
                actualLength: actualLength,
                minLength: lengthParams.minLength,
                maxLength: lengthParams.maxLength
            }
        };
    }

    /**
     * Validate if parameters are valid for length strategy
     * @param params Validation parameters
     * @returns True if parameters are valid, false otherwise
     */
    validateParams(params: ValidationParams): boolean {
        if (!params) {
            this.logger.error('Length validation parameters are required');
            return false;
        }

        const lengthParams = params as LengthParams;

        // At least one constraint must be specified
        if (lengthParams.minLength === undefined &&
            lengthParams.maxLength === undefined &&
            lengthParams.exactLength === undefined) {
            this.logger.error('At least one length constraint must be specified');
            return false;
        }

        // Validate minLength if provided
        if (lengthParams.minLength !== undefined) {
            if (!Number.isInteger(lengthParams.minLength) || lengthParams.minLength < 0) {
                this.logger.error('MinLength must be a non-negative integer');
                return false;
            }
        }

        // Validate maxLength if provided
        if (lengthParams.maxLength !== undefined) {
            if (!Number.isInteger(lengthParams.maxLength) || lengthParams.maxLength < 0) {
                this.logger.error('MaxLength must be a non-negative integer');
                return false;
            }
        }

        // Validate exactLength if provided
        if (lengthParams.exactLength !== undefined) {
            if (!Number.isInteger(lengthParams.exactLength) || lengthParams.exactLength < 0) {
                this.logger.error('ExactLength must be a non-negative integer');
                return false;
            }

            // exactLength cannot be used with min/max length
            if (lengthParams.minLength !== undefined || lengthParams.maxLength !== undefined) {
                this.logger.error('ExactLength cannot be used together with minLength or maxLength');
                return false;
            }
        }

        // Validate that minLength <= maxLength if both are provided
        if (lengthParams.minLength !== undefined && lengthParams.maxLength !== undefined) {
            if (lengthParams.minLength > lengthParams.maxLength) {
                this.logger.error('MinLength cannot be greater than maxLength');
                return false;
            }
        }

        // Validate reasonable length limits
        const maxReasonableLength = 1000000; // 1 million characters

        if (lengthParams.minLength !== undefined && lengthParams.minLength > maxReasonableLength) {
            this.logger.error(`MinLength is too large (max: ${maxReasonableLength})`);
            return false;
        }

        if (lengthParams.maxLength !== undefined && lengthParams.maxLength > maxReasonableLength) {
            this.logger.error(`MaxLength is too large (max: ${maxReasonableLength})`);
            return false;
        }

        if (lengthParams.exactLength !== undefined && lengthParams.exactLength > maxReasonableLength) {
            this.logger.error(`ExactLength is too large (max: ${maxReasonableLength})`);
            return false;
        }

        return true;
    }
}
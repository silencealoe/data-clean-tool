import { Logger } from '@nestjs/common';
import {
    ValidationStrategy,
    ValidationResult,
    ValidationParams,
    RangeParams,
    ValidationError,
    ValidationErrorType
} from '../../../common/types/rule-engine.types';
import { VALIDATION_STRATEGIES, DEFAULT_ERROR_MESSAGES } from '../../../common/constants/rule-engine.constants';

/**
 * Range Validation Strategy
 * 
 * Validates that numeric field values fall within specified minimum and maximum bounds.
 * Supports inclusive and exclusive range validation.
 * 
 * Requirements: 需求 1.3
 */
export class RangeValidationStrategy implements ValidationStrategy<number> {
    readonly name = VALIDATION_STRATEGIES.RANGE;
    readonly description = '范围验证策略，用于验证数值字段是否在指定的最小值和最大值范围内';

    private readonly logger = new Logger(RangeValidationStrategy.name);

    /**
     * Execute range validation logic
     * @param value The value to validate
     * @param params Range validation parameters
     * @returns Validation result
     */
    validate(value: any, params: ValidationParams): ValidationResult<number> {
        const rangeParams = params as RangeParams;

        // Validate parameters first
        if (!this.validateParams(rangeParams)) {
            return {
                success: false,
                error: DEFAULT_ERROR_MESSAGES.CONFIGURATION_ERROR,
                errorCode: ValidationErrorType.CONFIGURATION_ERROR,
                metadata: { strategy: this.name, params: rangeParams }
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

        // Convert value to number
        let numericValue: number;

        if (typeof value === 'number') {
            numericValue = value;
        } else if (typeof value === 'string') {
            numericValue = parseFloat(value);
        } else {
            return {
                success: false,
                error: DEFAULT_ERROR_MESSAGES.INVALID_FORMAT,
                errorCode: ValidationErrorType.INVALID_FORMAT,
                metadata: {
                    strategy: this.name,
                    originalValue: value,
                    error: 'Value cannot be converted to number'
                }
            };
        }

        // Check if conversion was successful
        if (isNaN(numericValue)) {
            return {
                success: false,
                error: DEFAULT_ERROR_MESSAGES.INVALID_FORMAT,
                errorCode: ValidationErrorType.INVALID_FORMAT,
                metadata: {
                    strategy: this.name,
                    originalValue: value,
                    error: 'Value is not a valid number'
                }
            };
        }

        // Check if value is finite
        if (!isFinite(numericValue)) {
            return {
                success: false,
                error: DEFAULT_ERROR_MESSAGES.INVALID_FORMAT,
                errorCode: ValidationErrorType.INVALID_FORMAT,
                metadata: {
                    strategy: this.name,
                    originalValue: value,
                    numericValue: numericValue,
                    error: 'Value must be a finite number'
                }
            };
        }

        // Perform range validation
        const inclusive = rangeParams.inclusive !== false; // Default to true
        const { min, max } = rangeParams;

        // Check minimum bound
        if (min !== undefined) {
            const withinMinBound = inclusive ? numericValue >= min : numericValue > min;
            if (!withinMinBound) {
                return {
                    success: false,
                    error: DEFAULT_ERROR_MESSAGES.OUT_OF_RANGE,
                    errorCode: ValidationErrorType.OUT_OF_RANGE,
                    metadata: {
                        strategy: this.name,
                        originalValue: value,
                        numericValue: numericValue,
                        min: min,
                        inclusive: inclusive,
                        violation: 'minimum'
                    }
                };
            }
        }

        // Check maximum bound
        if (max !== undefined) {
            const withinMaxBound = inclusive ? numericValue <= max : numericValue < max;
            if (!withinMaxBound) {
                return {
                    success: false,
                    error: DEFAULT_ERROR_MESSAGES.OUT_OF_RANGE,
                    errorCode: ValidationErrorType.OUT_OF_RANGE,
                    metadata: {
                        strategy: this.name,
                        originalValue: value,
                        numericValue: numericValue,
                        max: max,
                        inclusive: inclusive,
                        violation: 'maximum'
                    }
                };
            }
        }

        // Value is within range
        return {
            success: true,
            value: numericValue,
            metadata: {
                strategy: this.name,
                originalValue: value,
                min: min,
                max: max,
                inclusive: inclusive
            }
        };
    }

    /**
     * Validate if parameters are valid for range strategy
     * @param params Validation parameters
     * @returns True if parameters are valid, false otherwise
     */
    validateParams(params: ValidationParams): boolean {
        if (!params) {
            this.logger.error('Range validation parameters are required');
            return false;
        }

        const rangeParams = params as RangeParams;

        // At least one bound must be specified
        if (rangeParams.min === undefined && rangeParams.max === undefined) {
            this.logger.error('At least one of min or max must be specified for range validation');
            return false;
        }

        // Validate min if provided
        if (rangeParams.min !== undefined) {
            if (typeof rangeParams.min !== 'number' || !isFinite(rangeParams.min)) {
                this.logger.error('Min value must be a finite number');
                return false;
            }
        }

        // Validate max if provided
        if (rangeParams.max !== undefined) {
            if (typeof rangeParams.max !== 'number' || !isFinite(rangeParams.max)) {
                this.logger.error('Max value must be a finite number');
                return false;
            }
        }

        // Validate inclusive flag if provided
        if (rangeParams.inclusive !== undefined && typeof rangeParams.inclusive !== 'boolean') {
            this.logger.error('Inclusive flag must be a boolean');
            return false;
        }

        // Validate that min <= max if both are provided
        if (rangeParams.min !== undefined && rangeParams.max !== undefined) {
            if (rangeParams.min > rangeParams.max) {
                this.logger.error('Min value cannot be greater than max value');
                return false;
            }
        }

        return true;
    }
}
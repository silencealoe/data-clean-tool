import { Injectable, Logger } from '@nestjs/common';
import {
    ValidationStrategy,
    ValidationResult,
    ValidationParams,
    DateParams,
    ValidationError,
    ValidationErrorType
} from '../../../common/types/rule-engine.types';
import { VALIDATION_STRATEGIES, DEFAULT_ERROR_MESSAGES } from '../../../common/constants/rule-engine.constants';
import { DateCleanerService } from '../../date-cleaner.service';

/**
 * Date Cleaner Strategy - Compatibility Adapter
 * 
 * Wraps the existing DateCleanerService to work with the rule engine.
 * Provides backward compatibility while enabling rule-based configuration.
 * 
 * Requirements: 需求 5.1, 5.2
 */
@Injectable()
export class DateCleanerStrategy implements ValidationStrategy<string> {
    readonly name = VALIDATION_STRATEGIES.DATE_CLEANER;
    readonly description = '日期清洗策略，兼容现有DateCleanerService的功能';

    private readonly logger = new Logger(DateCleanerStrategy.name);

    constructor(private readonly dateCleanerService: DateCleanerService) { }

    /**
     * Execute date cleaning logic using the existing DateCleanerService
     * @param value The value to validate and clean
     * @param params Date validation parameters
     * @returns Validation result
     */
    validate(value: any, params: ValidationParams): ValidationResult<string> {
        const dateParams = params as DateParams;

        // Validate parameters first
        if (!this.validateParams(dateParams)) {
            return {
                success: false,
                error: DEFAULT_ERROR_MESSAGES.CONFIGURATION_ERROR,
                errorCode: ValidationErrorType.CONFIGURATION_ERROR,
                metadata: { strategy: this.name, params: dateParams }
            };
        }

        try {
            // Use the existing DateCleanerService
            const cleanResult = this.dateCleanerService.cleanDate(value);

            if (cleanResult.success) {
                // The DateCleanerService already handles format standardization
                // Additional parameter-based validation can be added here if needed
                const cleanedValue = cleanResult.value!;

                // Validate against custom year range if specified
                if (dateParams.minYear || dateParams.maxYear) {
                    const dateObj = new Date(cleanedValue);
                    const year = dateObj.getFullYear();

                    if (dateParams.minYear && year < dateParams.minYear) {
                        return {
                            success: false,
                            error: `Date year ${year} is below minimum allowed year ${dateParams.minYear}`,
                            errorCode: ValidationErrorType.OUT_OF_RANGE,
                            metadata: {
                                strategy: this.name,
                                originalValue: value,
                                cleanedValue,
                                year,
                                minYear: dateParams.minYear
                            }
                        };
                    }

                    if (dateParams.maxYear && year > dateParams.maxYear) {
                        return {
                            success: false,
                            error: `Date year ${year} is above maximum allowed year ${dateParams.maxYear}`,
                            errorCode: ValidationErrorType.OUT_OF_RANGE,
                            metadata: {
                                strategy: this.name,
                                originalValue: value,
                                cleanedValue,
                                year,
                                maxYear: dateParams.maxYear
                            }
                        };
                    }
                }

                return {
                    success: true,
                    value: cleanedValue,
                    metadata: {
                        strategy: this.name,
                        originalValue: value,
                        appliedParams: dateParams,
                        legacyService: 'DateCleanerService'
                    }
                };
            } else {
                // Convert legacy error to rule engine format
                return {
                    success: false,
                    error: cleanResult.error || DEFAULT_ERROR_MESSAGES.INVALID_FORMAT,
                    errorCode: ValidationErrorType.INVALID_FORMAT,
                    metadata: {
                        strategy: this.name,
                        originalValue: value,
                        legacyService: 'DateCleanerService',
                        legacyError: cleanResult.error
                    }
                };
            }
        } catch (error) {
            this.logger.error(`Date cleaning strategy error: ${error.message}`, {
                value,
                params: dateParams,
                error: error.stack
            });

            return {
                success: false,
                error: DEFAULT_ERROR_MESSAGES.PROCESSING_ERROR,
                errorCode: ValidationErrorType.PROCESSING_ERROR,
                metadata: {
                    strategy: this.name,
                    originalValue: value,
                    error: error.message
                }
            };
        }
    }

    /**
     * Validate if parameters are valid for date cleaner strategy
     * @param params Validation parameters
     * @returns True if parameters are valid, false otherwise
     */
    validateParams(params: ValidationParams): boolean {
        if (!params) {
            // Date cleaner can work without parameters (use defaults)
            return true;
        }

        const dateParams = params as DateParams;

        // Validate formats array if provided
        if (dateParams.formats !== undefined) {
            if (!Array.isArray(dateParams.formats)) {
                this.logger.error('formats parameter must be an array');
                return false;
            }

            for (const format of dateParams.formats) {
                if (typeof format !== 'string') {
                    this.logger.error('All format entries must be strings');
                    return false;
                }
            }
        }

        // Validate year range parameters
        if (dateParams.minYear !== undefined) {
            if (typeof dateParams.minYear !== 'number' || !Number.isInteger(dateParams.minYear)) {
                this.logger.error('minYear parameter must be an integer');
                return false;
            }

            if (dateParams.minYear < 1000 || dateParams.minYear > 9999) {
                this.logger.error('minYear must be a valid 4-digit year');
                return false;
            }
        }

        if (dateParams.maxYear !== undefined) {
            if (typeof dateParams.maxYear !== 'number' || !Number.isInteger(dateParams.maxYear)) {
                this.logger.error('maxYear parameter must be an integer');
                return false;
            }

            if (dateParams.maxYear < 1000 || dateParams.maxYear > 9999) {
                this.logger.error('maxYear must be a valid 4-digit year');
                return false;
            }
        }

        // Validate year range consistency
        if (dateParams.minYear !== undefined && dateParams.maxYear !== undefined) {
            if (dateParams.minYear > dateParams.maxYear) {
                this.logger.error('minYear cannot be greater than maxYear');
                return false;
            }
        }

        // Validate timezone parameter
        if (dateParams.timezone !== undefined && typeof dateParams.timezone !== 'string') {
            this.logger.error('timezone parameter must be a string');
            return false;
        }

        return true;
    }
}
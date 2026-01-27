import { Injectable, Logger } from '@nestjs/common';
import {
    ValidationStrategy,
    ValidationResult,
    ValidationParams,
    PhoneParams,
    ValidationError,
    ValidationErrorType
} from '../../../common/types/rule-engine.types';
import { VALIDATION_STRATEGIES, DEFAULT_ERROR_MESSAGES } from '../../../common/constants/rule-engine.constants';
import { PhoneCleanerService } from '../../phone-cleaner.service';

/**
 * Phone Cleaner Strategy - Compatibility Adapter
 * 
 * Wraps the existing PhoneCleanerService to work with the rule engine.
 * Provides backward compatibility while enabling rule-based configuration.
 * 
 * Requirements: 需求 5.1, 5.2
 */
@Injectable()
export class PhoneCleanerStrategy implements ValidationStrategy<string> {
    readonly name = VALIDATION_STRATEGIES.PHONE_CLEANER;
    readonly description = '手机号清洗策略，兼容现有PhoneCleanerService的功能';

    private readonly logger = new Logger(PhoneCleanerStrategy.name);

    constructor(private readonly phoneCleanerService: PhoneCleanerService) { }

    /**
     * Execute phone cleaning logic using the existing PhoneCleanerService
     * @param value The value to validate and clean
     * @param params Phone validation parameters
     * @returns Validation result
     */
    validate(value: any, params: ValidationParams): ValidationResult<string> {
        const phoneParams = params as PhoneParams;

        // Validate parameters first
        if (!this.validateParams(phoneParams)) {
            return {
                success: false,
                error: DEFAULT_ERROR_MESSAGES.CONFIGURATION_ERROR,
                errorCode: ValidationErrorType.CONFIGURATION_ERROR,
                metadata: { strategy: this.name, params: phoneParams }
            };
        }

        try {
            // Use the existing PhoneCleanerService
            const cleanResult = this.phoneCleanerService.cleanPhone(value);

            if (cleanResult.success) {
                // Apply additional cleaning based on parameters
                let cleanedValue = cleanResult.value!;

                // Apply parameter-based post-processing
                if (phoneParams.removeSpaces) {
                    cleanedValue = cleanedValue.replace(/\s/g, '');
                }

                if (phoneParams.removeDashes) {
                    cleanedValue = cleanedValue.replace(/-/g, '');
                }

                if (phoneParams.removeCountryCode) {
                    // Remove +86 country code if present
                    cleanedValue = cleanedValue.replace(/^\+86/, '');
                }

                return {
                    success: true,
                    value: cleanedValue,
                    metadata: {
                        strategy: this.name,
                        originalValue: value,
                        appliedParams: phoneParams,
                        legacyService: 'PhoneCleanerService'
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
                        legacyService: 'PhoneCleanerService',
                        legacyError: cleanResult.error
                    }
                };
            }
        } catch (error) {
            this.logger.error(`Phone cleaning strategy error: ${error.message}`, {
                value,
                params: phoneParams,
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
     * Validate if parameters are valid for phone cleaner strategy
     * @param params Validation parameters
     * @returns True if parameters are valid, false otherwise
     */
    validateParams(params: ValidationParams): boolean {
        if (!params) {
            // Phone cleaner can work without parameters (use defaults)
            return true;
        }

        const phoneParams = params as PhoneParams;

        // Validate boolean parameters
        if (phoneParams.removeSpaces !== undefined && typeof phoneParams.removeSpaces !== 'boolean') {
            this.logger.error('removeSpaces parameter must be a boolean');
            return false;
        }

        if (phoneParams.removeDashes !== undefined && typeof phoneParams.removeDashes !== 'boolean') {
            this.logger.error('removeDashes parameter must be a boolean');
            return false;
        }

        if (phoneParams.removeCountryCode !== undefined && typeof phoneParams.removeCountryCode !== 'boolean') {
            this.logger.error('removeCountryCode parameter must be a boolean');
            return false;
        }

        if (phoneParams.allowLandline !== undefined && typeof phoneParams.allowLandline !== 'boolean') {
            this.logger.error('allowLandline parameter must be a boolean');
            return false;
        }

        return true;
    }
}
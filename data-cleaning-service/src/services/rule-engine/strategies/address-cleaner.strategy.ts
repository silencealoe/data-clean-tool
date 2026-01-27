import { Injectable, Logger } from '@nestjs/common';
import {
    ValidationStrategy,
    ValidationResult,
    ValidationParams,
    AddressParams,
    ValidationError,
    ValidationErrorType
} from '../../../common/types/rule-engine.types';
import { VALIDATION_STRATEGIES, DEFAULT_ERROR_MESSAGES } from '../../../common/constants/rule-engine.constants';
import { AddressCleanerService } from '../../address-cleaner.service';
import { AddressComponents } from '../../../common/types';

/**
 * Address Cleaner Strategy - Compatibility Adapter
 * 
 * Wraps the existing AddressCleanerService to work with the rule engine.
 * Provides backward compatibility while enabling rule-based configuration.
 * 
 * Requirements: 需求 5.1, 5.2
 */
@Injectable()
export class AddressCleanerStrategy implements ValidationStrategy<AddressComponents> {
    readonly name = VALIDATION_STRATEGIES.ADDRESS_CLEANER;
    readonly description = '地址清洗策略，兼容现有AddressCleanerService的功能';

    private readonly logger = new Logger(AddressCleanerStrategy.name);

    constructor(private readonly addressCleanerService: AddressCleanerService) { }

    /**
     * Execute address cleaning logic using the existing AddressCleanerService
     * @param value The value to validate and clean
     * @param params Address validation parameters
     * @returns Validation result
     */
    validate(value: any, params: ValidationParams): ValidationResult<AddressComponents> {
        const addressParams = params as AddressParams;

        // Validate parameters first
        if (!this.validateParams(addressParams)) {
            return {
                success: false,
                error: DEFAULT_ERROR_MESSAGES.CONFIGURATION_ERROR,
                errorCode: ValidationErrorType.CONFIGURATION_ERROR,
                metadata: { strategy: this.name, params: addressParams }
            };
        }

        try {
            // Use the existing AddressCleanerService
            const cleanResult = this.addressCleanerService.cleanAddress(value);

            if (cleanResult.success) {
                const addressComponents = cleanResult.value!;

                // Apply parameter-based validation
                if (addressParams.requireProvince !== false && !addressComponents.province) {
                    return {
                        success: false,
                        error: 'Province is required but not found in address',
                        errorCode: ValidationErrorType.REQUIRED_FIELD_MISSING,
                        metadata: {
                            strategy: this.name,
                            originalValue: value,
                            addressComponents,
                            missingComponent: 'province'
                        }
                    };
                }

                if (addressParams.requireCity !== false && !addressComponents.city) {
                    return {
                        success: false,
                        error: 'City is required but not found in address',
                        errorCode: ValidationErrorType.REQUIRED_FIELD_MISSING,
                        metadata: {
                            strategy: this.name,
                            originalValue: value,
                            addressComponents,
                            missingComponent: 'city'
                        }
                    };
                }

                if (addressParams.requireDistrict && !addressComponents.district) {
                    return {
                        success: false,
                        error: 'District is required but not found in address',
                        errorCode: ValidationErrorType.REQUIRED_FIELD_MISSING,
                        metadata: {
                            strategy: this.name,
                            originalValue: value,
                            addressComponents,
                            missingComponent: 'district'
                        }
                    };
                }

                // Additional component validation if enabled
                if (addressParams.validateComponents) {
                    // The AddressCleanerService already performs component validation
                    // This parameter is mainly for consistency with the interface
                    this.logger.debug('Component validation is handled by AddressCleanerService');
                }

                return {
                    success: true,
                    value: addressComponents,
                    metadata: {
                        strategy: this.name,
                        originalValue: value,
                        appliedParams: addressParams,
                        legacyService: 'AddressCleanerService'
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
                        legacyService: 'AddressCleanerService',
                        legacyError: cleanResult.error
                    }
                };
            }
        } catch (error) {
            this.logger.error(`Address cleaning strategy error: ${error.message}`, {
                value,
                params: addressParams,
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
     * Validate if parameters are valid for address cleaner strategy
     * @param params Validation parameters
     * @returns True if parameters are valid, false otherwise
     */
    validateParams(params: ValidationParams): boolean {
        if (!params) {
            // Address cleaner can work without parameters (use defaults)
            return true;
        }

        const addressParams = params as AddressParams;

        // Validate boolean parameters
        if (addressParams.requireProvince !== undefined && typeof addressParams.requireProvince !== 'boolean') {
            this.logger.error('requireProvince parameter must be a boolean');
            return false;
        }

        if (addressParams.requireCity !== undefined && typeof addressParams.requireCity !== 'boolean') {
            this.logger.error('requireCity parameter must be a boolean');
            return false;
        }

        if (addressParams.requireDistrict !== undefined && typeof addressParams.requireDistrict !== 'boolean') {
            this.logger.error('requireDistrict parameter must be a boolean');
            return false;
        }

        if (addressParams.validateComponents !== undefined && typeof addressParams.validateComponents !== 'boolean') {
            this.logger.error('validateComponents parameter must be a boolean');
            return false;
        }

        return true;
    }
}
/**
 * JSON Schema Validator Utility
 * 
 * Provides validation functionality for rule configurations using JSON Schema
 */

import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { RuleConfiguration, ValidationResult } from '../types/rule-engine.types';
import * as ruleConfigSchema from '../schemas/rule-configuration.schema.json';

/**
 * Schema validator class for validating rule configurations
 */
export class SchemaValidator {
    private readonly ajv: Ajv;
    private readonly ruleConfigValidator: ValidateFunction;

    constructor() {
        this.ajv = new Ajv({
            allErrors: true,
            verbose: true,
            strict: false
        });

        // Add format validators (date, email, etc.)
        addFormats(this.ajv);

        // Compile the rule configuration schema
        this.ruleConfigValidator = this.ajv.compile(ruleConfigSchema);
    }

    /**
     * Validate a rule configuration against the JSON schema
     * @param config The rule configuration to validate
     * @returns Validation result with detailed error information
     */
    validateRuleConfiguration(config: any): ValidationResult {
        const isValid = this.ruleConfigValidator(config);

        if (isValid) {
            return {
                success: true,
                value: config as RuleConfiguration
            };
        }

        // Collect all validation errors
        const errors = this.ruleConfigValidator.errors || [];
        const errorMessages = errors.map(error => {
            const path = error.instancePath || 'root';
            const message = error.message || 'Unknown validation error';
            return `${path}: ${message}`;
        });

        return {
            success: false,
            error: `Rule configuration validation failed: ${errorMessages.join('; ')}`,
            errorCode: 'SCHEMA_VALIDATION_ERROR',
            metadata: {
                errors: errors,
                errorCount: errors.length
            }
        };
    }

    /**
     * Validate any object against a custom schema
     * @param data The data to validate
     * @param schema The JSON schema to validate against
     * @returns Validation result
     */
    validateAgainstSchema(data: any, schema: object): ValidationResult {
        try {
            const validator = this.ajv.compile(schema);
            const isValid = validator(data);

            if (isValid) {
                return {
                    success: true,
                    value: data
                };
            }

            const errors = validator.errors || [];
            const errorMessages = errors.map(error => {
                const path = error.instancePath || 'root';
                const message = error.message || 'Unknown validation error';
                return `${path}: ${message}`;
            });

            return {
                success: false,
                error: `Schema validation failed: ${errorMessages.join('; ')}`,
                errorCode: 'SCHEMA_VALIDATION_ERROR',
                metadata: {
                    errors: errors,
                    errorCount: errors.length
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `Schema compilation failed: ${error.message}`,
                errorCode: 'SCHEMA_COMPILATION_ERROR',
                metadata: {
                    originalError: error
                }
            };
        }
    }

    /**
     * Get detailed validation errors for debugging
     * @param config The configuration that failed validation
     * @returns Detailed error information
     */
    getDetailedErrors(config: any): Array<{
        path: string;
        message: string;
        value: any;
        schema: any;
    }> {
        this.ruleConfigValidator(config);
        const errors = this.ruleConfigValidator.errors || [];

        return errors.map(error => ({
            path: error.instancePath || 'root',
            message: error.message || 'Unknown error',
            value: error.data,
            schema: error.schema
        }));
    }
}
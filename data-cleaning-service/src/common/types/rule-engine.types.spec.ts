/**
 * Tests for Rule Engine Types and Schema Validation
 */

import { SchemaValidator } from '../utils/schema-validator';
import {
    RuleConfiguration,
    ValidationErrorType,
    ValidationError,
    ConditionOperator
} from './rule-engine.types';
import { DEFAULT_RULE_TEMPLATE } from '../constants/rule-engine.constants';

describe('Rule Engine Types', () => {
    let schemaValidator: SchemaValidator;

    beforeEach(() => {
        schemaValidator = new SchemaValidator();
    });

    describe('ValidationError', () => {
        it('should create validation error with all properties', () => {
            const error = new ValidationError(
                ValidationErrorType.INVALID_FORMAT,
                'phone',
                '123',
                'Invalid phone format',
                { originalValue: '123' }
            );

            expect(error.type).toBe(ValidationErrorType.INVALID_FORMAT);
            expect(error.field).toBe('phone');
            expect(error.originalValue).toBe('123');
            expect(error.message).toBe('Invalid phone format');
            expect(error.metadata).toEqual({ originalValue: '123' });
            expect(error.name).toBe('ValidationError');
        });
    });

    describe('ConditionOperator', () => {
        it('should have all expected operators', () => {
            expect(ConditionOperator.EQUALS).toBe('equals');
            expect(ConditionOperator.NOT_EQUALS).toBe('not_equals');
            expect(ConditionOperator.GREATER_THAN).toBe('greater_than');
            expect(ConditionOperator.LESS_THAN).toBe('less_than');
            expect(ConditionOperator.CONTAINS).toBe('contains');
            expect(ConditionOperator.NOT_CONTAINS).toBe('not_contains');
            expect(ConditionOperator.IS_EMPTY).toBe('is_empty');
            expect(ConditionOperator.IS_NOT_EMPTY).toBe('is_not_empty');
        });
    });

    describe('Schema Validation', () => {
        it('should validate a valid rule configuration', () => {
            const validConfig: RuleConfiguration = {
                metadata: {
                    name: 'test-rules',
                    description: 'Test rule configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    phone: [
                        {
                            name: 'phone-validation',
                            strategy: 'regex',
                            params: {
                                pattern: '^1[3-9]\\d{9}$'
                            },
                            required: true
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const result = schemaValidator.validateRuleConfiguration(validConfig);
            expect(result.success).toBe(true);
            expect(result.value).toEqual(validConfig);
        });

        it('should reject configuration with missing required fields', () => {
            const invalidConfig = {
                metadata: {
                    name: 'test-rules'
                    // missing description, version, priority
                },
                fieldRules: {},
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const result = schemaValidator.validateRuleConfiguration(invalidConfig);
            expect(result.success).toBe(false);
            expect(result.error).toContain('validation failed');
        });

        it('should reject configuration with invalid strategy type', () => {
            const invalidConfig = {
                metadata: {
                    name: 'test-rules',
                    description: 'Test rule configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    phone: [
                        {
                            name: 'phone-validation',
                            strategy: 'invalid-strategy', // Invalid strategy
                            params: {},
                            required: true
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const result = schemaValidator.validateRuleConfiguration(invalidConfig);
            expect(result.success).toBe(false);
            expect(result.error).toContain('validation failed');
        });

        it('should validate regex parameters correctly', () => {
            const configWithRegex: RuleConfiguration = {
                metadata: {
                    name: 'regex-test',
                    description: 'Test regex validation',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    email: [
                        {
                            name: 'email-validation',
                            strategy: 'regex',
                            params: {
                                pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
                                flags: 'i',
                                multiline: false
                            },
                            required: true,
                            errorMessage: 'Invalid email format'
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const result = schemaValidator.validateRuleConfiguration(configWithRegex);
            expect(result.success).toBe(true);
        });

        it('should validate range parameters correctly', () => {
            const configWithRange: RuleConfiguration = {
                metadata: {
                    name: 'range-test',
                    description: 'Test range validation',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    age: [
                        {
                            name: 'age-range',
                            strategy: 'range',
                            params: {
                                min: 0,
                                max: 150,
                                inclusive: true
                            },
                            required: true
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const result = schemaValidator.validateRuleConfiguration(configWithRange);
            expect(result.success).toBe(true);
        });

        it('should validate length parameters correctly', () => {
            const configWithLength: RuleConfiguration = {
                metadata: {
                    name: 'length-test',
                    description: 'Test length validation',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    name: [
                        {
                            name: 'name-length',
                            strategy: 'length',
                            params: {
                                minLength: 2,
                                maxLength: 50
                            },
                            required: true
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const result = schemaValidator.validateRuleConfiguration(configWithLength);
            expect(result.success).toBe(true);
        });

        it('should validate phone parameters correctly', () => {
            const configWithPhone: RuleConfiguration = {
                metadata: {
                    name: 'phone-test',
                    description: 'Test phone validation',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    phone: [
                        {
                            name: 'phone-cleanup',
                            strategy: 'phone',
                            params: {
                                removeSpaces: true,
                                removeDashes: true,
                                removeCountryCode: false,
                                allowLandline: true
                            },
                            required: false
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const result = schemaValidator.validateRuleConfiguration(configWithPhone);
            expect(result.success).toBe(true);
        });

        it('should validate date parameters correctly', () => {
            const configWithDate: RuleConfiguration = {
                metadata: {
                    name: 'date-test',
                    description: 'Test date validation',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    birthDate: [
                        {
                            name: 'date-format',
                            strategy: 'date',
                            params: {
                                formats: ['YYYY-MM-DD', 'YYYY/MM/DD'],
                                minYear: 1900,
                                maxYear: 2100,
                                timezone: 'Asia/Shanghai'
                            },
                            required: true
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const result = schemaValidator.validateRuleConfiguration(configWithDate);
            expect(result.success).toBe(true);
        });

        it('should validate address parameters correctly', () => {
            const configWithAddress: RuleConfiguration = {
                metadata: {
                    name: 'address-test',
                    description: 'Test address validation',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    address: [
                        {
                            name: 'address-components',
                            strategy: 'address',
                            params: {
                                requireProvince: true,
                                requireCity: true,
                                requireDistrict: false,
                                validateComponents: true
                            },
                            required: true
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const result = schemaValidator.validateRuleConfiguration(configWithAddress);
            expect(result.success).toBe(true);
        });

        it('should validate rule conditions correctly', () => {
            const configWithCondition: RuleConfiguration = {
                metadata: {
                    name: 'condition-test',
                    description: 'Test conditional validation',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    phone: [
                        {
                            name: 'conditional-phone',
                            strategy: 'regex',
                            params: {
                                pattern: '^1[3-9]\\d{9}$'
                            },
                            required: true,
                            condition: {
                                field: 'type',
                                operator: ConditionOperator.EQUALS,
                                value: 'mobile'
                            }
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const result = schemaValidator.validateRuleConfiguration(configWithCondition);
            expect(result.success).toBe(true);
        });
    });

    describe('Default Rule Template', () => {
        it('should have valid structure', () => {
            expect(DEFAULT_RULE_TEMPLATE.metadata).toBeDefined();
            expect(DEFAULT_RULE_TEMPLATE.metadata.name).toBe('default-rules');
            expect(DEFAULT_RULE_TEMPLATE.fieldRules).toEqual({});
            expect(DEFAULT_RULE_TEMPLATE.globalSettings).toBeDefined();
            expect(DEFAULT_RULE_TEMPLATE.globalSettings.strictMode).toBe(false);
            expect(DEFAULT_RULE_TEMPLATE.globalSettings.continueOnError).toBe(true);
            expect(DEFAULT_RULE_TEMPLATE.globalSettings.maxErrors).toBe(10);
        });
    });
});
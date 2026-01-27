/**
 * Configuration Validator Service Tests
 * 
 * Tests for the configuration validator service that validates rule configurations
 * for completeness, correctness, and detects conflicts.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigValidatorService } from './config-validator.service';
import { RuleConfiguration, ValidationErrorType } from '../../common/types/rule-engine.types';

describe('ConfigValidatorService', () => {
    let service: ConfigValidatorService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ConfigValidatorService],
        }).compile();

        service = module.get<ConfigValidatorService>(ConfigValidatorService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('validateConfiguration', () => {
        it('should validate a correct configuration successfully', async () => {
            const validConfig: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    phone: [
                        {
                            name: 'phone-regex',
                            strategy: 'regex',
                            params: {
                                pattern: '^1[3-9]\\d{9}$',
                                flags: 'i'
                            },
                            required: true,
                            errorMessage: '手机号格式不正确'
                        }
                    ],
                    email: [
                        {
                            name: 'email-regex',
                            strategy: 'regex',
                            params: {
                                pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
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

            const result = await service.validateConfiguration(validConfig);

            expect(result.success).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.validatedFields).toContain('phone');
            expect(result.validatedFields).toContain('email');
            expect(result.summary.totalFields).toBe(2);
            expect(result.summary.totalRules).toBe(2);
        });

        it('should detect schema validation errors', async () => {
            const invalidConfig = {
                metadata: {
                    name: 'test-config',
                    // missing required fields
                },
                fieldRules: {},
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const result = await service.validateConfiguration(invalidConfig);

            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe('schema');
            expect(result.errors[0].message).toContain('Schema validation failed');
        });

        it('should detect invalid field names', async () => {
            const configWithInvalidFieldName: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    'valid_field': [
                        {
                            name: 'test-rule',
                            strategy: 'regex',
                            params: { pattern: 'test' },
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

            // Add invalid field name directly to bypass TypeScript checking
            (configWithInvalidFieldName.fieldRules as any)['123invalid'] = [
                {
                    name: 'test-rule',
                    strategy: 'regex',
                    params: { pattern: 'test' },
                    required: true
                }
            ];

            const result = await service.validateConfiguration(configWithInvalidFieldName);

            // This should fail at schema validation level
            expect(result.success).toBe(false);
            expect(result.errors.some(e => e.type === 'schema')).toBe(true);
        });

        it('should detect invalid regex patterns', async () => {
            const configWithInvalidRegex: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    phone: [
                        {
                            name: 'invalid-regex',
                            strategy: 'regex',
                            params: {
                                pattern: '[invalid-regex-pattern',
                                flags: 'i'
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

            const result = await service.validateConfiguration(configWithInvalidRegex);

            expect(result.success).toBe(false);
            expect(result.errors.some(e =>
                e.type === 'regex' &&
                e.field === 'phone' &&
                e.rule === 'invalid-regex'
            )).toBe(true);
        });

        it('should detect invalid regex flags', async () => {
            const configWithInvalidFlags: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    phone: [
                        {
                            name: 'invalid-flags',
                            strategy: 'regex',
                            params: {
                                pattern: '^test$',
                                flags: 'xyz' // Invalid flags - should be caught by custom validation
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

            const result = await service.validateConfiguration(configWithInvalidFlags);

            expect(result.success).toBe(false);
            expect(result.errors.some(e =>
                e.type === 'regex' &&
                (e.message.includes('Invalid regex flags') || e.message.includes('Invalid flags'))
            )).toBe(true);
        });

        it('should detect unknown validation strategies', async () => {
            const configWithUnknownStrategy = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    phone: [
                        {
                            name: 'unknown-strategy',
                            strategy: 'unknown_strategy', // Not in enum
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

            const result = await service.validateConfiguration(configWithUnknownStrategy);

            // This should fail at schema validation level due to invalid strategy enum
            expect(result.success).toBe(false);
            expect(result.errors.some(e => e.type === 'schema')).toBe(true);
        });

        it('should detect range parameter conflicts', async () => {
            const configWithRangeConflict: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    age: [
                        {
                            name: 'invalid-range',
                            strategy: 'range',
                            params: {
                                min: 100,
                                max: 50
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

            const result = await service.validateConfiguration(configWithRangeConflict);

            expect(result.success).toBe(false);
            expect(result.errors.some(e =>
                e.type === 'parameter' &&
                e.message.includes('min (100) is greater than max (50)')
            )).toBe(true);
        });

        it('should detect length parameter conflicts', async () => {
            const configWithLengthConflict: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    name: [
                        {
                            name: 'invalid-length',
                            strategy: 'length',
                            params: {
                                minLength: 20,
                                maxLength: 10
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

            const result = await service.validateConfiguration(configWithLengthConflict);

            expect(result.success).toBe(false);
            expect(result.errors.some(e =>
                e.type === 'parameter' &&
                e.message.includes('minLength (20) is greater than maxLength (10)')
            )).toBe(true);
        });

        it('should detect missing range parameters', async () => {
            const configWithMissingRangeParams: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    age: [
                        {
                            name: 'empty-range',
                            strategy: 'range',
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

            const result = await service.validateConfiguration(configWithMissingRangeParams);

            expect(result.success).toBe(false);
            expect(result.errors.some(e =>
                e.type === 'parameter' &&
                e.message.includes('Range validation requires at least min or max value')
            )).toBe(true);
        });

        it('should detect missing length parameters', async () => {
            const configWithMissingLengthParams: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    name: [
                        {
                            name: 'empty-length',
                            strategy: 'length',
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

            const result = await service.validateConfiguration(configWithMissingLengthParams);

            expect(result.success).toBe(false);
            expect(result.errors.some(e =>
                e.type === 'parameter' &&
                e.message.includes('Length validation requires at least one constraint')
            )).toBe(true);
        });

        it('should detect rule conflicts - duplicate strategies', async () => {
            const configWithDuplicateStrategies: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    phone: [
                        {
                            name: 'regex-rule-1',
                            strategy: 'regex',
                            params: { pattern: '^1[3-9]\\d{9}$' },
                            required: true
                        },
                        {
                            name: 'regex-rule-2',
                            strategy: 'regex',
                            params: { pattern: '^\\d{11}$' },
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

            const result = await service.validateConfiguration(configWithDuplicateStrategies);

            expect(result.success).toBe(true); // This is a warning, not an error
            expect(result.conflicts).toHaveLength(1);
            expect(result.conflicts[0].conflictType).toBe('duplicate_strategy');
            expect(result.conflicts[0].field).toBe('phone');
        });

        it('should detect contradictory length parameters across rules', async () => {
            const configWithContradictoryLength: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    name: [
                        {
                            name: 'length-rule-1',
                            strategy: 'length',
                            params: { exactLength: 5 },
                            required: true
                        },
                        {
                            name: 'length-rule-2',
                            strategy: 'length',
                            params: { exactLength: 10 },
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

            const result = await service.validateConfiguration(configWithContradictoryLength);

            expect(result.success).toBe(true); // This is a conflict, not an error
            expect(result.conflicts.some(c =>
                c.conflictType === 'contradictory_params' &&
                c.description.includes('different exact lengths')
            )).toBe(true);
        });

        it('should detect invalid date year ranges', async () => {
            const configWithInvalidDateRange: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    birthdate: [
                        {
                            name: 'invalid-date-range',
                            strategy: 'date',
                            params: {
                                minYear: 2000,
                                maxYear: 1990
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

            const result = await service.validateConfiguration(configWithInvalidDateRange);

            expect(result.success).toBe(false);
            expect(result.errors.some(e =>
                e.type === 'parameter' &&
                e.message.includes('minYear (2000) is greater than maxYear (1990)')
            )).toBe(true);
        });

        it('should generate warnings for potentially problematic configurations', async () => {
            // First create a valid config that passes schema validation
            const configWithWarnings: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    phone: [
                        {
                            name: 'complex-regex',
                            strategy: 'regex',
                            params: {
                                pattern: '(.*)+(.*)+(.*)+(.*)+(.*)+(.*)+(.*)+(.*)+(.*)+(.*)+(.*)+'
                            },
                            required: true,
                            errorMessage: 'This is a very long error message that exceeds the recommended length limit for error messages in the configuration validator service and should generate a warning about the message being too long. This message is intentionally made very long to test the validation logic that checks for error messages that are too long and should generate warnings when they exceed the maximum allowed length. This message should definitely be longer than 500 characters to trigger the validation warning. Adding more text to ensure we exceed the limit and the warning is properly generated by the configuration validator service implementation.'
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 1000 // At the maximum allowed by schema
                }
            };

            const result = await service.validateConfiguration(configWithWarnings);

            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some(w => w.message.includes('performance issues'))).toBe(true);
            expect(result.warnings.some(w => w.message.includes('too long'))).toBe(true);
        });

        it('should handle empty configuration gracefully', async () => {
            const emptyConfig: RuleConfiguration = {
                metadata: {
                    name: 'empty-config',
                    description: 'Empty configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {},
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const result = await service.validateConfiguration(emptyConfig);

            expect(result.success).toBe(true);
            expect(result.warnings.some(w => w.message.includes('No field rules defined'))).toBe(true);
            expect(result.summary.totalFields).toBe(0);
            expect(result.summary.totalRules).toBe(0);
        });

        it('should validate negative length parameters', async () => {
            const configWithNegativeLength: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    name: [
                        {
                            name: 'negative-length',
                            strategy: 'length',
                            params: {
                                minLength: -5,
                                maxLength: -1
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

            const result = await service.validateConfiguration(configWithNegativeLength);

            expect(result.success).toBe(false);
            expect(result.errors.some(e => e.message.includes('minLength cannot be negative'))).toBe(true);
            expect(result.errors.some(e => e.message.includes('maxLength cannot be negative'))).toBe(true);
        });

        it('should handle validation exceptions gracefully', async () => {
            // Pass invalid input that might cause exceptions
            const result = await service.validateConfiguration(null);

            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe('schema');
        });
    });
});
/**
 * Field Processor Service Unit Tests
 * 
 * Tests the field processor service functionality including:
 * - Single rule processing
 * - Multi-rule combination with logical operators
 * - Error handling and recovery
 * - Conditional rule evaluation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { FieldProcessorService, LogicalOperator } from './field-processor.service';
import { StrategyFactoryService } from './strategy-factory.service';
import { RuleLoaderService } from './rule-loader.service';
import {
    FieldRule,
    ValidationStrategy,
    ValidationResult,
    ValidationParams,
    RuleConfiguration,
    ValidationErrorType,
    ConditionOperator
} from '../../common/types/rule-engine.types';

// Mock validation strategy for testing
class MockValidationStrategy implements ValidationStrategy {
    constructor(
        public readonly name: string,
        public readonly description: string,
        private readonly shouldSucceed: boolean = true,
        private readonly returnValue?: any
    ) { }

    validate(value: any, params: ValidationParams): ValidationResult {
        if (this.shouldSucceed) {
            return {
                success: true,
                value: this.returnValue !== undefined ? this.returnValue : value,
                metadata: { strategy: this.name }
            };
        } else {
            return {
                success: false,
                error: `Mock validation failed for ${this.name}`,
                errorCode: ValidationErrorType.INVALID_FORMAT,
                metadata: { strategy: this.name }
            };
        }
    }

    validateParams(params: ValidationParams): boolean {
        return true;
    }
}

describe('FieldProcessorService', () => {
    let service: FieldProcessorService;
    let strategyFactory: jest.Mocked<StrategyFactoryService>;
    let ruleLoader: jest.Mocked<RuleLoaderService>;

    const mockConfiguration: RuleConfiguration = {
        metadata: {
            name: 'test-config',
            description: 'Test configuration',
            version: '1.0.0',
            priority: 100
        },
        fieldRules: {
            'testField': [
                {
                    name: 'test-rule-1',
                    strategy: 'mock-strategy',
                    params: { test: true },
                    required: true,
                    priority: 100
                }
            ],
            'multiRuleField': [
                {
                    name: 'required-rule',
                    strategy: 'mock-strategy',
                    params: { test: true },
                    required: true,
                    priority: 200
                },
                {
                    name: 'optional-rule',
                    strategy: 'mock-strategy-2',
                    params: { test: true },
                    required: false,
                    priority: 100
                }
            ],
            'conditionalField': [
                {
                    name: 'conditional-rule',
                    strategy: 'mock-strategy',
                    params: { test: true },
                    required: true,
                    condition: {
                        field: 'status',
                        operator: ConditionOperator.EQUALS,
                        value: 'active'
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

    beforeEach(async () => {
        const mockStrategyFactory = {
            createStrategy: jest.fn(),
            registerStrategy: jest.fn(),
            getAvailableStrategies: jest.fn(),
            hasStrategy: jest.fn()
        };

        const mockRuleLoader = {
            getCurrentConfiguration: jest.fn(),
            loadFromFile: jest.fn(),
            loadFromDatabase: jest.fn(),
            loadFromEnvironment: jest.fn(),
            validateConfiguration: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FieldProcessorService,
                {
                    provide: StrategyFactoryService,
                    useValue: mockStrategyFactory
                },
                {
                    provide: RuleLoaderService,
                    useValue: mockRuleLoader
                }
            ]
        }).compile();

        service = module.get<FieldProcessorService>(FieldProcessorService);
        strategyFactory = module.get(StrategyFactoryService);
        ruleLoader = module.get(RuleLoaderService);

        // Setup default mocks
        ruleLoader.getCurrentConfiguration.mockReturnValue(mockConfiguration);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('processField', () => {
        it('should process field with single successful rule', async () => {
            // Arrange
            const mockStrategy = new MockValidationStrategy('mock-strategy', 'Mock strategy', true, 'cleaned-value');
            strategyFactory.createStrategy.mockReturnValue(mockStrategy);

            // Act
            const result = await service.processField('testField', 'test-value', 'TEXT');

            // Assert
            expect(result.success).toBe(true);
            expect(result.processedValue).toBe('cleaned-value');
            expect(result.fieldName).toBe('testField');
            expect(result.originalValue).toBe('test-value');
            expect(result.appliedRules).toEqual(['test-rule-1']);
            expect(result.errors).toHaveLength(0);
        });

        it('should handle field with no applicable rules', async () => {
            // Arrange
            ruleLoader.getCurrentConfiguration.mockReturnValue({
                ...mockConfiguration,
                fieldRules: {}
            });

            // Act
            const result = await service.processField('unknownField', 'test-value', 'TEXT');

            // Assert
            expect(result.success).toBe(true);
            expect(result.processedValue).toBe('test-value');
            expect(result.appliedRules).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });

        it('should handle strategy not found error', async () => {
            // Arrange
            strategyFactory.createStrategy.mockReturnValue(null);

            // Act
            const result = await service.processField('testField', 'test-value', 'TEXT');

            // Assert
            expect(result.success).toBe(false);
            expect(result.processedValue).toBe('test-value');
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe(ValidationErrorType.STRATEGY_NOT_FOUND);
        });

        it('should handle validation failure for required rule', async () => {
            // Arrange
            const mockStrategy = new MockValidationStrategy('mock-strategy', 'Mock strategy', false);
            strategyFactory.createStrategy.mockReturnValue(mockStrategy);

            // Act
            const result = await service.processField('testField', 'test-value', 'TEXT');

            // Assert
            expect(result.success).toBe(false);
            expect(result.processedValue).toBe('test-value');
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].message).toContain('Mock validation failed');
        });

        it('should handle validation failure for optional rule', async () => {
            // Arrange
            const config = {
                ...mockConfiguration,
                fieldRules: {
                    'testField': [
                        {
                            name: 'optional-rule',
                            strategy: 'mock-strategy',
                            params: { test: true },
                            required: false
                        }
                    ]
                }
            };
            ruleLoader.getCurrentConfiguration.mockReturnValue(config);

            const mockStrategy = new MockValidationStrategy('mock-strategy', 'Mock strategy', false);
            strategyFactory.createStrategy.mockReturnValue(mockStrategy);

            // Act
            const result = await service.processField('testField', 'test-value', 'TEXT');

            // Assert
            expect(result.success).toBe(true); // Should succeed despite optional rule failure
            expect(result.processedValue).toBe('test-value');
            expect(result.errors).toHaveLength(1); // Warning stored as error
        });

        it('should process multiple rules with AND logic', async () => {
            // Arrange
            const mockStrategy1 = new MockValidationStrategy('mock-strategy', 'Mock strategy 1', true, 'cleaned-1');
            const mockStrategy2 = new MockValidationStrategy('mock-strategy-2', 'Mock strategy 2', true, 'cleaned-2');

            strategyFactory.createStrategy
                .mockReturnValueOnce(mockStrategy1)
                .mockReturnValueOnce(mockStrategy2);

            // Act
            const result = await service.processField('multiRuleField', 'test-value', 'TEXT');

            // Assert
            expect(result.success).toBe(true);
            expect(result.processedValue).toBe('cleaned-2'); // Last successful transformation
            expect(result.appliedRules).toEqual(['required-rule', 'optional-rule']);
        });

        it('should handle conditional rules', async () => {
            // Arrange
            const mockStrategy = new MockValidationStrategy('mock-strategy', 'Mock strategy', true, 'cleaned-value');
            strategyFactory.createStrategy.mockReturnValue(mockStrategy);

            const rowData = { status: 'active', conditionalField: 'test-value' };

            // Act
            const result = await service.processField('conditionalField', 'test-value', 'TEXT', rowData);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processedValue).toBe('cleaned-value');
            expect(result.appliedRules).toEqual(['conditional-rule']);
        });

        it('should skip conditional rules when condition not met', async () => {
            // Arrange
            const rowData = { status: 'inactive', conditionalField: 'test-value' };

            // Act
            const result = await service.processField('conditionalField', 'test-value', 'TEXT', rowData);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processedValue).toBe('test-value'); // Original value preserved
            expect(result.appliedRules).toHaveLength(0);
        });

        it('should handle processing errors gracefully', async () => {
            // Arrange
            strategyFactory.createStrategy.mockImplementation(() => {
                throw new Error('Strategy creation failed');
            });

            // Act
            const result = await service.processField('testField', 'test-value', 'TEXT');

            // Assert
            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe(ValidationErrorType.PROCESSING_ERROR);
        });
    });

    describe('getFieldRules', () => {
        it('should return field-specific rules', () => {
            // Act
            const rules = service.getFieldRules('testField', 'TEXT');

            // Assert
            expect(rules).toHaveLength(1);
            expect(rules[0].name).toBe('test-rule-1');
        });

        it('should return empty array for unknown field', () => {
            // Act
            const rules = service.getFieldRules('unknownField', 'TEXT');

            // Assert
            expect(rules).toHaveLength(0);
        });

        it('should combine field-specific and type-specific rules', () => {
            // Arrange
            const config = {
                ...mockConfiguration,
                fieldRules: {
                    'testField': [
                        {
                            name: 'field-specific-rule',
                            strategy: 'mock-strategy',
                            params: {},
                            required: true
                        }
                    ],
                    'TEXT': [
                        {
                            name: 'type-specific-rule',
                            strategy: 'mock-strategy',
                            params: {},
                            required: false
                        }
                    ]
                }
            };
            ruleLoader.getCurrentConfiguration.mockReturnValue(config);

            // Act
            const rules = service.getFieldRules('testField', 'TEXT');

            // Assert
            expect(rules).toHaveLength(2);
            expect(rules.map(r => r.name)).toContain('field-specific-rule');
            expect(rules.map(r => r.name)).toContain('type-specific-rule');
        });

        it('should sort rules by priority', () => {
            // Arrange
            const config = {
                ...mockConfiguration,
                fieldRules: {
                    'testField': [
                        {
                            name: 'low-priority-rule',
                            strategy: 'mock-strategy',
                            params: {},
                            required: true,
                            priority: 50
                        },
                        {
                            name: 'high-priority-rule',
                            strategy: 'mock-strategy',
                            params: {},
                            required: true,
                            priority: 200
                        }
                    ]
                }
            };
            ruleLoader.getCurrentConfiguration.mockReturnValue(config);

            // Act
            const rules = service.getFieldRules('testField', 'TEXT');

            // Assert
            expect(rules).toHaveLength(2);
            expect(rules[0].name).toBe('high-priority-rule');
            expect(rules[1].name).toBe('low-priority-rule');
        });

        it('should deduplicate rules by name', () => {
            // Arrange
            const config = {
                ...mockConfiguration,
                fieldRules: {
                    'testField': [
                        {
                            name: 'duplicate-rule',
                            strategy: 'mock-strategy',
                            params: {},
                            required: true
                        }
                    ],
                    'TEXT': [
                        {
                            name: 'duplicate-rule',
                            strategy: 'mock-strategy-2',
                            params: {},
                            required: false
                        }
                    ]
                }
            };
            ruleLoader.getCurrentConfiguration.mockReturnValue(config);

            // Act
            const rules = service.getFieldRules('testField', 'TEXT');

            // Assert
            expect(rules).toHaveLength(1);
            expect(rules[0].name).toBe('duplicate-rule');
        });

        it('should handle configuration loading errors', () => {
            // Arrange
            ruleLoader.getCurrentConfiguration.mockReturnValue(null);

            // Act
            const rules = service.getFieldRules('testField', 'TEXT');

            // Assert
            expect(rules).toHaveLength(0);
        });
    });

    describe('error handling', () => {
        it('should handle custom error messages', async () => {
            // Arrange
            const config = {
                ...mockConfiguration,
                fieldRules: {
                    'testField': [
                        {
                            name: 'custom-error-rule',
                            strategy: 'mock-strategy',
                            params: {},
                            required: true,
                            errorMessage: 'Custom error message'
                        }
                    ]
                }
            };
            ruleLoader.getCurrentConfiguration.mockReturnValue(config);

            const mockStrategy = new MockValidationStrategy('mock-strategy', 'Mock strategy', false);
            strategyFactory.createStrategy.mockReturnValue(mockStrategy);

            // Act
            const result = await service.processField('testField', 'test-value', 'TEXT');

            // Assert
            expect(result.success).toBe(false);
            expect(result.errors[0].message).toBe('Custom error message');
        });

        it('should handle invalid strategy parameters', async () => {
            // Arrange
            const mockStrategy = new MockValidationStrategy('mock-strategy', 'Mock strategy');
            mockStrategy.validateParams = jest.fn().mockReturnValue(false);
            strategyFactory.createStrategy.mockReturnValue(mockStrategy);

            // Act
            const result = await service.processField('testField', 'test-value', 'TEXT');

            // Assert
            expect(result.success).toBe(false);
            expect(result.errors[0].type).toBe(ValidationErrorType.CONFIGURATION_ERROR);
        });
    });
});
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigValidationToolService } from './config-validation-tool.service';
import { ConfigValidatorService } from './config-validator.service';
import { RuleConfiguration } from '../../common/types/rule-engine.types';

describe('ConfigValidationToolService', () => {
    let service: ConfigValidationToolService;
    let configValidator: ConfigValidatorService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConfigValidationToolService,
                {
                    provide: ConfigValidatorService,
                    useValue: {
                        validateConfiguration: jest.fn()
                    }
                }
            ],
        }).compile();

        service = module.get<ConfigValidationToolService>(ConfigValidationToolService);
        configValidator = module.get<ConfigValidatorService>(ConfigValidatorService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('validateConfiguration', () => {
        it('should validate a valid configuration', async () => {
            const validConfig: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    'phone': [
                        {
                            name: 'phone-validation',
                            strategy: 'regex',
                            params: {
                                pattern: '^1[3-9]\\d{9}$'
                            },
                            required: true,
                            priority: 100,
                            errorMessage: '手机号格式不正确'
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            jest.spyOn(configValidator, 'validateConfiguration').mockResolvedValue({
                success: true,
                error: undefined
            });

            const result = await service.validateConfiguration(validConfig);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.summary.totalRules).toBe(1);
            expect(result.summary.validRules).toBe(1);
        });

        it('should detect invalid regex patterns', async () => {
            const invalidConfig: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    'phone': [
                        {
                            name: 'invalid-regex',
                            strategy: 'regex',
                            params: {
                                pattern: '[invalid-regex'  // 无效的正则表达式
                            },
                            required: true,
                            priority: 100,
                            errorMessage: '手机号格式不正确'
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            jest.spyOn(configValidator, 'validateConfiguration').mockResolvedValue({
                success: true,
                error: undefined
            });

            const result = await service.validateConfiguration(invalidConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.type === 'REGEX_ERROR')).toBe(true);
        });

        it('should detect missing required fields', async () => {
            const incompleteConfig: any = {
                metadata: {
                    name: 'test-config'
                    // 缺少 description 和 version
                },
                fieldRules: {
                    'phone': [
                        {
                            // 缺少 name, strategy, params
                            required: true,
                            priority: 100,
                            errorMessage: '手机号格式不正确'
                        }
                    ]
                }
                // 缺少 globalSettings
            };

            jest.spyOn(configValidator, 'validateConfiguration').mockResolvedValue({
                success: true,
                error: undefined
            });

            const result = await service.validateConfiguration(incompleteConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.type === 'METADATA_ERROR')).toBe(true);
            expect(result.errors.some(error => error.type === 'RULE_ERROR')).toBe(true);
        });

        it('should detect parameter validation errors', async () => {
            const invalidParamsConfig: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    'age': [
                        {
                            name: 'invalid-range',
                            strategy: 'range',
                            params: {
                                min: 100,
                                max: 50  // min > max
                            },
                            required: true,
                            priority: 100,
                            errorMessage: '年龄范围不正确'
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            jest.spyOn(configValidator, 'validateConfiguration').mockResolvedValue({
                success: true,
                error: undefined
            });

            const result = await service.validateConfiguration(invalidParamsConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.type === 'PARAM_ERROR')).toBe(true);
        });
    });

    describe('testRulesWithSampleData', () => {
        it('should test rules with sample data', async () => {
            const config: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    'phone': [
                        {
                            name: 'phone-validation',
                            strategy: 'regex',
                            params: {
                                pattern: '^1[3-9]\\d{9}$'
                            },
                            required: true,
                            priority: 100,
                            errorMessage: '手机号格式不正确'
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const sampleData = [
                { phone: '13812345678' },
                { phone: '15912345678' },
                { phone: 'invalid_phone' }
            ];

            const result = await service.testRulesWithSampleData(config, sampleData);

            expect(result.totalRecords).toBe(3);
            expect(result.processedRecords).toBeGreaterThan(0);
            expect(result.fieldResults).toHaveProperty('phone');
            expect(result.performanceMetrics.totalTime).toBeGreaterThan(0);
        });
    });

    describe('detectPerformanceIssues', () => {
        it('should detect complex regex patterns', async () => {
            const configWithComplexRegex: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    'email': [
                        {
                            name: 'complex-email-validation',
                            strategy: 'regex',
                            params: {
                                pattern: '(?=.*@)(?=.*\\.).*'  // 复杂的正向前瞻
                            },
                            required: true,
                            priority: 100,
                            errorMessage: '邮箱格式不正确'
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            jest.spyOn(configValidator, 'validateConfiguration').mockResolvedValue({
                success: true,
                error: undefined
            });

            const result = await service.validateConfiguration(configWithComplexRegex);

            expect(result.performanceIssues.some(issue => issue.type === 'COMPLEX_REGEX')).toBe(true);
            expect(result.summary.performanceWarnings).toBeGreaterThan(0);
        });

        it('should detect excessive rules', async () => {
            const fieldRules: Record<string, any[]> = {};
            const rules: any[] = [];

            // 创建超过10个规则
            for (let i = 0; i < 15; i++) {
                rules.push({
                    name: `rule-${i}`,
                    strategy: 'regex',
                    params: { pattern: `pattern-${i}` },
                    required: true,
                    priority: 100,
                    errorMessage: `Error ${i}`
                });
            }

            fieldRules['testField'] = rules;

            const configWithManyRules: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules,
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            jest.spyOn(configValidator, 'validateConfiguration').mockResolvedValue({
                success: true,
                error: undefined
            });

            const result = await service.validateConfiguration(configWithManyRules);

            expect(result.performanceIssues.some(issue => issue.type === 'EXCESSIVE_RULES')).toBe(true);
        });
    });

    describe('generateOptimizationSuggestions', () => {
        it('should suggest enabling caching when disabled', () => {
            const configWithoutCache: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules: {
                    'phone': [
                        {
                            name: 'phone-validation',
                            strategy: 'regex',
                            params: { pattern: '^1[3-9]\\d{9}$' },
                            required: true,
                            priority: 100,
                            errorMessage: '手机号格式不正确'
                        }
                    ]
                },
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const suggestions = service.generateOptimizationSuggestions(configWithoutCache);

            expect(suggestions.some(s => s.type === 'CACHING')).toBe(true);
        });

        it('should suggest enabling parallel processing for multiple fields', () => {
            const fieldRules: Record<string, any[]> = {};

            // 创建多个字段
            for (let i = 0; i < 8; i++) {
                fieldRules[`field${i}`] = [
                    {
                        name: `rule-${i}`,
                        strategy: 'regex',
                        params: { pattern: `pattern-${i}` },
                        required: true,
                        priority: 100,
                        errorMessage: `Error ${i}`
                    }
                ];
            }

            const configWithManyFields: RuleConfiguration = {
                metadata: {
                    name: 'test-config',
                    description: 'Test configuration',
                    version: '1.0.0',
                    priority: 100
                },
                fieldRules,
                globalSettings: {
                    strictMode: false,
                    continueOnError: true,
                    maxErrors: 10
                }
            };

            const suggestions = service.generateOptimizationSuggestions(configWithManyFields);

            expect(suggestions.some(s => s.type === 'PARALLEL_PROCESSING')).toBe(true);
        });
    });
});
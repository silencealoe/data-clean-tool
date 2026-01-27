/**
 * Configuration Manager Service Tests
 * 
 * Basic tests for the configuration manager service functionality.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigurationManagerService } from './configuration-manager.service';
import { RuleLoaderService } from './rule-loader.service';
import { ConfigValidatorService, ConfigValidationResult } from './config-validator.service';
import { RuleConfiguration } from '../../common/types/rule-engine.types';

describe('ConfigurationManagerService', () => {
    let service: ConfigurationManagerService;
    let ruleLoaderService: jest.Mocked<RuleLoaderService>;
    let configValidatorService: jest.Mocked<ConfigValidatorService>;

    const mockConfiguration: RuleConfiguration = {
        metadata: {
            name: 'test-config',
            description: 'Test configuration',
            version: '1.0.0',
            priority: 100
        },
        fieldRules: {
            phone: [
                {
                    name: 'phone-validation',
                    strategy: 'regex',
                    params: { pattern: '^1[3-9]\\d{9}$' },
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

    const mockValidationResult: ConfigValidationResult = {
        success: true,
        value: mockConfiguration,
        errors: [],
        warnings: [],
        conflicts: [],
        validatedFields: ['phone'],
        summary: {
            totalFields: 1,
            totalRules: 1,
            errorCount: 0,
            warningCount: 0,
            conflictCount: 0
        }
    };

    beforeEach(async () => {
        const mockRuleLoader = {
            loadWithFallback: jest.fn(),
            setCurrentConfiguration: jest.fn(),
            clearCache: jest.fn()
        };

        const mockConfigValidator = {
            validateConfiguration: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConfigurationManagerService,
                {
                    provide: RuleLoaderService,
                    useValue: mockRuleLoader
                },
                {
                    provide: ConfigValidatorService,
                    useValue: mockConfigValidator
                }
            ]
        }).compile();

        service = module.get<ConfigurationManagerService>(ConfigurationManagerService);
        ruleLoaderService = module.get(RuleLoaderService);
        configValidatorService = module.get(ConfigValidatorService);
    });

    describe('initialization', () => {
        it('should initialize successfully with valid configuration', async () => {
            // Arrange
            ruleLoaderService.loadWithFallback.mockResolvedValue(mockConfiguration);
            configValidatorService.validateConfiguration.mockResolvedValue(mockValidationResult);

            // Act
            await service.initialize();

            // Assert
            expect(ruleLoaderService.loadWithFallback).toHaveBeenCalled();
            expect(configValidatorService.validateConfiguration).toHaveBeenCalledWith(mockConfiguration);
            expect(service.getCurrentConfiguration()).toEqual(mockConfiguration);
        });

        it('should fallback to default configuration when validation fails', async () => {
            // Arrange
            ruleLoaderService.loadWithFallback.mockResolvedValue(mockConfiguration);
            configValidatorService.validateConfiguration.mockResolvedValue({
                success: false,
                error: 'Validation failed',
                errors: [],
                warnings: [],
                conflicts: [],
                validatedFields: [],
                summary: {
                    totalFields: 0,
                    totalRules: 0,
                    errorCount: 1,
                    warningCount: 0,
                    conflictCount: 0
                }
            });

            // Act
            await service.initialize();

            // Assert
            const currentConfig = service.getCurrentConfiguration();
            expect(currentConfig.metadata.name).toContain('default-fallback-rules');
        });
    });

    describe('field rules management', () => {
        beforeEach(async () => {
            ruleLoaderService.loadWithFallback.mockResolvedValue(mockConfiguration);
            configValidatorService.validateConfiguration.mockResolvedValue(mockValidationResult);
            await service.initialize();
        });

        it('should return field rules for existing field', () => {
            // Act
            const rules = service.getFieldRules('phone');

            // Assert
            expect(rules).toHaveLength(1);
            expect(rules[0].name).toBe('phone-validation');
            expect(rules[0].strategy).toBe('regex');
        });

        it('should return empty array for non-existing field', () => {
            // Act
            const rules = service.getFieldRules('nonexistent');

            // Assert
            expect(rules).toEqual([]);
        });
    });

    describe('configuration updates', () => {
        beforeEach(async () => {
            ruleLoaderService.loadWithFallback.mockResolvedValue(mockConfiguration);
            configValidatorService.validateConfiguration.mockResolvedValue(mockValidationResult);
            await service.initialize();
        });

        it('should update configuration successfully with valid config', async () => {
            // Arrange
            const newConfig: RuleConfiguration = {
                ...mockConfiguration,
                metadata: { ...mockConfiguration.metadata, version: '2.0.0' }
            };

            configValidatorService.validateConfiguration.mockResolvedValue({
                ...mockValidationResult,
                value: newConfig
            });

            // Act
            const result = await service.updateConfiguration(newConfig);

            // Assert
            expect(result.success).toBe(true);
            expect(service.getCurrentConfiguration().metadata.version).toBe('2.0.0');
            expect(ruleLoaderService.setCurrentConfiguration).toHaveBeenCalledWith(newConfig);
        });

        it('should reject invalid configuration', async () => {
            // Arrange
            const invalidConfig = { ...mockConfiguration };
            configValidatorService.validateConfiguration.mockResolvedValue({
                success: false,
                error: 'Invalid configuration',
                errors: [],
                warnings: [],
                conflicts: [],
                validatedFields: [],
                summary: {
                    totalFields: 0,
                    totalRules: 0,
                    errorCount: 1,
                    warningCount: 0,
                    conflictCount: 0
                }
            });

            // Act
            const result = await service.updateConfiguration(invalidConfig);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid configuration');
            expect(service.getCurrentConfiguration().metadata.version).toBe('1.0.0'); // Should remain unchanged
        });
    });

    describe('configuration statistics', () => {
        beforeEach(async () => {
            ruleLoaderService.loadWithFallback.mockResolvedValue(mockConfiguration);
            configValidatorService.validateConfiguration.mockResolvedValue(mockValidationResult);
            await service.initialize();
        });

        it('should provide accurate configuration statistics', () => {
            // Act
            const stats = service.getConfigurationStats();

            // Assert
            expect(stats.currentVersion).toBe('1.0.0');
            expect(stats.totalFields).toBe(1);
            expect(stats.totalRules).toBe(1);
            expect(stats.isInitialized).toBe(true);
            expect(stats.historySize).toBeGreaterThan(0);
        });
    });
});
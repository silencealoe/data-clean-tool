/**
 * Rule Engine Core Integration Tests
 * 
 * Tests the core functionality of RuleEngineService to ensure it works correctly
 * as the main engine class integrating all rule engine components.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from './rule-engine.service';
import { FieldProcessorService } from './field-processor.service';
import { RuleLoaderService } from './rule-loader.service';
import { ConfigValidatorService } from './config-validator.service';
import { ColumnType } from '../../common/types';
import { RuleConfiguration, ValidationErrorType, ValidationError } from '../../common/types/rule-engine.types';

describe('Rule Engine Core Integration', () => {
    let ruleEngineService: RuleEngineService;
    let mockFieldProcessor: any;
    let mockRuleLoader: any;
    let mockConfigValidator: any;

    const mockConfiguration: RuleConfiguration = {
        metadata: {
            name: 'integration-test-rules',
            description: 'Integration test configuration',
            version: '1.0.0',
            priority: 100
        },
        fieldRules: {
            'name': [
                {
                    name: 'text-cleanup',
                    strategy: 'text',
                    params: {},
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

    beforeEach(async () => {
        // Mock rule engine dependencies
        mockFieldProcessor = {
            processField: jest.fn()
        };

        mockRuleLoader = {
            getCurrentConfiguration: jest.fn().mockReturnValue(mockConfiguration),
            updateConfiguration: jest.fn()
        };

        mockConfigValidator = {
            validateConfiguration: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RuleEngineService,
                { provide: FieldProcessorService, useValue: mockFieldProcessor },
                { provide: RuleLoaderService, useValue: mockRuleLoader },
                { provide: ConfigValidatorService, useValue: mockConfigValidator },
            ],
        }).compile();

        ruleEngineService = module.get<RuleEngineService>(RuleEngineService);
    });

    describe('RuleEngineService Core Functionality', () => {
        it('should be properly instantiated and configured', () => {
            expect(ruleEngineService).toBeDefined();
            expect(ruleEngineService.getConfiguration()).toEqual(mockConfiguration);
        });

        it('should process single row successfully', async () => {
            mockFieldProcessor.processField.mockResolvedValue({
                fieldName: 'name',
                originalValue: 'John Doe',
                processedValue: 'John Doe',
                success: true,
                errors: [],
                appliedRules: ['text-cleanup']
            });

            const result = await ruleEngineService.cleanRow(
                { name: 'John Doe' },
                { name: ColumnType.TEXT }
            );

            expect(result.success).toBe(true);
            expect(result.fieldResults).toHaveLength(1);
            expect(result.processedData.name).toBe('John Doe');
            expect(result.errors).toHaveLength(0);
            expect(result.metadata.fieldsProcessed).toBe(1);
            expect(result.metadata.rulesApplied).toBe(1);
        });

        it('should handle field processing errors gracefully', async () => {
            const validationError = new ValidationError(
                ValidationErrorType.INVALID_FORMAT,
                'phone',
                'invalid-phone',
                'Invalid phone format'
            );

            mockFieldProcessor.processField.mockResolvedValue({
                fieldName: 'phone',
                originalValue: 'invalid-phone',
                processedValue: 'invalid-phone',
                success: false,
                errors: [validationError],
                appliedRules: ['phone-validation']
            });

            const result = await ruleEngineService.cleanRow(
                { phone: 'invalid-phone' },
                { phone: ColumnType.PHONE }
            );

            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].message).toBe('Invalid phone format');
            expect(result.processedData.phone).toBe('invalid-phone'); // Original value preserved
        });

        it('should process batch data correctly', async () => {
            mockFieldProcessor.processField.mockResolvedValue({
                fieldName: 'name',
                originalValue: 'Test Name',
                processedValue: 'Test Name',
                success: true,
                errors: [],
                appliedRules: ['text-cleanup']
            });

            const rows = [
                { name: 'John Doe' },
                { name: 'Jane Smith' }
            ];

            const results = await ruleEngineService.cleanBatch(rows, { name: ColumnType.TEXT });

            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);
            expect(results[0].processedData.name).toBe('Test Name');
            expect(results[1].processedData.name).toBe('Test Name');
        });

        it('should handle empty batch correctly', async () => {
            const results = await ruleEngineService.cleanBatch([], {});
            expect(results).toHaveLength(0);
        });

        it('should convert results to legacy format correctly', async () => {
            const ruleResults = [{
                success: true,
                fieldResults: [{
                    fieldName: 'name',
                    originalValue: 'John Doe',
                    processedValue: 'John Doe',
                    success: true,
                    errors: [],
                    appliedRules: ['text-cleanup']
                }],
                processedData: { name: 'John Doe' },
                errors: [],
                metadata: { processingTime: 10, rulesApplied: 1, fieldsProcessed: 1 }
            }];

            const legacyResult = ruleEngineService.convertToLegacyFormat(ruleResults, 'test-job-123');

            expect(legacyResult.jobId).toBe('test-job-123');
            expect(legacyResult.cleanData).toHaveLength(1);
            expect(legacyResult.exceptionData).toHaveLength(0);
            expect(legacyResult.statistics.totalRows).toBe(1);
            expect(legacyResult.statistics.cleanedRows).toBe(1);
            expect(legacyResult.statistics.exceptionRows).toBe(0);
            expect(legacyResult.cleanData[0].cleanedData.name).toBe('John Doe');
        });

        it('should convert error results to legacy format correctly', async () => {
            const validationError = new ValidationError(
                ValidationErrorType.INVALID_FORMAT,
                'phone',
                'invalid',
                'Invalid phone format'
            );

            const ruleResults = [{
                success: false,
                fieldResults: [{
                    fieldName: 'phone',
                    originalValue: 'invalid',
                    processedValue: 'invalid',
                    success: false,
                    errors: [validationError],
                    appliedRules: ['phone-validation']
                }],
                processedData: { phone: 'invalid' },
                errors: [validationError],
                metadata: { processingTime: 5, rulesApplied: 1, fieldsProcessed: 1 }
            }];

            const legacyResult = ruleEngineService.convertToLegacyFormat(ruleResults, 'test-job-456');

            expect(legacyResult.jobId).toBe('test-job-456');
            expect(legacyResult.cleanData).toHaveLength(0);
            expect(legacyResult.exceptionData).toHaveLength(1);
            expect(legacyResult.statistics.totalRows).toBe(1);
            expect(legacyResult.statistics.cleanedRows).toBe(0);
            expect(legacyResult.statistics.exceptionRows).toBe(1);
            expect(legacyResult.exceptionData[0].errors[0].errorMessage).toBe('Invalid phone format');
        });
    });

    describe('Configuration Management', () => {
        it('should update configuration successfully', async () => {
            const newConfig: RuleConfiguration = {
                ...mockConfiguration,
                metadata: {
                    ...mockConfiguration.metadata,
                    name: 'updated-config'
                }
            };

            mockConfigValidator.validateConfiguration.mockResolvedValue({
                success: true,
                value: newConfig
            });

            const result = await ruleEngineService.updateConfiguration(newConfig);

            expect(result.success).toBe(true);
            expect(mockRuleLoader.updateConfiguration).toHaveBeenCalledWith(newConfig);
        });

        it('should handle configuration validation errors', async () => {
            const invalidConfig = {
                metadata: { name: 'invalid-config' },
                invalid: 'config'
            } as any;

            mockConfigValidator.validateConfiguration.mockResolvedValue({
                success: false,
                error: 'Invalid configuration format',
                errors: [{ type: 'schema', message: 'Missing required fields', severity: 'error' }]
            });

            const result = await ruleEngineService.updateConfiguration(invalidConfig);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid configuration format');
        });

        it('should handle configuration update exceptions', async () => {
            const newConfig: RuleConfiguration = mockConfiguration;

            mockConfigValidator.validateConfiguration.mockResolvedValue({
                success: true,
                value: newConfig
            });

            mockRuleLoader.updateConfiguration.mockRejectedValue(new Error('Update failed'));

            const result = await ruleEngineService.updateConfiguration(newConfig);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Configuration update failed');
        });
    });

    describe('Error Handling and Resilience', () => {
        it('should handle field processor exceptions gracefully', async () => {
            mockFieldProcessor.processField.mockRejectedValue(new Error('Field processor error'));

            const result = await ruleEngineService.cleanRow(
                { name: 'Test' },
                { name: ColumnType.TEXT }
            );

            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].message).toContain('Field processing failed');
            expect(result.processedData.name).toBe('Test'); // Original value preserved
        });

        it('should handle batch processing with mixed results', async () => {
            const validationError = new ValidationError(
                ValidationErrorType.INVALID_FORMAT,
                'name',
                'Invalid Name',
                'Name validation failed'
            );

            mockFieldProcessor.processField
                .mockResolvedValueOnce({
                    fieldName: 'name',
                    originalValue: 'Valid Name',
                    processedValue: 'Valid Name',
                    success: true,
                    errors: [],
                    appliedRules: ['text-cleanup']
                })
                .mockResolvedValueOnce({
                    fieldName: 'name',
                    originalValue: 'Invalid Name',
                    processedValue: 'Invalid Name',
                    success: false,
                    errors: [validationError],
                    appliedRules: ['text-cleanup']
                });

            const rows = [
                { name: 'Valid Name' },
                { name: 'Invalid Name' }
            ];

            const results = await ruleEngineService.cleanBatch(rows, { name: ColumnType.TEXT });

            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(false);
            expect(results[1].errors).toHaveLength(1);
        });

        it('should handle timeout scenarios in batch processing', async () => {
            // Mock a slow field processor
            mockFieldProcessor.processField.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve({
                    fieldName: 'name',
                    originalValue: 'Slow Name',
                    processedValue: 'Slow Name',
                    success: true,
                    errors: [],
                    appliedRules: ['text-cleanup']
                }), 100))
            );

            const rows = [{ name: 'Test' }];
            const results = await ruleEngineService.cleanBatch(rows, { name: ColumnType.TEXT });

            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(true);
        });
    });
});
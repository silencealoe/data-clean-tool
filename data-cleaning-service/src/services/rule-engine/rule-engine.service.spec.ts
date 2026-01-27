/**
 * Rule Engine Service Tests
 * 
 * Simplified tests focusing on core functionality
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from './rule-engine.service';
import { FieldProcessorService } from './field-processor.service';
import { RuleLoaderService } from './rule-loader.service';
import { ConfigValidatorService } from './config-validator.service';
import { ColumnType } from '../../common/types';
import { RuleConfiguration, ValidationErrorType } from '../../common/types/rule-engine.types';

describe('RuleEngineService', () => {
    let service: RuleEngineService;
    let mockFieldProcessor: any;
    let mockRuleLoader: any;
    let mockConfigValidator: any;

    const mockConfiguration: RuleConfiguration = {
        metadata: {
            name: 'test-rules',
            description: 'Test configuration',
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

    beforeEach(async () => {
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
                { provide: ConfigValidatorService, useValue: mockConfigValidator }
            ],
        }).compile();

        service = module.get<RuleEngineService>(RuleEngineService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should process empty row successfully', async () => {
        const result = await service.cleanRow({}, {});

        expect(result.success).toBe(true);
        expect(result.fieldResults).toHaveLength(0);
        expect(result.processedData).toEqual({});
        expect(result.errors).toHaveLength(0);
    });

    it('should process single field successfully', async () => {
        mockFieldProcessor.processField.mockResolvedValue({
            fieldName: 'name',
            originalValue: 'test',
            processedValue: 'test',
            success: true,
            errors: [],
            appliedRules: []
        });

        const result = await service.cleanRow({ name: 'test' }, { name: ColumnType.TEXT });

        expect(result.success).toBe(true);
        expect(result.fieldResults).toHaveLength(1);
        expect(result.processedData.name).toBe('test');
    });

    it('should handle field processing errors', async () => {
        mockFieldProcessor.processField.mockResolvedValue({
            fieldName: 'name',
            originalValue: 'test',
            processedValue: 'test',
            success: false,
            errors: [{
                type: ValidationErrorType.INVALID_FORMAT,
                field: 'name',
                originalValue: 'test',
                message: 'Test error'
            }],
            appliedRules: []
        });

        const result = await service.cleanRow({ name: 'test' }, { name: ColumnType.TEXT });

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
    });

    it('should process empty batch', async () => {
        const results = await service.cleanBatch([], {});
        expect(results).toHaveLength(0);
    });

    it('should get current configuration', () => {
        const config = service.getConfiguration();
        expect(config).toEqual(mockConfiguration);
    });

    it('should update configuration successfully', async () => {
        mockConfigValidator.validateConfiguration.mockResolvedValue({
            success: true,
            value: mockConfiguration
        });

        const result = await service.updateConfiguration(mockConfiguration);
        expect(result.success).toBe(true);
    });

    it('should convert to legacy format', () => {
        const ruleResults = [{
            success: true,
            fieldResults: [{
                fieldName: 'name',
                originalValue: 'test',
                processedValue: 'test',
                success: true,
                errors: [],
                appliedRules: []
            }],
            processedData: { name: 'test' },
            errors: [],
            metadata: { processingTime: 10, rulesApplied: 1, fieldsProcessed: 1 }
        }];

        const legacy = service.convertToLegacyFormat(ruleResults, 'job-123');
        expect(legacy.jobId).toBe('job-123');
        expect(legacy.cleanData).toHaveLength(1);
    });
});
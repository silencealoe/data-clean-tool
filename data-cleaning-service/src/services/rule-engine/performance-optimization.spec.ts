/**
 * Performance Optimization Tests
 * 
 * Tests for strategy caching and parallel processing functionality
 */

import { Test, TestingModule } from '@nestjs/testing';
import { StrategyCacheService } from './strategy-cache.service';
import { ParallelProcessorService } from './parallel-processor.service';
import { FieldProcessorService } from './field-processor.service';
import { StrategyFactoryService } from './strategy-factory.service';
import { RuleLoaderService } from './rule-loader.service';
import {
    ValidationStrategy,
    ValidationParams,
    ValidationResult,
    RegexParams
} from '../../common/types/rule-engine.types';

// Mock validation strategy for testing
class MockValidationStrategy implements ValidationStrategy {
    readonly name = 'mock-strategy';
    readonly description = 'Mock strategy for testing';

    validate(value: any, params: ValidationParams): ValidationResult {
        return {
            success: true,
            value: `processed_${value}`
        };
    }

    validateParams(params: ValidationParams): boolean {
        return true;
    }
}

describe('Performance Optimization', () => {
    let strategyCacheService: StrategyCacheService;
    let parallelProcessorService: ParallelProcessorService;
    let fieldProcessorService: FieldProcessorService;
    let strategyFactoryService: StrategyFactoryService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StrategyCacheService,
                {
                    provide: FieldProcessorService,
                    useValue: {
                        processField: jest.fn().mockResolvedValue({
                            fieldName: 'test',
                            originalValue: 'test',
                            processedValue: 'processed_test',
                            success: true,
                            errors: [],
                            appliedRules: ['mock-rule']
                        })
                    }
                },
                {
                    provide: StrategyFactoryService,
                    useValue: {
                        createStrategy: jest.fn(),
                        registerStrategy: jest.fn(),
                        getCacheStats: jest.fn().mockReturnValue({
                            hits: 0,
                            misses: 0,
                            evictions: 0,
                            size: 0,
                            hitRate: 0
                        })
                    }
                },
                {
                    provide: RuleLoaderService,
                    useValue: {
                        getCurrentConfiguration: jest.fn().mockReturnValue({
                            metadata: { name: 'test', version: '1.0.0', description: 'test', priority: 1 },
                            fieldRules: {},
                            globalSettings: { strictMode: false, continueOnError: true, maxErrors: 10 }
                        })
                    }
                }
            ]
        }).compile();

        strategyCacheService = module.get<StrategyCacheService>(StrategyCacheService);
        fieldProcessorService = module.get<FieldProcessorService>(FieldProcessorService);
        strategyFactoryService = module.get<StrategyFactoryService>(StrategyFactoryService);

        parallelProcessorService = new ParallelProcessorService(fieldProcessorService, {
            maxConcurrency: 2,
            batchSize: 10,
            fieldTimeoutMs: 1000,
            enabled: true
        });
    });

    afterEach(async () => {
        await parallelProcessorService.shutdown();
        strategyCacheService.shutdown();
    });

    describe('Strategy Caching', () => {
        it('should cache strategy instances', () => {
            const mockStrategy = new MockValidationStrategy();
            const params: RegexParams = { pattern: 'test' };

            // First call should create and cache
            const strategy1 = strategyCacheService.getOrCreateStrategy('mock-strategy', mockStrategy, params);
            expect(strategy1).toBe(mockStrategy);

            // Second call should return cached instance
            const strategy2 = strategyCacheService.getOrCreateStrategy('mock-strategy', mockStrategy, params);
            expect(strategy2).toBe(mockStrategy);

            const stats = strategyCacheService.getStats();
            expect(stats.hits).toBe(1);
            expect(stats.misses).toBe(1);
            expect(stats.size).toBe(1);
        });

        it('should handle cache invalidation', () => {
            const mockStrategy = new MockValidationStrategy();
            const params: RegexParams = { pattern: 'test' };

            // Cache a strategy
            strategyCacheService.getOrCreateStrategy('mock-strategy', mockStrategy, params);
            expect(strategyCacheService.hasStrategy('mock-strategy', params)).toBe(true);

            // Invalidate cache
            strategyCacheService.invalidateStrategy('mock-strategy', params);
            expect(strategyCacheService.hasStrategy('mock-strategy', params)).toBe(false);
        });

        it('should warm up cache with multiple strategies', () => {
            const mockStrategy = new MockValidationStrategy();
            const strategies = [
                { name: 'mock-strategy', strategy: mockStrategy, params: { pattern: 'test1' } },
                { name: 'mock-strategy', strategy: mockStrategy, params: { pattern: 'test2' } }
            ];

            strategyCacheService.warmUpCache(strategies);

            const stats = strategyCacheService.getStats();
            expect(stats.size).toBe(2);
        });

        it('should clear all cached strategies', () => {
            const mockStrategy = new MockValidationStrategy();
            const params: RegexParams = { pattern: 'test' };

            strategyCacheService.getOrCreateStrategy('mock-strategy', mockStrategy, params);
            expect(strategyCacheService.getStats().size).toBe(1);

            strategyCacheService.clearCache();
            expect(strategyCacheService.getStats().size).toBe(0);
        });
    });

    describe('Parallel Processing', () => {
        it('should process row data in parallel', async () => {
            const rowData = {
                field1: 'value1',
                field2: 'value2',
                field3: 'value3'
            };
            const columnTypes = {
                field1: 'TEXT',
                field2: 'TEXT',
                field3: 'TEXT'
            };

            const result = await parallelProcessorService.processRowParallel(rowData, columnTypes);

            expect(result.fieldResults).toHaveLength(3);
            expect(result.metrics).toBeDefined();
            expect(result.metrics.parallelFields).toBe(3);
            expect(result.metrics.totalTime).toBeGreaterThan(0);
        });

        it('should determine when to use parallel processing', () => {
            // Should use parallel for many fields
            expect(parallelProcessorService.shouldUseParallelProcessing(6)).toBe(true);

            // Should use parallel for multiple rows with moderate fields
            expect(parallelProcessorService.shouldUseParallelProcessing(3, 2)).toBe(true);

            // Should not use parallel for few fields
            expect(parallelProcessorService.shouldUseParallelProcessing(2)).toBe(false);

            // Should use parallel for large total field count
            expect(parallelProcessorService.shouldUseParallelProcessing(4, 6)).toBe(true);
        });

        it('should update parallel processing configuration', () => {
            const newConfig = {
                maxConcurrency: 8,
                batchSize: 50,
                enabled: false
            };

            parallelProcessorService.updateConfig(newConfig);
            const config = parallelProcessorService.getConfig();

            expect(config.maxConcurrency).toBe(8);
            expect(config.batchSize).toBe(50);
            expect(config.enabled).toBe(false);
        });

        it('should provide worker pool statistics', () => {
            const stats = parallelProcessorService.getWorkerPoolStats();

            expect(stats).toHaveProperty('maxConcurrency');
            expect(stats).toHaveProperty('activeTasks');
            expect(stats).toHaveProperty('availableSlots');
            expect(stats.maxConcurrency).toBe(2); // From initial config
        });

        it('should process multiple rows in parallel', async () => {
            const rows = [
                { field1: 'value1', field2: 'value2' },
                { field1: 'value3', field2: 'value4' },
                { field1: 'value5', field2: 'value6' }
            ];
            const columnTypes = { field1: 'TEXT', field2: 'TEXT' };

            const results = await parallelProcessorService.processRowsParallel(rows, columnTypes);

            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result.fieldResults).toHaveLength(2);
                expect(result.metrics).toBeDefined();
            });
        });
    });

    describe('Integration', () => {
        it('should work together - cache and parallel processing', async () => {
            // This test verifies that caching and parallel processing work together
            const mockStrategy = new MockValidationStrategy();
            strategyFactoryService.registerStrategy(mockStrategy);

            const rowData = {
                field1: 'value1',
                field2: 'value2',
                field3: 'value3',
                field4: 'value4',
                field5: 'value5'
            };
            const columnTypes = {
                field1: 'TEXT',
                field2: 'TEXT',
                field3: 'TEXT',
                field4: 'TEXT',
                field5: 'TEXT'
            };

            // Process with parallel processing enabled
            const result = await parallelProcessorService.processRowParallel(rowData, columnTypes);

            expect(result.fieldResults).toHaveLength(5);
            expect(result.metrics.parallelFields).toBe(5);

            // Verify that field processor was called for each field
            expect(fieldProcessorService.processField).toHaveBeenCalledTimes(5);
        });
    });
});
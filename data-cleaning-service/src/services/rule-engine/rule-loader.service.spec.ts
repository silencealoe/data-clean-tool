/**
 * Rule Loader Service Tests
 * 
 * Tests for the RuleLoaderService including file loading, caching, validation,
 * and environment variable loading functionality.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { promises as fs } from 'fs';
import { join } from 'path';
import { RuleLoaderService } from './rule-loader.service';
import { RuleConfiguration, ValidationErrorType } from '../../common/types/rule-engine.types';

// Mock fs module
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        stat: jest.fn()
    }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('RuleLoaderService', () => {
    let service: RuleLoaderService;
    let mockValidConfig: RuleConfiguration;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [RuleLoaderService],
        }).compile();

        service = module.get<RuleLoaderService>(RuleLoaderService);

        // Setup mock valid configuration
        mockValidConfig = {
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

        // Clear all mocks
        jest.clearAllMocks();

        // Clear cache before each test
        service.clearCache();
    });

    describe('loadFromFile', () => {
        it('should successfully load valid configuration from file', async () => {
            // Arrange
            const filePath = 'config/test-rules.json';
            const fileContent = JSON.stringify(mockValidConfig);

            mockFs.stat.mockResolvedValue({ isFile: () => true } as any);
            mockFs.readFile.mockResolvedValue(fileContent);

            // Act
            const result = await service.loadFromFile(filePath);

            // Assert
            expect(result).toEqual(mockValidConfig);
            expect(mockFs.readFile).toHaveBeenCalledWith(
                expect.stringContaining('test-rules.json'),
                'utf-8'
            );
        });

        it('should throw error for non-existent file', async () => {
            // Arrange
            const filePath = 'config/non-existent.json';
            mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

            // Act & Assert
            await expect(service.loadFromFile(filePath)).rejects.toThrow(
                'Configuration file not found'
            );
        });

        it('should throw error for invalid JSON', async () => {
            // Arrange
            const filePath = 'config/invalid.json';
            const invalidJson = '{ invalid json }';

            mockFs.stat.mockResolvedValue({ isFile: () => true } as any);
            mockFs.readFile.mockResolvedValue(invalidJson);

            // Act & Assert
            await expect(service.loadFromFile(filePath)).rejects.toThrow();
        });

        it('should throw error for configuration that fails schema validation', async () => {
            // Arrange
            const filePath = 'config/invalid-schema.json';
            const invalidConfig = {
                metadata: {
                    name: 'test'
                    // Missing required fields
                },
                fieldRules: {},
                globalSettings: {}
            };

            mockFs.stat.mockResolvedValue({ isFile: () => true } as any);
            mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

            // Act & Assert
            await expect(service.loadFromFile(filePath)).rejects.toThrow(
                'Configuration validation failed'
            );
        });

        it('should return cached configuration on second call', async () => {
            // Arrange
            const filePath = 'config/cached-rules.json';
            const fileContent = JSON.stringify(mockValidConfig);

            mockFs.stat.mockResolvedValue({ isFile: () => true } as any);
            mockFs.readFile.mockResolvedValue(fileContent);

            // Act
            const result1 = await service.loadFromFile(filePath);
            const result2 = await service.loadFromFile(filePath);

            // Assert
            expect(result1).toEqual(mockValidConfig);
            expect(result2).toEqual(mockValidConfig);
            expect(mockFs.readFile).toHaveBeenCalledTimes(1); // Should only read file once
        });

        it('should return default configuration for default config file failure', async () => {
            // Arrange
            const defaultFilePath = 'config/rule-engine/default-rules.json';
            mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

            // Act
            const result = await service.loadFromFile(defaultFilePath);

            // Assert
            expect(result).toBeDefined();
            expect(result.metadata.name).toBe('fallback-default-rules');
            expect(result.fieldRules).toBeDefined();
            expect(result.globalSettings).toBeDefined();
        });
    });

    describe('loadFromDatabase', () => {
        it('should return default configuration (placeholder implementation)', async () => {
            // Act
            const result = await service.loadFromDatabase();

            // Assert
            expect(result).toBeDefined();
            expect(result.metadata).toBeDefined();
            expect(result.fieldRules).toBeDefined();
            expect(result.globalSettings).toBeDefined();
        });

        it('should cache database configuration', async () => {
            // Act
            const result1 = await service.loadFromDatabase();
            const result2 = await service.loadFromDatabase();

            // Assert
            expect(result1).toEqual(result2);
        });
    });

    describe('loadFromEnvironment', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            // Reset environment
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            // Restore environment
            process.env = originalEnv;
        });

        it('should load metadata from environment variables', () => {
            // Arrange
            process.env.RULE_CONFIG_NAME = 'env-rules';
            process.env.RULE_CONFIG_DESCRIPTION = 'Rules from environment';
            process.env.RULE_CONFIG_VERSION = '2.0.0';
            process.env.RULE_CONFIG_PRIORITY = '200';

            // Act
            const result = service.loadFromEnvironment();

            // Assert
            expect(result.metadata).toEqual({
                name: 'env-rules',
                description: 'Rules from environment',
                version: '2.0.0',
                priority: 200
            });
        });

        it('should load global settings from environment variables', () => {
            // Arrange
            process.env.RULE_STRICT_MODE = 'true';
            process.env.RULE_CONTINUE_ON_ERROR = 'false';
            process.env.RULE_MAX_ERRORS = '5';

            // Act
            const result = service.loadFromEnvironment();

            // Assert
            expect(result.globalSettings).toEqual({
                strictMode: true,
                continueOnError: false,
                maxErrors: 5
            });
        });

        it('should load field rules from environment JSON', () => {
            // Arrange
            const fieldRules = {
                email: [
                    {
                        name: 'email-validation',
                        strategy: 'regex',
                        params: { pattern: '^.+@.+\\..+$' },
                        required: true
                    }
                ]
            };
            process.env.RULE_FIELD_RULES = JSON.stringify(fieldRules);

            // Act
            const result = service.loadFromEnvironment();

            // Assert
            expect(result.fieldRules).toEqual(fieldRules);
        });

        it('should handle invalid JSON in field rules gracefully', () => {
            // Arrange
            process.env.RULE_FIELD_RULES = '{ invalid json }';

            // Act
            const result = service.loadFromEnvironment();

            // Assert
            expect(result.fieldRules).toBeUndefined();
        });

        it('should return empty object when no environment variables are set', () => {
            // Act
            const result = service.loadFromEnvironment();

            // Assert
            expect(result).toEqual({});
        });
    });

    describe('validateConfiguration', () => {
        it('should return success for valid configuration', () => {
            // Act
            const result = service.validateConfiguration(mockValidConfig);

            // Assert
            expect(result.success).toBe(true);
            expect(result.value).toEqual(mockValidConfig);
        });

        it('should return failure for invalid configuration', () => {
            // Arrange
            const invalidConfig = {
                metadata: {
                    name: 'test'
                    // Missing required fields
                }
                // Missing fieldRules and globalSettings
            };

            // Act
            const result = service.validateConfiguration(invalidConfig);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('validation failed');
            expect(result.errorCode).toBe('SCHEMA_VALIDATION_ERROR');
        });
    });

    describe('cache management', () => {
        it('should clear specific cache entry', async () => {
            // Arrange
            const filePath = 'config/test-rules.json';
            const fileContent = JSON.stringify(mockValidConfig);

            mockFs.stat.mockResolvedValue({ isFile: () => true } as any);
            mockFs.readFile.mockResolvedValue(fileContent);

            // Load configuration to cache it
            await service.loadFromFile(filePath);

            // Act
            service.clearCache(`file:${filePath}`);

            // Load again - should read from file again
            await service.loadFromFile(filePath);

            // Assert
            expect(mockFs.readFile).toHaveBeenCalledTimes(2);
        });

        it('should clear all cache entries', async () => {
            // Arrange
            const filePath1 = 'config/test-rules1.json';
            const filePath2 = 'config/test-rules2.json';
            const fileContent = JSON.stringify(mockValidConfig);

            mockFs.stat.mockResolvedValue({ isFile: () => true } as any);
            mockFs.readFile.mockResolvedValue(fileContent);

            // Load configurations to cache them
            await service.loadFromFile(filePath1);
            await service.loadFromFile(filePath2);

            // Act
            service.clearCache();

            // Load again - should read from files again
            await service.loadFromFile(filePath1);
            await service.loadFromFile(filePath2);

            // Assert
            expect(mockFs.readFile).toHaveBeenCalledTimes(4); // 2 initial + 2 after cache clear
        });

        it('should provide cache statistics', async () => {
            // Arrange
            const filePath = 'config/test-rules.json';
            const fileContent = JSON.stringify(mockValidConfig);

            mockFs.stat.mockResolvedValue({ isFile: () => true } as any);
            mockFs.readFile.mockResolvedValue(fileContent);

            // Load configuration to cache it
            await service.loadFromFile(filePath);

            // Act
            const stats = service.getCacheStats();

            // Assert
            expect(stats.size).toBe(1);
            expect(stats.entries).toHaveLength(1);
            expect(stats.entries[0].key).toBe(`file:${filePath}`);
            expect(stats.entries[0].source).toBe(`file:${filePath}`);
            expect(stats.entries[0].age).toBeGreaterThanOrEqual(0);
        });
    });

    describe('loadWithFallback', () => {
        it('should try custom file first if provided', async () => {
            // Arrange
            const customPath = 'config/custom-rules.json';
            const fileContent = JSON.stringify(mockValidConfig);

            mockFs.stat.mockResolvedValue({ isFile: () => true } as any);
            mockFs.readFile.mockResolvedValue(fileContent);

            // Act
            const result = await service.loadWithFallback(customPath);

            // Assert
            expect(result).toEqual(mockValidConfig);
            expect(mockFs.readFile).toHaveBeenCalledWith(
                expect.stringContaining('custom-rules.json'),
                'utf-8'
            );
        });

        it('should fallback to default configuration when all sources fail', async () => {
            // Arrange
            mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

            // Act
            const result = await service.loadWithFallback('config/non-existent.json');

            // Assert
            expect(result).toBeDefined();
            expect(result.metadata.name).toBe('fallback-default-rules');
        });

        it('should merge environment overrides with file configuration', async () => {
            // Arrange
            const filePath = 'config/test-rules.json';
            const fileContent = JSON.stringify(mockValidConfig);

            mockFs.stat.mockResolvedValue({ isFile: () => true } as any);
            mockFs.readFile.mockResolvedValue(fileContent);

            // Set environment overrides
            process.env.RULE_STRICT_MODE = 'true';
            process.env.RULE_MAX_ERRORS = '5';

            // Act
            const result = await service.loadWithFallback(filePath);

            // Assert
            expect(result.globalSettings.strictMode).toBe(true);
            expect(result.globalSettings.maxErrors).toBe(5);
            expect(result.globalSettings.continueOnError).toBe(true); // From file
        });
    });
});
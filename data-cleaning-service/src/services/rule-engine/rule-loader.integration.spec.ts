/**
 * Rule Loader Integration Tests
 * 
 * Integration tests for RuleLoaderService with actual configuration files
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RuleLoaderService } from './rule-loader.service';

describe('RuleLoaderService Integration', () => {
    let service: RuleLoaderService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [RuleLoaderService],
        }).compile();

        service = module.get<RuleLoaderService>(RuleLoaderService);
    });

    describe('real file loading', () => {
        it('should load the actual default configuration file', async () => {
            // Act
            const result = await service.loadFromFile('config/rule-engine/default-rules.json');

            // Assert
            expect(result).toBeDefined();
            expect(result.metadata).toBeDefined();
            expect(result.metadata.name).toBe('default-cleaning-rules');
            expect(result.fieldRules).toBeDefined();
            expect(result.fieldRules.phone).toBeDefined();
            expect(result.fieldRules.email).toBeDefined();
            expect(result.fieldRules.date).toBeDefined();
            expect(result.globalSettings).toBeDefined();
        });

        it('should validate the actual default configuration', async () => {
            // Arrange - load the actual config file using the service
            const actualConfig = await service.loadFromFile('config/rule-engine/default-rules.json');

            // Act
            const result = service.validateConfiguration(actualConfig);

            // Assert
            expect(result.success).toBe(true);
            expect(result.value).toEqual(actualConfig);
        });

        it('should cache the loaded configuration', async () => {
            // Act - load twice
            const result1 = await service.loadFromFile('config/rule-engine/default-rules.json');
            const result2 = await service.loadFromFile('config/rule-engine/default-rules.json');

            // Assert
            expect(result1).toEqual(result2);

            // Check cache stats
            const stats = service.getCacheStats();
            expect(stats.size).toBeGreaterThan(0);
            expect(stats.entries.some(entry => entry.key.includes('default-rules.json'))).toBe(true);
        });
    });

    describe('fallback loading', () => {
        it('should successfully load with fallback chain', async () => {
            // Act
            const result = await service.loadWithFallback();

            // Assert
            expect(result).toBeDefined();
            expect(result.metadata).toBeDefined();
            expect(result.fieldRules).toBeDefined();
            expect(result.globalSettings).toBeDefined();
        });
    });
});
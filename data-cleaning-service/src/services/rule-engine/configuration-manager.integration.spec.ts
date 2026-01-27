/**
 * Configuration Manager Integration Test
 * 
 * Simple integration test to verify the configuration manager works correctly.
 */

import { ConfigurationManagerService } from './configuration-manager.service';
import { RuleLoaderService } from './rule-loader.service';
import { ConfigValidatorService } from './config-validator.service';
import { RuleConfiguration } from '../../common/types/rule-engine.types';

describe('ConfigurationManagerService Integration', () => {
    let configManager: ConfigurationManagerService;
    let ruleLoader: RuleLoaderService;
    let configValidator: ConfigValidatorService;

    const testConfig: RuleConfiguration = {
        metadata: {
            name: 'integration-test-config',
            description: 'Integration test configuration',
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

    beforeEach(() => {
        ruleLoader = new RuleLoaderService();
        configValidator = new ConfigValidatorService();
        configManager = new ConfigurationManagerService(ruleLoader, configValidator);
    });

    it('should create configuration manager instance', () => {
        expect(configManager).toBeDefined();
        expect(configManager.getConfigurationStats().isInitialized).toBe(false);
    });

    it('should provide default configuration when not initialized', () => {
        const config = configManager.getCurrentConfiguration();
        expect(config).toBeDefined();
        expect(config.metadata.name).toContain('default-fallback-rules');
    });

    it('should get empty field rules when not initialized', () => {
        const rules = configManager.getFieldRules('phone');
        expect(rules).toEqual([]);
    });

    it('should provide configuration statistics', () => {
        const stats = configManager.getConfigurationStats();
        expect(stats).toBeDefined();
        expect(stats.isInitialized).toBe(false);
        expect(stats.currentVersion).toBe('none');
        expect(stats.totalFields).toBe(0);
        expect(stats.totalRules).toBe(0);
    });
});
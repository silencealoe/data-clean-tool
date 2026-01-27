/**
 * Rule Loader Service Usage Examples
 * 
 * This file demonstrates how to use the RuleLoaderService to load
 * rule configurations from various sources.
 */

import { RuleLoaderService } from './rule-loader.service';

/**
 * Example: Basic file loading
 */
async function basicFileLoadingExample() {
    console.log('=== Basic File Loading Example ===');

    const ruleLoader = new RuleLoaderService();

    try {
        // Load the default configuration
        const config = await ruleLoader.loadFromFile('config/rule-engine/default-rules.json');

        console.log('Loaded configuration:', {
            name: config.metadata.name,
            version: config.metadata.version,
            fieldCount: Object.keys(config.fieldRules).length,
            strictMode: config.globalSettings.strictMode
        });

        // Show some field rules
        console.log('Phone field rules:', config.fieldRules.phone?.length || 0);
        console.log('Email field rules:', config.fieldRules.email?.length || 0);

    } catch (error) {
        console.error('Failed to load configuration:', error.message);
    }
}

/**
 * Example: Environment variable loading
 */
function environmentLoadingExample() {
    console.log('\n=== Environment Loading Example ===');

    const ruleLoader = new RuleLoaderService();

    // Set some environment variables for demonstration
    process.env.RULE_CONFIG_NAME = 'my-custom-rules';
    process.env.RULE_CONFIG_VERSION = '2.0.0';
    process.env.RULE_STRICT_MODE = 'true';
    process.env.RULE_MAX_ERRORS = '5';

    const envConfig = ruleLoader.loadFromEnvironment();

    console.log('Environment configuration:', envConfig);

    // Clean up
    delete process.env.RULE_CONFIG_NAME;
    delete process.env.RULE_CONFIG_VERSION;
    delete process.env.RULE_STRICT_MODE;
    delete process.env.RULE_MAX_ERRORS;
}

/**
 * Example: Configuration validation
 */
async function validationExample() {
    console.log('\n=== Configuration Validation Example ===');

    const ruleLoader = new RuleLoaderService();

    // Example of a valid configuration
    const validConfig = {
        metadata: {
            name: 'test-rules',
            description: 'Test configuration',
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

    const validResult = ruleLoader.validateConfiguration(validConfig);
    console.log('Valid config validation:', validResult.success);

    // Example of an invalid configuration
    const invalidConfig = {
        metadata: {
            name: 'incomplete-config'
            // Missing required fields
        }
    };

    const invalidResult = ruleLoader.validateConfiguration(invalidConfig);
    console.log('Invalid config validation:', invalidResult.success);
    console.log('Validation error:', invalidResult.error);
}

/**
 * Example: Fallback loading with caching
 */
async function fallbackAndCachingExample() {
    console.log('\n=== Fallback Loading and Caching Example ===');

    const ruleLoader = new RuleLoaderService();

    try {
        // First load - will try multiple sources and cache the result
        console.time('First load');
        const config1 = await ruleLoader.loadWithFallback();
        console.timeEnd('First load');

        // Second load - should be faster due to caching
        console.time('Second load (cached)');
        const config2 = await ruleLoader.loadWithFallback();
        console.timeEnd('Second load (cached)');

        console.log('Configurations are identical:', JSON.stringify(config1) === JSON.stringify(config2));

        // Show cache statistics
        const cacheStats = ruleLoader.getCacheStats();
        console.log('Cache statistics:', {
            size: cacheStats.size,
            entries: cacheStats.entries.map(e => ({ key: e.key, age: e.age }))
        });

    } catch (error) {
        console.error('Fallback loading failed:', error.message);
    }
}

/**
 * Example: Cache management
 */
async function cacheManagementExample() {
    console.log('\n=== Cache Management Example ===');

    const ruleLoader = new RuleLoaderService();

    try {
        // Load some configurations to populate cache
        await ruleLoader.loadFromFile('config/rule-engine/default-rules.json');
        await ruleLoader.loadFromDatabase();

        console.log('Cache size after loading:', ruleLoader.getCacheStats().size);

        // Clear specific cache entry
        ruleLoader.clearCache('file:config/rule-engine/default-rules.json');
        console.log('Cache size after clearing file cache:', ruleLoader.getCacheStats().size);

        // Clear all cache
        ruleLoader.clearCache();
        console.log('Cache size after clearing all:', ruleLoader.getCacheStats().size);

    } catch (error) {
        console.error('Cache management failed:', error.message);
    }
}

/**
 * Run all examples
 */
async function runAllExamples() {
    console.log('Rule Loader Service Examples\n');

    await basicFileLoadingExample();
    environmentLoadingExample();
    await validationExample();
    await fallbackAndCachingExample();
    await cacheManagementExample();

    console.log('\n=== All examples completed ===');
}

// Export for use in other files
export {
    basicFileLoadingExample,
    environmentLoadingExample,
    validationExample,
    fallbackAndCachingExample,
    cacheManagementExample,
    runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
    runAllExamples().catch(console.error);
}
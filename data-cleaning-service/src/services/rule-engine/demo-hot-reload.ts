/**
 * Hot Reload Demo Script
 * 
 * Demonstrates the configuration manager and file watcher working together
 * for hot reloading functionality.
 */

import { ConfigurationManagerService } from './configuration-manager.service';
import { FileWatcherService } from './file-watcher.service';
import { HotReloadIntegrationService } from './hot-reload-integration.service';
import { RuleLoaderService } from './rule-loader.service';
import { ConfigValidatorService } from './config-validator.service';

async function demonstrateHotReload() {
    console.log('🚀 Starting Hot Reload Demo...\n');

    try {
        // Create service instances
        const ruleLoader = new RuleLoaderService();
        const configValidator = new ConfigValidatorService();
        const configManager = new ConfigurationManagerService(ruleLoader, configValidator);
        const fileWatcher = new FileWatcherService();
        const hotReloadIntegration = new HotReloadIntegrationService(configManager, fileWatcher);

        // Initialize the hot reload integration
        console.log('📋 Initializing hot reload integration...');
        await hotReloadIntegration.onModuleInit();

        // Get status
        const status = hotReloadIntegration.getStatus();
        console.log('📊 Hot Reload Status:');
        console.log(`  - Enabled: ${status.enabled}`);
        console.log(`  - Config Manager Initialized: ${status.configManagerInitialized}`);
        console.log(`  - File Watcher Initialized: ${status.fileWatcherInitialized}`);
        console.log(`  - Current Config Version: ${status.configStats.currentVersion}`);
        console.log(`  - Total Fields: ${status.configStats.totalFields}`);
        console.log(`  - Total Rules: ${status.configStats.totalRules}`);
        console.log(`  - Watchers: ${status.watcherStatus.length}`);

        // List watchers
        console.log('\n👀 File Watchers:');
        status.watcherStatus.forEach((watcher, index) => {
            console.log(`  ${index + 1}. ${watcher.filePath}`);
            console.log(`     - Enabled: ${watcher.enabled}`);
            console.log(`     - Watching: ${watcher.isWatching}`);
            console.log(`     - Retry Count: ${watcher.retryCount}`);
        });

        // Demonstrate manual reload
        console.log('\n🔄 Testing manual configuration reload...');
        try {
            await hotReloadIntegration.manualReload();
            console.log('✅ Manual reload completed successfully');
        } catch (error) {
            console.log(`⚠️  Manual reload failed (expected): ${error.message}`);
        }

        // Test file change simulation
        console.log('\n📁 Simulating file change...');
        fileWatcher.triggerFileChange('config/rule-engine/default-rules.json');

        // Wait a bit for events to process
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Cleanup
        console.log('\n🧹 Cleaning up...');
        await hotReloadIntegration.cleanup();

        console.log('✅ Hot Reload Demo completed successfully!\n');

    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the demo if this file is executed directly
if (require.main === module) {
    demonstrateHotReload().catch(console.error);
}

export { demonstrateHotReload };
/**
 * Hot Reload Integration Service
 * 
 * Integrates the configuration manager with the file watcher to enable
 * automatic configuration reloading when files change. This service acts
 * as the bridge between file monitoring and configuration management.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigurationManagerService } from './configuration-manager.service';
import { FileWatcherService } from './file-watcher.service';

/**
 * File change event from file watcher
 */
interface FileChangeEvent {
    filePath: string;
    eventType: 'change' | 'rename' | 'error';
    timestamp: Date;
    stats?: any;
    error?: Error;
}

/**
 * Hot reload integration service implementation
 */
@Injectable()
export class HotReloadIntegrationService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(HotReloadIntegrationService.name);
    private isEnabled = true;

    constructor(
        private readonly configurationManager: ConfigurationManagerService,
        private readonly fileWatcher: FileWatcherService
    ) {
        this.logger.log('HotReloadIntegrationService initialized');
    }

    /**
     * Initialize the hot reload integration
     */
    async onModuleInit(): Promise<void> {
        try {
            this.logger.log('Initializing hot reload integration...');

            // Initialize dependencies
            await this.configurationManager.initialize();
            await this.fileWatcher.initialize();

            // Set up event listeners
            this.setupEventListeners();

            this.logger.log('Hot reload integration initialized successfully');

        } catch (error) {
            this.logger.error('Failed to initialize hot reload integration:', error);
            throw error;
        }
    }

    /**
     * Set up event listeners for file changes and configuration events
     */
    private setupEventListeners(): void {
        // Listen for file change events from the file watcher
        this.fileWatcher.on('fileChanged', (event: FileChangeEvent) => {
            this.handleFileChange(event);
        });

        // Listen for configuration change events from the configuration manager
        this.configurationManager.on('configurationChanged', (event: any) => {
            this.handleConfigurationChange(event);
        });

        this.logger.debug('Event listeners set up for hot reload integration');
    }

    /**
     * Handle file change events from the file watcher
     * @param event File change event
     */
    private async handleFileChange(event: FileChangeEvent): Promise<void> {
        if (!this.isEnabled) {
            this.logger.debug('Hot reload is disabled, ignoring file change');
            return;
        }

        try {
            this.logger.log(`File change detected: ${event.filePath} (${event.eventType})`);

            if (event.eventType === 'error') {
                this.logger.error(`File watcher error for ${event.filePath}:`, event.error);
                return;
            }

            // Only process change and rename events
            if (event.eventType === 'change' || event.eventType === 'rename') {
                await this.triggerConfigurationReload(event);
            }

        } catch (error) {
            this.logger.error(`Error handling file change for ${event.filePath}:`, error);
        }
    }

    /**
     * Trigger configuration reload in response to file changes
     * @param event File change event that triggered the reload
     */
    private async triggerConfigurationReload(event: FileChangeEvent): Promise<void> {
        try {
            this.logger.log(`Triggering configuration reload due to file change: ${event.filePath}`);

            // Add a small delay to ensure file write is complete
            await new Promise(resolve => setTimeout(resolve, 500));

            // Reload configuration
            await this.configurationManager.reloadConfiguration();

            this.logger.log(`Configuration reloaded successfully after file change: ${event.filePath}`);

        } catch (error) {
            this.logger.error(`Failed to reload configuration after file change ${event.filePath}:`, error);

            // Emit an error event that can be handled by other parts of the system
            this.configurationManager.emit('reloadError', {
                filePath: event.filePath,
                error: error.message,
                timestamp: new Date()
            });
        }
    }

    /**
     * Handle configuration change events from the configuration manager
     * @param event Configuration change event
     */
    private handleConfigurationChange(event: any): void {
        this.logger.debug(`Configuration change event: ${event.type} - ${event.version}`);

        // Log configuration changes for audit purposes
        if (event.success) {
            this.logger.log(`Configuration ${event.type} successful: ${event.version} from ${event.source}`);
        } else {
            this.logger.warn(`Configuration ${event.type} failed: ${event.error}`);
        }
    }

    /**
     * Enable or disable hot reload functionality
     * @param enabled Whether to enable hot reload
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        this.logger.log(`Hot reload ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if hot reload is enabled
     * @returns True if enabled, false otherwise
     */
    isHotReloadEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Get status of the hot reload integration
     * @returns Status information
     */
    getStatus(): {
        enabled: boolean;
        configManagerInitialized: boolean;
        fileWatcherInitialized: boolean;
        watcherStatus: Array<{
            filePath: string;
            enabled: boolean;
            isWatching: boolean;
            retryCount: number;
        }>;
        configStats: {
            currentVersion: string;
            historySize: number;
            totalFields: number;
            totalRules: number;
            lastUpdated: Date | null;
            isInitialized: boolean;
        };
    } {
        return {
            enabled: this.isEnabled,
            configManagerInitialized: this.configurationManager['isInitialized'] || false,
            fileWatcherInitialized: this.fileWatcher['isInitialized'] || false,
            watcherStatus: this.fileWatcher.getWatcherStatus(),
            configStats: this.configurationManager.getConfigurationStats()
        };
    }

    /**
     * Manually trigger a configuration reload (for testing or manual operations)
     * @returns Promise that resolves when reload is complete
     */
    async manualReload(): Promise<void> {
        try {
            this.logger.log('Manual configuration reload triggered');
            await this.configurationManager.reloadConfiguration();
            this.logger.log('Manual configuration reload completed successfully');
        } catch (error) {
            this.logger.error('Manual configuration reload failed:', error);
            throw error;
        }
    }

    /**
     * Add a custom file to watch
     * @param filePath File path to watch
     * @param debounceMs Optional debounce time in milliseconds
     */
    async addCustomWatcher(filePath: string, debounceMs: number = 1000): Promise<void> {
        try {
            await this.fileWatcher.addWatcher({
                filePath,
                enabled: true,
                debounceMs,
                maxRetries: 3,
                retryDelayMs: 5000
            });
            this.logger.log(`Custom file watcher added for: ${filePath}`);
        } catch (error) {
            this.logger.error(`Failed to add custom watcher for ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Remove a file watcher
     * @param filePath File path to stop watching
     */
    async removeWatcher(filePath: string): Promise<void> {
        try {
            await this.fileWatcher.removeWatcher(filePath);
            this.logger.log(`File watcher removed for: ${filePath}`);
        } catch (error) {
            this.logger.error(`Failed to remove watcher for ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Cleanup resources when module is destroyed
     */
    async onModuleDestroy(): Promise<void> {
        await this.cleanup();
    }

    /**
     * Cleanup all resources
     */
    async cleanup(): Promise<void> {
        this.logger.log('Cleaning up hot reload integration...');

        try {
            // Remove event listeners
            this.fileWatcher.removeAllListeners('fileChanged');
            this.configurationManager.removeAllListeners('configurationChanged');

            // Cleanup individual services
            await this.fileWatcher.cleanup();
            await this.configurationManager.cleanup();

            this.logger.log('Hot reload integration cleanup completed');

        } catch (error) {
            this.logger.error('Error during hot reload integration cleanup:', error);
        }
    }
}
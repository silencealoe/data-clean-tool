/**
 * File Watcher Service
 * 
 * Monitors configuration files for changes and triggers automatic reload mechanisms.
 * Implements requirement 4.1 from the dynamic rule engine specification.
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import { watch, FSWatcher, Stats } from 'fs';
import { promises as fs } from 'fs';
import { join, resolve, dirname } from 'path';
import {
    FILE_MONITORING,
    CONFIG_PATHS
} from '../../common/constants/rule-engine.constants';

/**
 * File change event data
 */
interface FileChangeEvent {
    filePath: string;
    eventType: 'change' | 'rename' | 'error';
    timestamp: Date;
    stats?: Stats;
    error?: Error;
}

/**
 * Watch configuration for a file
 */
interface WatchConfig {
    filePath: string;
    enabled: boolean;
    debounceMs: number;
    maxRetries: number;
    retryDelayMs: number;
}

/**
 * File watcher service implementation
 */
@Injectable()
export class FileWatcherService extends EventEmitter implements OnModuleDestroy {
    private readonly logger = new Logger(FileWatcherService.name);

    private readonly watchers = new Map<string, FSWatcher>();
    private readonly watchConfigs = new Map<string, WatchConfig>();
    private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
    private readonly retryCounters = new Map<string, number>();

    private isInitialized = false;

    constructor() {
        super();
        this.logger.log('FileWatcherService initialized');
    }

    /**
     * Initialize the file watcher service
     * @returns Promise that resolves when initialization is complete
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            this.logger.log('Initializing file watcher service...');

            // Set up default watch configurations
            await this.setupDefaultWatchers();

            this.isInitialized = true;
            this.logger.log('File watcher service initialized successfully');

        } catch (error) {
            this.logger.error('Failed to initialize file watcher service:', error);
            throw error;
        }
    }

    /**
     * Set up default watchers for configuration files
     */
    private async setupDefaultWatchers(): Promise<void> {
        const defaultConfigs = [
            {
                filePath: CONFIG_PATHS.DEFAULT_CONFIG_FILE,
                enabled: true,
                debounceMs: FILE_MONITORING.WATCH_DEBOUNCE_MS,
                maxRetries: FILE_MONITORING.MAX_RELOAD_ATTEMPTS,
                retryDelayMs: FILE_MONITORING.RELOAD_RETRY_DELAY_MS
            },
            {
                filePath: CONFIG_PATHS.CUSTOM_CONFIG_FILE,
                enabled: true,
                debounceMs: FILE_MONITORING.WATCH_DEBOUNCE_MS,
                maxRetries: FILE_MONITORING.MAX_RELOAD_ATTEMPTS,
                retryDelayMs: FILE_MONITORING.RELOAD_RETRY_DELAY_MS
            }
        ];

        for (const config of defaultConfigs) {
            try {
                await this.addWatcher(config);
            } catch (error) {
                this.logger.warn(`Failed to add default watcher for ${config.filePath}:`, error.message);
                // Continue with other watchers even if one fails
            }
        }
    }

    /**
     * Add a file watcher for a specific file
     * @param config Watch configuration
     * @returns Promise that resolves when watcher is added
     */
    async addWatcher(config: WatchConfig): Promise<void> {
        const absolutePath = this.resolveFilePath(config.filePath);
        const watchKey = this.getWatchKey(absolutePath);

        try {
            // Remove existing watcher if present
            if (this.watchers.has(watchKey)) {
                await this.removeWatcher(absolutePath);
            }

            // Store configuration
            this.watchConfigs.set(watchKey, { ...config, filePath: absolutePath });

            // Check if file exists, if not, watch the directory
            const watchPath = await this.determineWatchPath(absolutePath);

            // Create file system watcher
            const watcher = watch(watchPath, { persistent: true }, (eventType, filename) => {
                this.handleFileSystemEvent(absolutePath, eventType, filename);
            });

            // Handle watcher errors
            watcher.on('error', (error) => {
                this.handleWatcherError(absolutePath, error);
            });

            this.watchers.set(watchKey, watcher);
            this.retryCounters.set(watchKey, 0);

            this.logger.log(`File watcher added for: ${config.filePath} (watching: ${watchPath})`);

        } catch (error) {
            this.logger.error(`Failed to add file watcher for ${config.filePath}:`, error);
            throw error;
        }
    }

    /**
     * Remove a file watcher
     * @param filePath File path to stop watching
     * @returns Promise that resolves when watcher is removed
     */
    async removeWatcher(filePath: string): Promise<void> {
        const absolutePath = this.resolveFilePath(filePath);
        const watchKey = this.getWatchKey(absolutePath);

        try {
            // Clear debounce timer
            const timer = this.debounceTimers.get(watchKey);
            if (timer) {
                clearTimeout(timer);
                this.debounceTimers.delete(watchKey);
            }

            // Close watcher
            const watcher = this.watchers.get(watchKey);
            if (watcher) {
                watcher.close();
                this.watchers.delete(watchKey);
            }

            // Clean up configuration and counters
            this.watchConfigs.delete(watchKey);
            this.retryCounters.delete(watchKey);

            this.logger.log(`File watcher removed for: ${filePath}`);

        } catch (error) {
            this.logger.error(`Failed to remove file watcher for ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Enable or disable a file watcher
     * @param filePath File path of the watcher
     * @param enabled Whether to enable or disable
     */
    setWatcherEnabled(filePath: string, enabled: boolean): void {
        const absolutePath = this.resolveFilePath(filePath);
        const watchKey = this.getWatchKey(absolutePath);
        const config = this.watchConfigs.get(watchKey);

        if (config) {
            config.enabled = enabled;
            this.logger.log(`File watcher ${enabled ? 'enabled' : 'disabled'} for: ${filePath}`);
        } else {
            this.logger.warn(`No watcher configuration found for: ${filePath}`);
        }
    }

    /**
     * Get status of all watchers
     * @returns Array of watcher status information
     */
    getWatcherStatus(): Array<{
        filePath: string;
        enabled: boolean;
        isWatching: boolean;
        retryCount: number;
        lastEvent?: Date;
    }> {
        const status: Array<{
            filePath: string;
            enabled: boolean;
            isWatching: boolean;
            retryCount: number;
            lastEvent?: Date;
        }> = [];

        for (const [watchKey, config] of Array.from(this.watchConfigs.entries())) {
            const isWatching = this.watchers.has(watchKey);
            const retryCount = this.retryCounters.get(watchKey) || 0;

            status.push({
                filePath: config.filePath,
                enabled: config.enabled,
                isWatching,
                retryCount
            });
        }

        return status;
    }

    /**
     * Manually trigger a file change event (for testing)
     * @param filePath File path to trigger event for
     */
    triggerFileChange(filePath: string): void {
        const absolutePath = this.resolveFilePath(filePath);
        this.logger.debug(`Manually triggering file change event for: ${filePath}`);

        this.emitFileChangeEvent({
            filePath: absolutePath,
            eventType: 'change',
            timestamp: new Date()
        });
    }

    /**
     * Handle file system events from watchers
     * @param filePath File path being watched
     * @param eventType Type of file system event
     * @param filename Filename that changed (may be null)
     */
    private handleFileSystemEvent(filePath: string, eventType: string, filename: string | null): void {
        const watchKey = this.getWatchKey(filePath);
        const config = this.watchConfigs.get(watchKey);

        if (!config || !config.enabled) {
            return;
        }

        // Filter events to only handle relevant files
        if (filename && !this.isRelevantFile(filePath, filename)) {
            return;
        }

        this.logger.debug(`File system event: ${eventType} for ${filePath} (${filename || 'no filename'})`);

        // Debounce the event to avoid multiple rapid triggers
        this.debounceFileEvent(filePath, eventType as 'change' | 'rename');
    }

    /**
     * Debounce file events to avoid rapid successive triggers
     * @param filePath File path that changed
     * @param eventType Type of event
     */
    private debounceFileEvent(filePath: string, eventType: 'change' | 'rename'): void {
        const watchKey = this.getWatchKey(filePath);
        const config = this.watchConfigs.get(watchKey);

        if (!config) {
            return;
        }

        // Clear existing timer
        const existingTimer = this.debounceTimers.get(watchKey);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new timer
        const timer = setTimeout(async () => {
            this.debounceTimers.delete(watchKey);
            await this.processFileChange(filePath, eventType);
        }, config.debounceMs);

        this.debounceTimers.set(watchKey, timer);
    }

    /**
     * Process a debounced file change event
     * @param filePath File path that changed
     * @param eventType Type of event
     */
    private async processFileChange(filePath: string, eventType: 'change' | 'rename'): Promise<void> {
        try {
            // Get file stats if file exists
            let stats: Stats | undefined;
            try {
                stats = await fs.stat(filePath);
            } catch (error) {
                // File might have been deleted
                this.logger.debug(`Could not stat file ${filePath}:`, error.message);
            }

            // Emit file change event
            this.emitFileChangeEvent({
                filePath,
                eventType,
                timestamp: new Date(),
                stats
            });

            // Reset retry counter on successful processing
            const watchKey = this.getWatchKey(filePath);
            this.retryCounters.set(watchKey, 0);

        } catch (error) {
            this.logger.error(`Error processing file change for ${filePath}:`, error);
            await this.handleProcessingError(filePath, error);
        }
    }

    /**
     * Handle watcher errors
     * @param filePath File path of the watcher that errored
     * @param error Error that occurred
     */
    private handleWatcherError(filePath: string, error: Error): void {
        this.logger.error(`File watcher error for ${filePath}:`, error);

        this.emitFileChangeEvent({
            filePath,
            eventType: 'error',
            timestamp: new Date(),
            error
        });

        // Attempt to restart the watcher
        this.attemptWatcherRestart(filePath, error);
    }

    /**
     * Handle processing errors with retry logic
     * @param filePath File path that failed to process
     * @param error Error that occurred
     */
    private async handleProcessingError(filePath: string, error: Error): Promise<void> {
        const watchKey = this.getWatchKey(filePath);
        const config = this.watchConfigs.get(watchKey);

        if (!config) {
            return;
        }

        const currentRetries = this.retryCounters.get(watchKey) || 0;

        if (currentRetries < config.maxRetries) {
            this.retryCounters.set(watchKey, currentRetries + 1);

            this.logger.warn(`Retrying file processing for ${filePath} (attempt ${currentRetries + 1}/${config.maxRetries})`);

            // Wait before retrying
            setTimeout(() => {
                this.processFileChange(filePath, 'change');
            }, config.retryDelayMs);
        } else {
            this.logger.error(`Max retries exceeded for file processing: ${filePath}`);

            this.emitFileChangeEvent({
                filePath,
                eventType: 'error',
                timestamp: new Date(),
                error: new Error(`Max retries exceeded: ${error.message}`)
            });
        }
    }

    /**
     * Attempt to restart a failed watcher
     * @param filePath File path of the failed watcher
     * @param error Original error
     */
    private async attemptWatcherRestart(filePath: string, error: Error): Promise<void> {
        const watchKey = this.getWatchKey(filePath);
        const config = this.watchConfigs.get(watchKey);

        if (!config) {
            return;
        }

        try {
            this.logger.log(`Attempting to restart watcher for: ${filePath}`);

            // Remove the failed watcher
            await this.removeWatcher(filePath);

            // Wait a bit before restarting
            await new Promise(resolve => setTimeout(resolve, config.retryDelayMs));

            // Add the watcher again
            await this.addWatcher(config);

            this.logger.log(`Successfully restarted watcher for: ${filePath}`);

        } catch (restartError) {
            this.logger.error(`Failed to restart watcher for ${filePath}:`, restartError);
        }
    }

    /**
     * Determine the appropriate path to watch (file or directory)
     * @param filePath Target file path
     * @returns Path to watch
     */
    private async determineWatchPath(filePath: string): Promise<string> {
        try {
            const stats = await fs.stat(filePath);
            if (stats.isFile()) {
                return filePath;
            }
        } catch (error) {
            // File doesn't exist, watch the directory instead
            const dir = dirname(filePath);
            try {
                await fs.stat(dir);
                return dir;
            } catch (dirError) {
                // Directory doesn't exist either, create it
                await fs.mkdir(dir, { recursive: true });
                return dir;
            }
        }

        return filePath;
    }

    /**
     * Check if a filename is relevant for the watched file
     * @param watchedPath Path being watched
     * @param filename Filename that changed
     * @returns True if relevant, false otherwise
     */
    private isRelevantFile(watchedPath: string, filename: string): boolean {
        const watchedFilename = watchedPath.split(/[/\\]/).pop();
        return filename === watchedFilename || filename.endsWith('.json');
    }

    /**
     * Resolve file path to absolute path
     * @param filePath Relative or absolute file path
     * @returns Absolute file path
     */
    private resolveFilePath(filePath: string): string {
        if (filePath.startsWith('/') || filePath.match(/^[A-Za-z]:/)) {
            return resolve(filePath);
        }

        // Resolve relative to project root
        return resolve(join(process.cwd(), 'src', filePath));
    }

    /**
     * Generate a unique watch key for a file path
     * @param filePath File path
     * @returns Watch key
     */
    private getWatchKey(filePath: string): string {
        return `watch:${filePath}`;
    }

    /**
     * Emit a file change event
     * @param event File change event data
     */
    private emitFileChangeEvent(event: FileChangeEvent): void {
        this.emit('fileChanged', event);
        this.logger.debug(`File change event emitted: ${event.eventType} - ${event.filePath}`);
    }

    /**
     * Cleanup resources when module is destroyed
     */
    async onModuleDestroy(): Promise<void> {
        await this.cleanup();
    }

    /**
     * Cleanup all watchers and resources
     */
    async cleanup(): Promise<void> {
        this.logger.log('Cleaning up file watcher service...');

        // Clear all debounce timers
        for (const timer of Array.from(this.debounceTimers.values())) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        // Close all watchers
        for (const [watchKey, watcher] of Array.from(this.watchers.entries())) {
            try {
                watcher.close();
            } catch (error) {
                this.logger.warn(`Error closing watcher ${watchKey}:`, error);
            }
        }
        this.watchers.clear();

        // Clear configurations
        this.watchConfigs.clear();
        this.retryCounters.clear();

        // Remove all event listeners
        this.removeAllListeners();

        this.isInitialized = false;
        this.logger.log('File watcher service cleanup completed');
    }
}
/**
 * Strategy Cache Service
 * 
 * Implements caching mechanism for compiled validation strategy instances
 * to optimize repeated instantiation overhead and improve performance.
 * 
 * Requirements: 需求 7.1
 */

import { Injectable, Logger } from '@nestjs/common';
import {
    ValidationStrategy,
    ValidationParams,
    CacheEntry,
    CacheStats
} from '../../common/types/rule-engine.types';

/**
 * Cache configuration options
 */
export interface CacheConfig {
    maxSize: number;
    ttlMs: number;
    cleanupIntervalMs: number;
    enableStats: boolean;
}

/**
 * Strategy cache entry with metadata
 */
interface StrategyCacheEntry extends CacheEntry {
    strategy: ValidationStrategy;
    params: ValidationParams;
    paramsHash: string;
    accessCount: number;
    lastAccessed: number;
    createdAt: number;
}

/**
 * Cache key structure for strategy identification
 */
interface CacheKey {
    strategyName: string;
    paramsHash: string;
}

/**
 * Strategy cache service implementation
 */
@Injectable()
export class StrategyCacheService {
    private readonly logger = new Logger(StrategyCacheService.name);

    private readonly cache = new Map<string, StrategyCacheEntry>();
    private readonly config: CacheConfig;
    private cleanupTimer: NodeJS.Timeout | null = null;
    private stats: CacheStats;

    constructor() {
        this.config = {
            maxSize: 1000,
            ttlMs: 30 * 60 * 1000, // 30 minutes
            cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
            enableStats: true
        };

        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            size: 0,
            hitRate: 0
        };

        this.startCleanupTimer();
        this.logger.log(`Strategy cache initialized with max size: ${this.config.maxSize}, TTL: ${this.config.ttlMs}ms`);
    }

    /**
     * Get cached strategy instance or create new one
     * @param strategyName Name of the strategy
     * @param strategy Strategy instance to cache
     * @param params Strategy parameters
     * @returns Cached or new strategy instance
     */
    getOrCreateStrategy(
        strategyName: string,
        strategy: ValidationStrategy,
        params: ValidationParams
    ): ValidationStrategy {
        const cacheKey = this.generateCacheKey(strategyName, params);
        const entry = this.cache.get(cacheKey);

        if (entry && this.isEntryValid(entry)) {
            // Cache hit
            entry.accessCount++;
            entry.lastAccessed = Date.now();

            if (this.config.enableStats) {
                this.stats.hits++;
                this.updateHitRate();
            }

            this.logger.debug(`Strategy cache hit: ${strategyName} (${entry.accessCount} accesses)`);
            return entry.strategy;
        }

        // Cache miss - create new entry
        const newEntry = this.createCacheEntry(strategyName, strategy, params);
        this.cache.set(cacheKey, newEntry);

        if (this.config.enableStats) {
            this.stats.misses++;
            this.stats.size = this.cache.size;
            this.updateHitRate();
        }

        // Check if cache size exceeds limit
        if (this.cache.size > this.config.maxSize) {
            this.evictLeastRecentlyUsed();
        }

        this.logger.debug(`Strategy cached: ${strategyName} (cache size: ${this.cache.size})`);
        return strategy;
    }

    /**
     * Check if a strategy is cached
     * @param strategyName Name of the strategy
     * @param params Strategy parameters
     * @returns True if strategy is cached and valid
     */
    hasStrategy(strategyName: string, params: ValidationParams): boolean {
        const cacheKey = this.generateCacheKey(strategyName, params);
        const entry = this.cache.get(cacheKey);
        return entry !== undefined && this.isEntryValid(entry);
    }

    /**
     * Invalidate cached strategy
     * @param strategyName Name of the strategy to invalidate
     * @param params Optional specific parameters to invalidate
     */
    invalidateStrategy(strategyName: string, params?: ValidationParams): void {
        if (params) {
            // Invalidate specific strategy with parameters
            const cacheKey = this.generateCacheKey(strategyName, params);
            const deleted = this.cache.delete(cacheKey);
            if (deleted) {
                this.logger.debug(`Invalidated cached strategy: ${strategyName}`);
            }
        } else {
            // Invalidate all strategies with this name
            let deletedCount = 0;
            for (const [key, entry] of this.cache.entries()) {
                if (entry.strategy.name === strategyName) {
                    this.cache.delete(key);
                    deletedCount++;
                }
            }
            this.logger.debug(`Invalidated ${deletedCount} cached strategies for: ${strategyName}`);
        }

        if (this.config.enableStats) {
            this.stats.size = this.cache.size;
        }
    }

    /**
     * Clear all cached strategies
     */
    clearCache(): void {
        const previousSize = this.cache.size;
        this.cache.clear();

        if (this.config.enableStats) {
            this.stats.size = 0;
            this.stats.evictions += previousSize;
        }

        this.logger.log(`Strategy cache cleared (${previousSize} entries removed)`);
    }

    /**
     * Get cache statistics
     * @returns Current cache statistics
     */
    getStats(): CacheStats {
        return {
            ...this.stats,
            size: this.cache.size
        };
    }

    /**
     * Get detailed cache information
     * @returns Detailed cache information
     */
    getCacheInfo(): {
        config: CacheConfig;
        stats: CacheStats;
        entries: Array<{
            strategyName: string;
            paramsHash: string;
            accessCount: number;
            lastAccessed: Date;
            createdAt: Date;
            age: number;
        }>;
    } {
        const now = Date.now();
        const entries = Array.from(this.cache.values()).map(entry => ({
            strategyName: entry.strategy.name,
            paramsHash: entry.paramsHash,
            accessCount: entry.accessCount,
            lastAccessed: new Date(entry.lastAccessed),
            createdAt: new Date(entry.createdAt),
            age: now - entry.createdAt
        }));

        return {
            config: this.config,
            stats: this.getStats(),
            entries
        };
    }

    /**
     * Warm up cache with commonly used strategies
     * @param strategies Array of strategy configurations to pre-cache
     */
    warmUpCache(strategies: Array<{ name: string; strategy: ValidationStrategy; params: ValidationParams }>): void {
        this.logger.log(`Warming up cache with ${strategies.length} strategies...`);

        for (const { name, strategy, params } of strategies) {
            try {
                this.getOrCreateStrategy(name, strategy, params);
            } catch (error) {
                this.logger.warn(`Failed to warm up strategy ${name}:`, error);
            }
        }

        this.logger.log(`Cache warm-up completed. Cache size: ${this.cache.size}`);
    }

    /**
     * Cleanup expired entries and optimize cache
     */
    cleanup(): void {
        const now = Date.now();
        let expiredCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (!this.isEntryValid(entry)) {
                this.cache.delete(key);
                expiredCount++;
            }
        }

        if (expiredCount > 0) {
            this.logger.debug(`Cache cleanup: removed ${expiredCount} expired entries`);

            if (this.config.enableStats) {
                this.stats.evictions += expiredCount;
                this.stats.size = this.cache.size;
            }
        }
    }

    /**
     * Shutdown cache service and cleanup resources
     */
    shutdown(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        this.clearCache();
        this.logger.log('Strategy cache service shutdown');
    }

    /**
     * Generate cache key from strategy name and parameters
     * @param strategyName Name of the strategy
     * @param params Strategy parameters
     * @returns Cache key string
     */
    private generateCacheKey(strategyName: string, params: ValidationParams): string {
        const paramsHash = this.hashParams(params);
        return `${strategyName}:${paramsHash}`;
    }

    /**
     * Create hash from parameters for cache key
     * @param params Strategy parameters
     * @returns Parameter hash string
     */
    private hashParams(params: ValidationParams): string {
        if (!params || typeof params !== 'object') {
            return 'empty';
        }

        // Create deterministic hash from sorted parameters
        const sortedParams = JSON.stringify(params, Object.keys(params).sort());
        let hash = 0;

        for (let i = 0; i < sortedParams.length; i++) {
            const char = sortedParams.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return Math.abs(hash).toString(16);
    }

    /**
     * Create new cache entry
     * @param strategyName Name of the strategy
     * @param strategy Strategy instance
     * @param params Strategy parameters
     * @returns New cache entry
     */
    private createCacheEntry(
        strategyName: string,
        strategy: ValidationStrategy,
        params: ValidationParams
    ): StrategyCacheEntry {
        const now = Date.now();
        return {
            strategy,
            params,
            paramsHash: this.hashParams(params),
            accessCount: 1,
            lastAccessed: now,
            createdAt: now,
            expiresAt: now + this.config.ttlMs
        };
    }

    /**
     * Check if cache entry is still valid
     * @param entry Cache entry to check
     * @returns True if entry is valid
     */
    private isEntryValid(entry: StrategyCacheEntry): boolean {
        return Date.now() < entry.expiresAt;
    }

    /**
     * Evict least recently used entries when cache is full
     */
    private evictLeastRecentlyUsed(): void {
        if (this.cache.size <= this.config.maxSize) {
            return;
        }

        // Sort entries by last accessed time (oldest first)
        const entries = Array.from(this.cache.entries())
            .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

        // Remove oldest entries until we're under the limit
        const toRemove = this.cache.size - this.config.maxSize + 1;
        let removedCount = 0;

        for (let i = 0; i < toRemove && i < entries.length; i++) {
            const [key] = entries[i];
            this.cache.delete(key);
            removedCount++;
        }

        if (this.config.enableStats) {
            this.stats.evictions += removedCount;
            this.stats.size = this.cache.size;
        }

        this.logger.debug(`Evicted ${removedCount} LRU entries from strategy cache`);
    }

    /**
     * Update hit rate statistics
     */
    private updateHitRate(): void {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    }

    /**
     * Start cleanup timer for periodic cache maintenance
     */
    private startCleanupTimer(): void {
        if (this.config.cleanupIntervalMs > 0) {
            this.cleanupTimer = setInterval(() => {
                this.cleanup();
            }, this.config.cleanupIntervalMs);
        }
    }
}
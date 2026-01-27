import { Injectable, Logger } from '@nestjs/common';
import {
    ValidationStrategy,
    StrategyFactory as IStrategyFactory,
    ValidationError,
    ValidationErrorType,
    ValidationParams
} from '../../common/types/rule-engine.types';
import { VALIDATION_STRATEGIES, DEFAULT_ERROR_MESSAGES } from '../../common/constants/rule-engine.constants';
import { StrategyCacheService } from './strategy-cache.service';

/**
 * Strategy Factory Service
 * 
 * Implements the strategy factory pattern for dynamic validation strategy registration and creation.
 * Supports runtime strategy discovery and instantiation based on configuration.
 * 
 * Requirements: 需求 3.1, 10.1, 10.4
 */
@Injectable()
export class StrategyFactoryService implements IStrategyFactory {
    private readonly logger = new Logger(StrategyFactoryService.name);
    private readonly strategies = new Map<string, ValidationStrategy>();
    private readonly strategyCache: StrategyCacheService;

    constructor() {
        this.strategyCache = new StrategyCacheService();
        this.logger.log('Strategy factory initialized with caching enabled');
    }

    /**
     * Register a new validation strategy
     * @param strategy The validation strategy to register
     */
    registerStrategy(strategy: ValidationStrategy): void {
        if (!strategy) {
            throw new ValidationError(
                ValidationErrorType.CONFIGURATION_ERROR,
                'strategy',
                null,
                'Strategy cannot be null or undefined'
            );
        }

        if (!strategy.name || typeof strategy.name !== 'string') {
            throw new ValidationError(
                ValidationErrorType.CONFIGURATION_ERROR,
                'strategy.name',
                strategy.name,
                'Strategy name must be a non-empty string'
            );
        }

        if (!strategy.description || typeof strategy.description !== 'string') {
            throw new ValidationError(
                ValidationErrorType.CONFIGURATION_ERROR,
                'strategy.description',
                strategy.description,
                'Strategy description must be a non-empty string'
            );
        }

        if (typeof strategy.validate !== 'function') {
            throw new ValidationError(
                ValidationErrorType.CONFIGURATION_ERROR,
                'strategy.validate',
                typeof strategy.validate,
                'Strategy must implement validate method'
            );
        }

        if (typeof strategy.validateParams !== 'function') {
            throw new ValidationError(
                ValidationErrorType.CONFIGURATION_ERROR,
                'strategy.validateParams',
                typeof strategy.validateParams,
                'Strategy must implement validateParams method'
            );
        }

        if (this.strategies.has(strategy.name)) {
            this.logger.warn(`Strategy '${strategy.name}' is being overridden`);
        }

        this.strategies.set(strategy.name, strategy);
        this.logger.log(`Strategy '${strategy.name}' registered successfully`);
    }

    /**
     * Create a validation strategy instance by name with caching
     * @param strategyName The name of the strategy to create
     * @param params Optional parameters for strategy caching
     * @returns The validation strategy instance or null if not found
     */
    createStrategy(strategyName: string, params?: ValidationParams): ValidationStrategy | null {
        if (!strategyName || typeof strategyName !== 'string') {
            this.logger.error(`Invalid strategy name: ${strategyName}`);
            return null;
        }

        const strategy = this.strategies.get(strategyName);
        if (!strategy) {
            this.logger.error(`Strategy '${strategyName}' not found`);
            return null;
        }

        // Use cache if parameters are provided
        if (params) {
            const cachedStrategy = this.strategyCache.getOrCreateStrategy(strategyName, strategy, params);
            this.logger.debug(`Retrieved strategy from cache: ${strategyName}`);
            return cachedStrategy;
        }

        this.logger.debug(`Created strategy instance: ${strategyName}`);
        return strategy;
    }

    /**
     * Get all available strategy names
     * @returns Array of registered strategy names
     */
    getAvailableStrategies(): string[] {
        return Array.from(this.strategies.keys());
    }

    /**
     * Check if a strategy is registered
     * @param strategyName The name of the strategy to check
     * @returns True if the strategy is registered, false otherwise
     */
    hasStrategy(strategyName: string): boolean {
        if (!strategyName || typeof strategyName !== 'string') {
            return false;
        }
        return this.strategies.has(strategyName);
    }

    /**
     * Unregister a strategy (useful for testing and dynamic updates)
     * @param strategyName The name of the strategy to unregister
     * @returns True if the strategy was unregistered, false if it wasn't found
     */
    unregisterStrategy(strategyName: string): boolean {
        if (!strategyName || typeof strategyName !== 'string') {
            return false;
        }

        const existed = this.strategies.delete(strategyName);
        if (existed) {
            this.logger.log(`Strategy '${strategyName}' unregistered successfully`);
        } else {
            this.logger.warn(`Attempted to unregister non-existent strategy: ${strategyName}`);
        }
        return existed;
    }

    /**
     * Clear all registered strategies (useful for testing)
     */
    clearStrategies(): void {
        const count = this.strategies.size;
        this.strategies.clear();
        this.logger.log(`Cleared ${count} registered strategies`);
    }

    /**
     * Get strategy information
     * @param strategyName The name of the strategy
     * @returns Strategy information or null if not found
     */
    getStrategyInfo(strategyName: string): { name: string; description: string } | null {
        const strategy = this.strategies.get(strategyName);
        if (!strategy) {
            return null;
        }

        return {
            name: strategy.name,
            description: strategy.description
        };
    }

    /**
     * Get all strategy information
     * @returns Array of strategy information objects
     */
    getAllStrategyInfo(): { name: string; description: string }[] {
        return Array.from(this.strategies.values()).map(strategy => ({
            name: strategy.name,
            description: strategy.description
        }));
    }

    /**
     * Validate that a strategy can handle the given parameters
     * @param strategyName The name of the strategy
     * @param params The parameters to validate
     * @returns True if the strategy can handle the parameters, false otherwise
     */
    validateStrategyParams(strategyName: string, params: any): boolean {
        const strategy = this.createStrategy(strategyName);
        if (!strategy) {
            return false;
        }

        try {
            return strategy.validateParams(params);
        } catch (error) {
            this.logger.error(`Error validating parameters for strategy '${strategyName}':`, error);
            return false;
        }
    }

    /**
     * Get cache statistics
     * @returns Current cache statistics
     */
    getCacheStats() {
        return this.strategyCache.getStats();
    }

    /**
     * Get detailed cache information
     * @returns Detailed cache information
     */
    getCacheInfo() {
        return this.strategyCache.getCacheInfo();
    }

    /**
     * Clear strategy cache
     */
    clearCache(): void {
        this.strategyCache.clearCache();
        this.logger.log('Strategy cache cleared');
    }

    /**
     * Invalidate cached strategies for a specific strategy name
     * @param strategyName Name of the strategy to invalidate
     */
    invalidateStrategyCache(strategyName: string): void {
        this.strategyCache.invalidateStrategy(strategyName);
        this.logger.log(`Cache invalidated for strategy: ${strategyName}`);
    }

    /**
     * Warm up cache with commonly used strategies
     * @param commonStrategies Array of commonly used strategy configurations
     */
    warmUpCache(commonStrategies: Array<{ name: string; params: ValidationParams }>): void {
        const strategies = commonStrategies
            .map(({ name, params }) => {
                const strategy = this.strategies.get(name);
                return strategy ? { name, strategy, params } : null;
            })
            .filter((item): item is { name: string; strategy: ValidationStrategy; params: ValidationParams } => item !== null);

        this.strategyCache.warmUpCache(strategies);
        this.logger.log(`Cache warmed up with ${strategies.length} strategies`);
    }

    /**
     * Shutdown strategy factory and cleanup resources
     */
    shutdown(): void {
        this.strategyCache.shutdown();
        this.clearStrategies();
        this.logger.log('Strategy factory shutdown');
    }
}
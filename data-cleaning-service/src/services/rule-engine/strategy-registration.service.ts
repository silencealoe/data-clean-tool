import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { StrategyFactoryService } from './strategy-factory.service';
import {
    RegexValidationStrategy,
    RangeValidationStrategy,
    LengthValidationStrategy,
    PhoneCleanerStrategy,
    DateCleanerStrategy,
    AddressCleanerStrategy
} from './strategies';
import { PhoneCleanerService } from '../phone-cleaner.service';
import { DateCleanerService } from '../date-cleaner.service';
import { AddressCleanerService } from '../address-cleaner.service';

/**
 * Strategy Registration Service
 * 
 * Responsible for registering all available validation strategies with the strategy factory.
 * This includes both native rule engine strategies and legacy cleaner service adapters.
 * 
 * Requirements: 需求 5.1, 5.2, 10.1, 10.4
 */
@Injectable()
export class StrategyRegistrationService implements OnModuleInit {
    private readonly logger = new Logger(StrategyRegistrationService.name);

    constructor(
        private readonly strategyFactory: StrategyFactoryService,
        private readonly phoneCleanerService: PhoneCleanerService,
        private readonly dateCleanerService: DateCleanerService,
        private readonly addressCleanerService: AddressCleanerService
    ) { }

    /**
     * Initialize and register all strategies when the module starts
     */
    async onModuleInit(): Promise<void> {
        this.logger.log('Initializing strategy registration...');

        try {
            // Register native rule engine strategies
            await this.registerNativeStrategies();

            // Register legacy cleaner service adapters
            await this.registerLegacyAdapters();

            const registeredStrategies = this.strategyFactory.getAvailableStrategies();
            this.logger.log(`Strategy registration completed. Registered strategies: ${registeredStrategies.join(', ')}`);

        } catch (error) {
            this.logger.error('Strategy registration failed:', error);
            throw error;
        }
    }

    /**
     * Register native rule engine validation strategies
     */
    private async registerNativeStrategies(): Promise<void> {
        this.logger.debug('Registering native validation strategies...');

        try {
            // Register regex validation strategy
            const regexStrategy = new RegexValidationStrategy();
            this.strategyFactory.registerStrategy(regexStrategy);
            this.logger.debug(`Registered strategy: ${regexStrategy.name}`);

            // Register range validation strategy
            const rangeStrategy = new RangeValidationStrategy();
            this.strategyFactory.registerStrategy(rangeStrategy);
            this.logger.debug(`Registered strategy: ${rangeStrategy.name}`);

            // Register length validation strategy
            const lengthStrategy = new LengthValidationStrategy();
            this.strategyFactory.registerStrategy(lengthStrategy);
            this.logger.debug(`Registered strategy: ${lengthStrategy.name}`);

            this.logger.log('Native validation strategies registered successfully');

        } catch (error) {
            this.logger.error('Failed to register native strategies:', error);
            throw error;
        }
    }

    /**
     * Register legacy cleaner service adapter strategies
     */
    private async registerLegacyAdapters(): Promise<void> {
        this.logger.debug('Registering legacy cleaner service adapters...');

        try {
            // Register phone cleaner adapter
            const phoneCleanerStrategy = new PhoneCleanerStrategy(this.phoneCleanerService);
            this.strategyFactory.registerStrategy(phoneCleanerStrategy);
            this.logger.debug(`Registered adapter strategy: ${phoneCleanerStrategy.name}`);

            // Register date cleaner adapter
            const dateCleanerStrategy = new DateCleanerStrategy(this.dateCleanerService);
            this.strategyFactory.registerStrategy(dateCleanerStrategy);
            this.logger.debug(`Registered adapter strategy: ${dateCleanerStrategy.name}`);

            // Register address cleaner adapter
            const addressCleanerStrategy = new AddressCleanerStrategy(this.addressCleanerService);
            this.strategyFactory.registerStrategy(addressCleanerStrategy);
            this.logger.debug(`Registered adapter strategy: ${addressCleanerStrategy.name}`);

            this.logger.log('Legacy cleaner service adapters registered successfully');

        } catch (error) {
            this.logger.error('Failed to register legacy adapters:', error);
            throw error;
        }
    }

    /**
     * Get registration status and information
     * @returns Registration status information
     */
    getRegistrationStatus(): {
        totalStrategies: number;
        nativeStrategies: string[];
        adapterStrategies: string[];
        allStrategies: { name: string; description: string }[];
    } {
        const allStrategies = this.strategyFactory.getAllStrategyInfo();
        const nativeStrategies = allStrategies
            .filter(s => ['regex', 'range', 'length'].includes(s.name))
            .map(s => s.name);
        const adapterStrategies = allStrategies
            .filter(s => ['phone-cleaner', 'date-cleaner', 'address-cleaner'].includes(s.name))
            .map(s => s.name);

        return {
            totalStrategies: allStrategies.length,
            nativeStrategies,
            adapterStrategies,
            allStrategies
        };
    }

    /**
     * Re-register all strategies (useful for testing or dynamic updates)
     */
    async reregisterStrategies(): Promise<void> {
        this.logger.log('Re-registering all strategies...');

        // Clear existing strategies
        this.strategyFactory.clearStrategies();

        // Re-register all strategies
        await this.onModuleInit();
    }

    /**
     * Register a custom strategy at runtime
     * @param strategy Custom validation strategy to register
     */
    registerCustomStrategy(strategy: any): void {
        this.logger.log(`Registering custom strategy: ${strategy.name}`);
        this.strategyFactory.registerStrategy(strategy);
    }

    /**
     * Unregister a strategy by name
     * @param strategyName Name of the strategy to unregister
     * @returns True if strategy was unregistered, false if not found
     */
    unregisterStrategy(strategyName: string): boolean {
        this.logger.log(`Unregistering strategy: ${strategyName}`);
        return this.strategyFactory.unregisterStrategy(strategyName);
    }
}
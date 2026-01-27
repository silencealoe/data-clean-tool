import { Test, TestingModule } from '@nestjs/testing';
import { StrategyFactoryService } from './strategy-factory.service';
import { RegexValidationStrategy, RangeValidationStrategy, LengthValidationStrategy } from './strategies';
import { ValidationStrategy, ValidationErrorType } from '../../common/types/rule-engine.types';

describe('StrategyFactoryService', () => {
    let service: StrategyFactoryService;
    let regexStrategy: RegexValidationStrategy;
    let rangeStrategy: RangeValidationStrategy;
    let lengthStrategy: LengthValidationStrategy;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [StrategyFactoryService],
        }).compile();

        service = module.get<StrategyFactoryService>(StrategyFactoryService);
        regexStrategy = new RegexValidationStrategy();
        rangeStrategy = new RangeValidationStrategy();
        lengthStrategy = new LengthValidationStrategy();
    });

    afterEach(() => {
        service.clearStrategies();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('registerStrategy', () => {
        it('should register a valid strategy', () => {
            service.registerStrategy(regexStrategy);
            expect(service.hasStrategy('regex')).toBe(true);
            expect(service.getAvailableStrategies()).toContain('regex');
        });

        it('should throw error for null strategy', () => {
            expect(() => service.registerStrategy(null as any)).toThrow();
        });

        it('should throw error for strategy without name', () => {
            const invalidStrategy = {
                description: 'test',
                validate: () => ({ success: true }),
                validateParams: () => true
            } as any;

            expect(() => service.registerStrategy(invalidStrategy)).toThrow();
        });

        it('should throw error for strategy without validate method', () => {
            const invalidStrategy = {
                name: 'test',
                description: 'test',
                validateParams: () => true
            } as any;

            expect(() => service.registerStrategy(invalidStrategy)).toThrow();
        });

        it('should allow overriding existing strategy', () => {
            service.registerStrategy(regexStrategy);
            expect(service.hasStrategy('regex')).toBe(true);

            // Register another strategy with same name
            service.registerStrategy(regexStrategy);
            expect(service.hasStrategy('regex')).toBe(true);
            expect(service.getAvailableStrategies().length).toBe(1);
        });
    });

    describe('createStrategy', () => {
        beforeEach(() => {
            service.registerStrategy(regexStrategy);
            service.registerStrategy(rangeStrategy);
            service.registerStrategy(lengthStrategy);
        });

        it('should create strategy by name', () => {
            const strategy = service.createStrategy('regex');
            expect(strategy).toBeDefined();
            expect(strategy?.name).toBe('regex');
        });

        it('should return null for non-existent strategy', () => {
            const strategy = service.createStrategy('non-existent');
            expect(strategy).toBeNull();
        });

        it('should return null for invalid strategy name', () => {
            expect(service.createStrategy('')).toBeNull();
            expect(service.createStrategy(null as any)).toBeNull();
            expect(service.createStrategy(undefined as any)).toBeNull();
        });
    });

    describe('getAvailableStrategies', () => {
        it('should return empty array when no strategies registered', () => {
            expect(service.getAvailableStrategies()).toEqual([]);
        });

        it('should return all registered strategy names', () => {
            service.registerStrategy(regexStrategy);
            service.registerStrategy(rangeStrategy);
            service.registerStrategy(lengthStrategy);

            const strategies = service.getAvailableStrategies();
            expect(strategies).toHaveLength(3);
            expect(strategies).toContain('regex');
            expect(strategies).toContain('range');
            expect(strategies).toContain('length');
        });
    });

    describe('hasStrategy', () => {
        beforeEach(() => {
            service.registerStrategy(regexStrategy);
        });

        it('should return true for registered strategy', () => {
            expect(service.hasStrategy('regex')).toBe(true);
        });

        it('should return false for non-registered strategy', () => {
            expect(service.hasStrategy('range')).toBe(false);
        });

        it('should return false for invalid strategy name', () => {
            expect(service.hasStrategy('')).toBe(false);
            expect(service.hasStrategy(null as any)).toBe(false);
            expect(service.hasStrategy(undefined as any)).toBe(false);
        });
    });

    describe('unregisterStrategy', () => {
        beforeEach(() => {
            service.registerStrategy(regexStrategy);
            service.registerStrategy(rangeStrategy);
        });

        it('should unregister existing strategy', () => {
            expect(service.hasStrategy('regex')).toBe(true);
            const result = service.unregisterStrategy('regex');
            expect(result).toBe(true);
            expect(service.hasStrategy('regex')).toBe(false);
        });

        it('should return false for non-existent strategy', () => {
            const result = service.unregisterStrategy('non-existent');
            expect(result).toBe(false);
        });

        it('should return false for invalid strategy name', () => {
            expect(service.unregisterStrategy('')).toBe(false);
            expect(service.unregisterStrategy(null as any)).toBe(false);
            expect(service.unregisterStrategy(undefined as any)).toBe(false);
        });
    });

    describe('clearStrategies', () => {
        it('should clear all registered strategies', () => {
            service.registerStrategy(regexStrategy);
            service.registerStrategy(rangeStrategy);
            service.registerStrategy(lengthStrategy);

            expect(service.getAvailableStrategies()).toHaveLength(3);

            service.clearStrategies();

            expect(service.getAvailableStrategies()).toHaveLength(0);
        });
    });

    describe('getStrategyInfo', () => {
        beforeEach(() => {
            service.registerStrategy(regexStrategy);
        });

        it('should return strategy info for registered strategy', () => {
            const info = service.getStrategyInfo('regex');
            expect(info).toBeDefined();
            expect(info?.name).toBe('regex');
            expect(info?.description).toBeDefined();
        });

        it('should return null for non-existent strategy', () => {
            const info = service.getStrategyInfo('non-existent');
            expect(info).toBeNull();
        });
    });

    describe('getAllStrategyInfo', () => {
        it('should return empty array when no strategies registered', () => {
            expect(service.getAllStrategyInfo()).toEqual([]);
        });

        it('should return info for all registered strategies', () => {
            service.registerStrategy(regexStrategy);
            service.registerStrategy(rangeStrategy);

            const infos = service.getAllStrategyInfo();
            expect(infos).toHaveLength(2);
            expect(infos.some(info => info.name === 'regex')).toBe(true);
            expect(infos.some(info => info.name === 'range')).toBe(true);
        });
    });

    describe('validateStrategyParams', () => {
        beforeEach(() => {
            service.registerStrategy(regexStrategy);
        });

        it('should validate params for existing strategy', () => {
            const validParams = { pattern: '^test$' };
            const result = service.validateStrategyParams('regex', validParams);
            expect(result).toBe(true);
        });

        it('should return false for invalid params', () => {
            const invalidParams = { pattern: '' };
            const result = service.validateStrategyParams('regex', invalidParams);
            expect(result).toBe(false);
        });

        it('should return false for non-existent strategy', () => {
            const result = service.validateStrategyParams('non-existent', {});
            expect(result).toBe(false);
        });
    });
});
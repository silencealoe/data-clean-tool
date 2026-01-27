import { Test, TestingModule } from '@nestjs/testing';
import { StrategyFactoryService } from './strategy-factory.service';
import { RegexValidationStrategy, RangeValidationStrategy, LengthValidationStrategy } from './strategies';
import { ValidationErrorType } from '../../common/types/rule-engine.types';

describe('Rule Engine Integration', () => {
    let strategyFactory: StrategyFactoryService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [StrategyFactoryService],
        }).compile();

        strategyFactory = module.get<StrategyFactoryService>(StrategyFactoryService);

        // Register all basic validation strategies
        strategyFactory.registerStrategy(new RegexValidationStrategy());
        strategyFactory.registerStrategy(new RangeValidationStrategy());
        strategyFactory.registerStrategy(new LengthValidationStrategy());
    });

    afterEach(() => {
        strategyFactory.clearStrategies();
    });

    describe('Strategy Factory Integration', () => {
        it('should register and create all basic validation strategies', () => {
            expect(strategyFactory.hasStrategy('regex')).toBe(true);
            expect(strategyFactory.hasStrategy('range')).toBe(true);
            expect(strategyFactory.hasStrategy('length')).toBe(true);

            const regexStrategy = strategyFactory.createStrategy('regex');
            const rangeStrategy = strategyFactory.createStrategy('range');
            const lengthStrategy = strategyFactory.createStrategy('length');

            expect(regexStrategy).toBeDefined();
            expect(rangeStrategy).toBeDefined();
            expect(lengthStrategy).toBeDefined();

            expect(regexStrategy?.name).toBe('regex');
            expect(rangeStrategy?.name).toBe('range');
            expect(lengthStrategy?.name).toBe('length');
        });

        it('should validate phone numbers using regex strategy', () => {
            const regexStrategy = strategyFactory.createStrategy('regex');
            expect(regexStrategy).toBeDefined();

            // Valid Chinese mobile number
            const validResult = regexStrategy!.validate('13812345678', {
                pattern: '^1[3-9]\\d{9}$'
            });
            expect(validResult.success).toBe(true);
            expect(validResult.value).toBe('13812345678');

            // Invalid phone number
            const invalidResult = regexStrategy!.validate('12345', {
                pattern: '^1[3-9]\\d{9}$'
            });
            expect(invalidResult.success).toBe(false);
            expect(invalidResult.errorCode).toBe(ValidationErrorType.INVALID_FORMAT);
        });

        it('should validate age using range strategy', () => {
            const rangeStrategy = strategyFactory.createStrategy('range');
            expect(rangeStrategy).toBeDefined();

            // Valid age
            const validResult = rangeStrategy!.validate(25, {
                min: 0,
                max: 120,
                inclusive: true
            });
            expect(validResult.success).toBe(true);
            expect(validResult.value).toBe(25);

            // Invalid age (too high)
            const invalidResult = rangeStrategy!.validate(150, {
                min: 0,
                max: 120,
                inclusive: true
            });
            expect(invalidResult.success).toBe(false);
            expect(invalidResult.errorCode).toBe(ValidationErrorType.OUT_OF_RANGE);
        });

        it('should validate name using length strategy', () => {
            const lengthStrategy = strategyFactory.createStrategy('length');
            expect(lengthStrategy).toBeDefined();

            // Valid name
            const validResult = lengthStrategy!.validate('张三', {
                minLength: 2,
                maxLength: 10
            });
            expect(validResult.success).toBe(true);
            expect(validResult.value).toBe('张三');

            // Invalid name (too short)
            const invalidResult = lengthStrategy!.validate('李', {
                minLength: 2,
                maxLength: 10
            });
            expect(invalidResult.success).toBe(false);
            expect(invalidResult.errorCode).toBe(ValidationErrorType.INVALID_FORMAT);
        });

        it('should handle multiple validation scenarios', () => {
            // Test email validation with regex
            const regexStrategy = strategyFactory.createStrategy('regex');
            const emailResult = regexStrategy!.validate('test@example.com', {
                pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
            });
            expect(emailResult.success).toBe(true);

            // Test price validation with range
            const rangeStrategy = strategyFactory.createStrategy('range');
            const priceResult = rangeStrategy!.validate('99.99', {
                min: 0,
                max: 1000,
                inclusive: true
            });
            expect(priceResult.success).toBe(true);
            expect(priceResult.value).toBe(99.99);

            // Test description validation with length
            const lengthStrategy = strategyFactory.createStrategy('length');
            const descResult = lengthStrategy!.validate('This is a test description', {
                minLength: 10,
                maxLength: 100
            });
            expect(descResult.success).toBe(true);
        });

        it('should validate strategy parameters before execution', () => {
            // Test regex parameter validation
            expect(strategyFactory.validateStrategyParams('regex', {
                pattern: '^test$'
            })).toBe(true);

            expect(strategyFactory.validateStrategyParams('regex', {
                pattern: ''
            })).toBe(false);

            // Test range parameter validation
            expect(strategyFactory.validateStrategyParams('range', {
                min: 0,
                max: 100
            })).toBe(true);

            expect(strategyFactory.validateStrategyParams('range', {
                min: 100,
                max: 0
            })).toBe(false);

            // Test length parameter validation
            expect(strategyFactory.validateStrategyParams('length', {
                minLength: 1,
                maxLength: 10
            })).toBe(true);

            expect(strategyFactory.validateStrategyParams('length', {
                minLength: 10,
                maxLength: 5
            })).toBe(false);
        });

        it('should provide comprehensive strategy information', () => {
            const allStrategies = strategyFactory.getAllStrategyInfo();
            expect(allStrategies).toHaveLength(3);

            const strategyNames = allStrategies.map(s => s.name);
            expect(strategyNames).toContain('regex');
            expect(strategyNames).toContain('range');
            expect(strategyNames).toContain('length');

            // Each strategy should have a description
            allStrategies.forEach(strategy => {
                expect(strategy.description).toBeDefined();
                expect(strategy.description.length).toBeGreaterThan(0);
            });
        });
    });
});
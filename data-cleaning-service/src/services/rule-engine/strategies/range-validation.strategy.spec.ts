import { RangeValidationStrategy } from './range-validation.strategy';
import { RangeParams, ValidationErrorType } from '../../../common/types/rule-engine.types';

describe('RangeValidationStrategy', () => {
    let strategy: RangeValidationStrategy;

    beforeEach(() => {
        strategy = new RangeValidationStrategy();
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
        expect(strategy.name).toBe('range');
        expect(strategy.description).toBeDefined();
    });

    describe('validateParams', () => {
        it('should validate parameters with min only', () => {
            const params: RangeParams = { min: 0 };
            expect(strategy.validateParams(params)).toBe(true);
        });

        it('should validate parameters with max only', () => {
            const params: RangeParams = { max: 100 };
            expect(strategy.validateParams(params)).toBe(true);
        });

        it('should validate parameters with both min and max', () => {
            const params: RangeParams = { min: 0, max: 100 };
            expect(strategy.validateParams(params)).toBe(true);
        });

        it('should validate parameters with inclusive flag', () => {
            const params: RangeParams = { min: 0, max: 100, inclusive: false };
            expect(strategy.validateParams(params)).toBe(true);
        });

        it('should reject null/undefined parameters', () => {
            expect(strategy.validateParams(null as any)).toBe(false);
            expect(strategy.validateParams(undefined as any)).toBe(false);
        });

        it('should reject parameters with no constraints', () => {
            const params: RangeParams = {};
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject non-numeric min', () => {
            const params = { min: 'zero' } as any;
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject non-numeric max', () => {
            const params = { max: 'hundred' } as any;
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject infinite min', () => {
            const params: RangeParams = { min: Infinity };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject infinite max', () => {
            const params: RangeParams = { max: -Infinity };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject min greater than max', () => {
            const params: RangeParams = { min: 100, max: 0 };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject non-boolean inclusive', () => {
            const params = { min: 0, max: 100, inclusive: 'true' } as any;
            expect(strategy.validateParams(params)).toBe(false);
        });
    });

    describe('validate', () => {
        it('should validate number within inclusive range', () => {
            const params: RangeParams = { min: 0, max: 100, inclusive: true };
            const result = strategy.validate(50, params);
            expect(result.success).toBe(true);
            expect(result.value).toBe(50);
        });

        it('should validate number at inclusive boundaries', () => {
            const params: RangeParams = { min: 0, max: 100, inclusive: true };

            const result1 = strategy.validate(0, params);
            expect(result1.success).toBe(true);
            expect(result1.value).toBe(0);

            const result2 = strategy.validate(100, params);
            expect(result2.success).toBe(true);
            expect(result2.value).toBe(100);
        });

        it('should reject number at exclusive boundaries', () => {
            const params: RangeParams = { min: 0, max: 100, inclusive: false };

            const result1 = strategy.validate(0, params);
            expect(result1.success).toBe(false);
            expect(result1.errorCode).toBe(ValidationErrorType.OUT_OF_RANGE);

            const result2 = strategy.validate(100, params);
            expect(result2.success).toBe(false);
            expect(result2.errorCode).toBe(ValidationErrorType.OUT_OF_RANGE);
        });

        it('should validate number within exclusive range', () => {
            const params: RangeParams = { min: 0, max: 100, inclusive: false };
            const result = strategy.validate(50, params);
            expect(result.success).toBe(true);
            expect(result.value).toBe(50);
        });

        it('should validate string numbers', () => {
            const params: RangeParams = { min: 0, max: 100 };
            const result = strategy.validate('50', params);
            expect(result.success).toBe(true);
            expect(result.value).toBe(50);
        });

        it('should validate decimal numbers', () => {
            const params: RangeParams = { min: 0, max: 100 };
            const result = strategy.validate(50.5, params);
            expect(result.success).toBe(true);
            expect(result.value).toBe(50.5);
        });

        it('should reject non-numeric strings', () => {
            const params: RangeParams = { min: 0, max: 100 };
            const result = strategy.validate('not-a-number', params);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ValidationErrorType.INVALID_FORMAT);
        });

        it('should reject null/undefined values', () => {
            const params: RangeParams = { min: 0, max: 100 };

            const result1 = strategy.validate(null, params);
            expect(result1.success).toBe(false);
            expect(result1.errorCode).toBe(ValidationErrorType.REQUIRED_FIELD_MISSING);

            const result2 = strategy.validate(undefined, params);
            expect(result2.success).toBe(false);
            expect(result2.errorCode).toBe(ValidationErrorType.REQUIRED_FIELD_MISSING);
        });

        it('should reject infinite values', () => {
            const params: RangeParams = { min: 0, max: 100 };

            const result1 = strategy.validate(Infinity, params);
            expect(result1.success).toBe(false);
            expect(result1.errorCode).toBe(ValidationErrorType.INVALID_FORMAT);

            const result2 = strategy.validate(-Infinity, params);
            expect(result2.success).toBe(false);
            expect(result2.errorCode).toBe(ValidationErrorType.INVALID_FORMAT);
        });

        it('should reject values below minimum', () => {
            const params: RangeParams = { min: 10 };
            const result = strategy.validate(5, params);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ValidationErrorType.OUT_OF_RANGE);
            expect(result.metadata?.violation).toBe('minimum');
        });

        it('should reject values above maximum', () => {
            const params: RangeParams = { max: 10 };
            const result = strategy.validate(15, params);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ValidationErrorType.OUT_OF_RANGE);
            expect(result.metadata?.violation).toBe('maximum');
        });

        it('should handle invalid parameters', () => {
            const invalidParams = {} as RangeParams;
            const result = strategy.validate(50, invalidParams);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ValidationErrorType.CONFIGURATION_ERROR);
        });

        it('should include metadata in successful validation', () => {
            const params: RangeParams = { min: 0, max: 100, inclusive: true };
            const result = strategy.validate(50, params);
            expect(result.success).toBe(true);
            expect(result.metadata).toEqual({
                strategy: 'range',
                originalValue: 50,
                min: 0,
                max: 100,
                inclusive: true
            });
        });

        it('should include metadata in failed validation', () => {
            const params: RangeParams = { min: 10, max: 100 };
            const result = strategy.validate(5, params);
            expect(result.success).toBe(false);
            expect(result.metadata).toEqual({
                strategy: 'range',
                originalValue: 5,
                numericValue: 5,
                min: 10,
                inclusive: true,
                violation: 'minimum'
            });
        });
    });
});
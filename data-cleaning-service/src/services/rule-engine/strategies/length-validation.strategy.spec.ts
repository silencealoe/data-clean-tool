import { LengthValidationStrategy } from './length-validation.strategy';
import { LengthParams, ValidationErrorType } from '../../../common/types/rule-engine.types';

describe('LengthValidationStrategy', () => {
    let strategy: LengthValidationStrategy;

    beforeEach(() => {
        strategy = new LengthValidationStrategy();
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
        expect(strategy.name).toBe('length');
        expect(strategy.description).toBeDefined();
    });

    describe('validateParams', () => {
        it('should validate parameters with minLength only', () => {
            const params: LengthParams = { minLength: 1 };
            expect(strategy.validateParams(params)).toBe(true);
        });

        it('should validate parameters with maxLength only', () => {
            const params: LengthParams = { maxLength: 10 };
            expect(strategy.validateParams(params)).toBe(true);
        });

        it('should validate parameters with both min and max length', () => {
            const params: LengthParams = { minLength: 1, maxLength: 10 };
            expect(strategy.validateParams(params)).toBe(true);
        });

        it('should validate parameters with exactLength', () => {
            const params: LengthParams = { exactLength: 5 };
            expect(strategy.validateParams(params)).toBe(true);
        });

        it('should reject null/undefined parameters', () => {
            expect(strategy.validateParams(null as any)).toBe(false);
            expect(strategy.validateParams(undefined as any)).toBe(false);
        });

        it('should reject parameters with no constraints', () => {
            const params: LengthParams = {};
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject non-integer minLength', () => {
            const params: LengthParams = { minLength: 1.5 };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject negative minLength', () => {
            const params: LengthParams = { minLength: -1 };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject non-integer maxLength', () => {
            const params: LengthParams = { maxLength: 10.5 };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject negative maxLength', () => {
            const params: LengthParams = { maxLength: -1 };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject non-integer exactLength', () => {
            const params: LengthParams = { exactLength: 5.5 };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject negative exactLength', () => {
            const params: LengthParams = { exactLength: -1 };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject minLength greater than maxLength', () => {
            const params: LengthParams = { minLength: 10, maxLength: 5 };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject exactLength with minLength', () => {
            const params: LengthParams = { exactLength: 5, minLength: 1 };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject exactLength with maxLength', () => {
            const params: LengthParams = { exactLength: 5, maxLength: 10 };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject unreasonably large lengths', () => {
            const params: LengthParams = { minLength: 2000000 };
            expect(strategy.validateParams(params)).toBe(false);
        });
    });

    describe('validate', () => {
        it('should validate string within length range', () => {
            const params: LengthParams = { minLength: 3, maxLength: 10 };
            const result = strategy.validate('hello', params);
            expect(result.success).toBe(true);
            expect(result.value).toBe('hello');
        });

        it('should validate string at minimum length boundary', () => {
            const params: LengthParams = { minLength: 5 };
            const result = strategy.validate('hello', params);
            expect(result.success).toBe(true);
            expect(result.value).toBe('hello');
        });

        it('should validate string at maximum length boundary', () => {
            const params: LengthParams = { maxLength: 5 };
            const result = strategy.validate('hello', params);
            expect(result.success).toBe(true);
            expect(result.value).toBe('hello');
        });

        it('should validate string with exact length', () => {
            const params: LengthParams = { exactLength: 5 };
            const result = strategy.validate('hello', params);
            expect(result.success).toBe(true);
            expect(result.value).toBe('hello');
        });

        it('should reject string shorter than minimum', () => {
            const params: LengthParams = { minLength: 10 };
            const result = strategy.validate('short', params);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ValidationErrorType.INVALID_FORMAT);
            expect(result.metadata?.violation).toBe('minimum_length');
        });

        it('should reject string longer than maximum', () => {
            const params: LengthParams = { maxLength: 3 };
            const result = strategy.validate('toolong', params);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ValidationErrorType.INVALID_FORMAT);
            expect(result.metadata?.violation).toBe('maximum_length');
        });

        it('should reject string not matching exact length', () => {
            const params: LengthParams = { exactLength: 10 };
            const result = strategy.validate('short', params);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ValidationErrorType.INVALID_FORMAT);
            expect(result.metadata?.violation).toBe('exact_length');
        });

        it('should convert numbers to strings and validate', () => {
            const params: LengthParams = { minLength: 3, maxLength: 5 };
            const result = strategy.validate(1234, params);
            expect(result.success).toBe(true);
            expect(result.value).toBe('1234');
        });

        it('should handle empty strings', () => {
            const params: LengthParams = { minLength: 0, maxLength: 10 };
            const result = strategy.validate('', params);
            expect(result.success).toBe(true);
            expect(result.value).toBe('');
        });

        it('should reject empty string when minimum length required', () => {
            const params: LengthParams = { minLength: 1 };
            const result = strategy.validate('', params);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ValidationErrorType.INVALID_FORMAT);
        });

        it('should validate empty string with exact length 0', () => {
            const params: LengthParams = { exactLength: 0 };
            const result = strategy.validate('', params);
            expect(result.success).toBe(true);
            expect(result.value).toBe('');
        });

        it('should reject null/undefined values', () => {
            const params: LengthParams = { minLength: 1 };

            const result1 = strategy.validate(null, params);
            expect(result1.success).toBe(false);
            expect(result1.errorCode).toBe(ValidationErrorType.REQUIRED_FIELD_MISSING);

            const result2 = strategy.validate(undefined, params);
            expect(result2.success).toBe(false);
            expect(result2.errorCode).toBe(ValidationErrorType.REQUIRED_FIELD_MISSING);
        });

        it('should handle unicode characters correctly', () => {
            const params: LengthParams = { exactLength: 3 };
            const result = strategy.validate('你好世', params);
            expect(result.success).toBe(true);
            expect(result.value).toBe('你好世');
        });

        it('should handle invalid parameters', () => {
            const invalidParams = {} as LengthParams;
            const result = strategy.validate('test', invalidParams);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ValidationErrorType.CONFIGURATION_ERROR);
        });

        it('should include metadata in successful validation', () => {
            const params: LengthParams = { minLength: 1, maxLength: 10 };
            const result = strategy.validate('hello', params);
            expect(result.success).toBe(true);
            expect(result.metadata).toEqual({
                strategy: 'length',
                originalValue: 'hello',
                actualLength: 5,
                minLength: 1,
                maxLength: 10
            });
        });

        it('should include metadata in failed validation', () => {
            const params: LengthParams = { minLength: 10 };
            const result = strategy.validate('short', params);
            expect(result.success).toBe(false);
            expect(result.metadata).toEqual({
                strategy: 'length',
                originalValue: 'short',
                actualLength: 5,
                minLength: 10,
                violation: 'minimum_length'
            });
        });

        it('should include metadata for exact length validation', () => {
            const params: LengthParams = { exactLength: 10 };
            const result = strategy.validate('hello', params);
            expect(result.success).toBe(false);
            expect(result.metadata).toEqual({
                strategy: 'length',
                originalValue: 'hello',
                actualLength: 5,
                exactLength: 10,
                violation: 'exact_length'
            });
        });
    });
});
import { RegexValidationStrategy } from './regex-validation.strategy';
import { RegexParams, ValidationErrorType } from '../../../common/types/rule-engine.types';

describe('RegexValidationStrategy', () => {
    let strategy: RegexValidationStrategy;

    beforeEach(() => {
        strategy = new RegexValidationStrategy();
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
        expect(strategy.name).toBe('regex');
        expect(strategy.description).toBeDefined();
    });

    describe('validateParams', () => {
        it('should validate correct regex parameters', () => {
            const params: RegexParams = { pattern: '^test$' };
            expect(strategy.validateParams(params)).toBe(true);
        });

        it('should validate regex parameters with flags', () => {
            const params: RegexParams = { pattern: '^test$', flags: 'i' };
            expect(strategy.validateParams(params)).toBe(true);
        });

        it('should validate regex parameters with multiline', () => {
            const params: RegexParams = { pattern: '^test$', multiline: true };
            expect(strategy.validateParams(params)).toBe(true);
        });

        it('should reject null/undefined parameters', () => {
            expect(strategy.validateParams(null as any)).toBe(false);
            expect(strategy.validateParams(undefined as any)).toBe(false);
        });

        it('should reject empty pattern', () => {
            const params: RegexParams = { pattern: '' };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject non-string pattern', () => {
            const params = { pattern: 123 } as any;
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject invalid regex pattern', () => {
            const params: RegexParams = { pattern: '[' }; // Invalid regex
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject invalid flags', () => {
            const params: RegexParams = { pattern: 'test', flags: 'xyz' };
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject non-string flags', () => {
            const params = { pattern: 'test', flags: 123 } as any;
            expect(strategy.validateParams(params)).toBe(false);
        });

        it('should reject non-boolean multiline', () => {
            const params = { pattern: 'test', multiline: 'true' } as any;
            expect(strategy.validateParams(params)).toBe(false);
        });
    });

    describe('validate', () => {
        const validParams: RegexParams = { pattern: '^\\d{3}-\\d{4}$' };

        it('should validate matching string', () => {
            const result = strategy.validate('123-4567', validParams);
            expect(result.success).toBe(true);
            expect(result.value).toBe('123-4567');
            expect(result.metadata?.strategy).toBe('regex');
        });

        it('should reject non-matching string', () => {
            const result = strategy.validate('invalid', validParams);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ValidationErrorType.INVALID_FORMAT);
        });

        it('should convert number to string and validate', () => {
            const numberParams: RegexParams = { pattern: '^\\d+$' };
            const result = strategy.validate(12345, numberParams);
            expect(result.success).toBe(true);
            expect(result.value).toBe('12345');
        });

        it('should handle case-insensitive matching', () => {
            const caseParams: RegexParams = { pattern: '^test$', flags: 'i' };
            const result = strategy.validate('TEST', caseParams);
            expect(result.success).toBe(true);
            expect(result.value).toBe('TEST');
        });

        it('should reject null/undefined values', () => {
            const result1 = strategy.validate(null, validParams);
            expect(result1.success).toBe(false);
            expect(result1.errorCode).toBe(ValidationErrorType.REQUIRED_FIELD_MISSING);

            const result2 = strategy.validate(undefined, validParams);
            expect(result2.success).toBe(false);
            expect(result2.errorCode).toBe(ValidationErrorType.REQUIRED_FIELD_MISSING);
        });

        it('should handle invalid parameters', () => {
            const invalidParams = { pattern: '' } as RegexParams;
            const result = strategy.validate('test', invalidParams);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ValidationErrorType.CONFIGURATION_ERROR);
        });

        it('should handle regex execution errors', () => {
            // This test simulates a regex that might cause runtime errors
            const problematicParams: RegexParams = { pattern: '(?=.*' }; // Incomplete lookahead
            const result = strategy.validate('test', problematicParams);
            expect(result.success).toBe(false);
        });

        it('should include metadata in successful validation', () => {
            const params: RegexParams = { pattern: '^test$', flags: 'i' };
            const result = strategy.validate('test', params);
            expect(result.success).toBe(true);
            expect(result.metadata).toEqual({
                strategy: 'regex',
                pattern: '^test$',
                flags: 'i',
                originalValue: 'test'
            });
        });

        it('should include metadata in failed validation', () => {
            const result = strategy.validate('invalid', validParams);
            expect(result.success).toBe(false);
            expect(result.metadata).toEqual({
                strategy: 'regex',
                pattern: '^\\d{3}-\\d{4}$',
                flags: '',
                originalValue: 'invalid',
                stringValue: 'invalid'
            });
        });
    });
});
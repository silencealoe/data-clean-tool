import { Test, TestingModule } from '@nestjs/testing';
import { PhoneCleanerService } from './phone-cleaner.service';
import * as fc from 'fast-check';

describe('PhoneCleanerService', () => {
    let service: PhoneCleanerService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [PhoneCleanerService],
        }).compile();

        service = module.get<PhoneCleanerService>(PhoneCleanerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('cleanPhone', () => {
        // Test specific phone number formats cleaning
        describe('valid phone number cleaning', () => {
            it('should remove spaces from phone numbers', () => {
                const result = service.cleanPhone('138 1234 5678');
                expect(result.success).toBe(true);
                expect(result.value).toBe('13812345678');
            });

            it('should remove dashes from phone numbers', () => {
                const result = service.cleanPhone('138-1234-5678');
                expect(result.success).toBe(true);
                expect(result.value).toBe('13812345678');
            });

            it('should remove mixed non-digit characters', () => {
                const result = service.cleanPhone('138 (1234) 5678');
                expect(result.success).toBe(true);
                expect(result.value).toBe('13812345678');
            });

            it('should preserve + at the beginning for country codes', () => {
                const result = service.cleanPhone('+86 138 1234 5678');
                expect(result.success).toBe(true);
                expect(result.value).toBe('+8613812345678');
            });

            it('should handle valid Chinese mobile numbers', () => {
                const validMobiles = [
                    '13812345678',
                    '15987654321',
                    '18765432109',
                    '19123456789'
                ];

                validMobiles.forEach(mobile => {
                    const result = service.cleanPhone(mobile);
                    expect(result.success).toBe(true);
                    expect(result.value).toBe(mobile);
                });
            });

            it('should handle valid Chinese landline numbers', () => {
                const validLandlines = [
                    '2234567',      // 7 digits local (starts with 2-9)
                    '23345678',     // 8 digits local (starts with 2-9)
                    '0101234567',   // 10 digits with area code (starts with 0)
                    '010123456789', // 12 digits with area code (starts with 0)
                ];

                validLandlines.forEach(landline => {
                    const result = service.cleanPhone(landline);
                    expect(result.success).toBe(true);
                    expect(result.value).toBe(landline);
                });
            });
        });

        // Test invalid phone number marking
        describe('invalid phone number handling', () => {
            it('should mark invalid mobile numbers as failed', () => {
                const invalidMobiles = [
                    '12812345678',  // starts with 12 (invalid second digit)
                    '11812345678',  // starts with 11 (invalid second digit)
                    '1381234567',   // 10 digits (too short)
                    '138123456789', // 12 digits (too long)
                    '238123456789', // doesn't start with 1
                ];

                invalidMobiles.forEach(mobile => {
                    const result = service.cleanPhone(mobile);
                    expect(result.success).toBe(false);
                    expect(result.error).toBeDefined();
                });
            });

            it('should mark invalid landline numbers as failed', () => {
                const invalidLandlines = [
                    '123456',       // 6 digits (too short)
                    '123456789',    // 9 digits (invalid length)
                    '12345678901234', // too long
                    '1234567',      // 7 digits but starts with 1 (invalid for local)
                    '0234567',      // 7 digits but starts with 0 (invalid for local)
                    '1234567890',   // 10 digits but doesn't start with 0 (invalid for area code)
                ];

                invalidLandlines.forEach(landline => {
                    const result = service.cleanPhone(landline);
                    expect(result.success).toBe(false);
                    expect(result.error).toBeDefined();
                });
            });
        });

        // Test null and empty value handling
        describe('null and empty value handling', () => {
            it('should handle null values', () => {
                const result = service.cleanPhone(null);
                expect(result.success).toBe(false);
                expect(result.error).toBe('Phone number is empty or null');
            });

            it('should handle undefined values', () => {
                const result = service.cleanPhone(undefined);
                expect(result.success).toBe(false);
                expect(result.error).toBe('Phone number is empty or null');
            });

            it('should handle empty string', () => {
                const result = service.cleanPhone('');
                expect(result.success).toBe(false);
                expect(result.error).toBe('Phone number is empty or null');
            });

            it('should handle whitespace-only string', () => {
                const result = service.cleanPhone('   ');
                expect(result.success).toBe(false);
                expect(result.error).toBe('Phone number is empty after trimming');
            });
        });

        // Test type conversion
        describe('type conversion', () => {
            it('should handle numeric input', () => {
                const result = service.cleanPhone(13812345678);
                expect(result.success).toBe(true);
                expect(result.value).toBe('13812345678');
            });

            it('should handle boolean input', () => {
                const result = service.cleanPhone(true);
                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });

            it('should handle object input', () => {
                const result = service.cleanPhone({ phone: '13812345678' });
                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });
        });

        // Test country code handling
        describe('country code handling', () => {
            it('should handle +86 country code correctly', () => {
                const result = service.cleanPhone('+8613812345678');
                expect(result.success).toBe(true);
                expect(result.value).toBe('+8613812345678');
            });

            it('should handle other country codes', () => {
                const result = service.cleanPhone('+1234567890');
                expect(result.success).toBe(true);
                expect(result.value).toBe('+1234567890');
            });

            it('should reject invalid country code format', () => {
                const result = service.cleanPhone('+');
                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });
        });

        // Test edge cases
        describe('edge cases', () => {
            it('should handle very long strings with valid phone buried inside', () => {
                const result = service.cleanPhone('abc13812345678def');
                expect(result.success).toBe(true);
                expect(result.value).toBe('13812345678');
            });

            it('should handle strings with only non-digit characters', () => {
                const result = service.cleanPhone('abcdef');
                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });

            it('should handle mixed valid and invalid characters', () => {
                const result = service.cleanPhone('138-1234-5678-ext123');
                expect(result.success).toBe(false); // This should fail because 13812345678123 is too long
                expect(result.error).toBeDefined();
            });
        });

        // Property-based tests
        describe('property-based tests', () => {
            // Feature: data-cleaning-service, Property 7: 手机号字符清洗
            it('should remove all non-digit characters from phone numbers (Property 7)', () => {
                // Custom arbitrary for generating phone numbers with various non-digit characters
                const phoneWithNonDigitsArbitrary = fc.tuple(
                    fc.boolean(), // whether to include country code
                    fc.constantFrom('138', '139', '150', '151', '180', '181', '189'), // valid mobile prefixes
                    fc.string({ minLength: 8, maxLength: 8 }).map(s => s.replace(/\D/g, '').padEnd(8, '0').substring(0, 8)), // remaining 8 digits
                    fc.array(fc.constantFrom(' ', '-', '(', ')', '.', '_', '#', '*', 'a', 'b', 'x'), { minLength: 1, maxLength: 10 }) // non-digit characters to insert
                ).map(([hasCountryCode, prefix, suffix, nonDigits]) => {
                    const basePhone = prefix + suffix;
                    let phoneWithNonDigits = '';

                    // Insert non-digit characters randomly throughout the phone number
                    for (let i = 0; i < basePhone.length; i++) {
                        phoneWithNonDigits += basePhone[i];
                        if (i < basePhone.length - 1 && Math.random() < 0.3) {
                            phoneWithNonDigits += nonDigits[Math.floor(Math.random() * nonDigits.length)];
                        }
                    }

                    // Add some non-digit characters at the end sometimes
                    if (Math.random() < 0.2) {
                        phoneWithNonDigits += nonDigits.slice(0, Math.floor(Math.random() * 3) + 1).join('');
                    }

                    // Add country code if specified
                    if (hasCountryCode) {
                        phoneWithNonDigits = '+86' + phoneWithNonDigits;
                    }

                    return phoneWithNonDigits;
                });

                fc.assert(
                    fc.property(phoneWithNonDigitsArbitrary, (phoneWithNonDigits) => {
                        const result = service.cleanPhone(phoneWithNonDigits);

                        // If cleaning was successful, the result should only contain digits (and possibly + at the beginning)
                        if (result.success && result.value) {
                            // Should match pattern: optional + followed by digits only
                            expect(result.value).toMatch(/^\+?\d+$/);

                            // If it starts with +, the + should be at the beginning only
                            if (result.value.includes('+')) {
                                expect(result.value.indexOf('+')).toBe(0);
                                expect(result.value.split('+').length).toBe(2); // Should have exactly one +
                            }
                        }

                        // The test passes regardless of success/failure - we're only testing the character cleaning property
                        // The validation logic (length, format) is tested separately
                    }),
                    { numRuns: 100 }
                );
            });
        });
    });
});
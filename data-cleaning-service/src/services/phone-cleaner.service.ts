import { Injectable } from '@nestjs/common';
import { CleanResult } from '../common/types';

/**
 * Service for cleaning and validating phone numbers
 * Handles Chinese mobile numbers (11 digits) and landline numbers (7-12 digits)
 */
@Injectable()
export class PhoneCleanerService {
    /**
     * Clean phone number by removing spaces, dashes, and non-digit characters
     * @param phone - Raw phone number input (any type)
     * @returns CleanResult with cleaned phone number or error
     */
    cleanPhone(phone: any): CleanResult<string> {
        // Handle null, undefined, or empty values
        if (phone === null || phone === undefined || phone === '') {
            return {
                success: false,
                error: 'Phone number is empty or null'
            };
        }

        // Convert to string
        const phoneStr = String(phone).trim();

        if (phoneStr === '') {
            return {
                success: false,
                error: 'Phone number is empty after trimming'
            };
        }

        // Remove all non-digit characters except + at the beginning
        let cleaned = phoneStr;

        // Preserve + if it's at the beginning
        const hasCountryCode = cleaned.startsWith('+');
        if (hasCountryCode) {
            cleaned = '+' + cleaned.substring(1).replace(/\D/g, '');
        } else {
            cleaned = cleaned.replace(/\D/g, '');
        }

        // Validate the cleaned phone number
        if (!this.validatePhone(cleaned)) {
            return {
                success: false,
                error: 'Invalid phone number format or length'
            };
        }

        return {
            success: true,
            value: cleaned
        };
    }

    /**
     * Validate phone number format and length
     * @param phone - Cleaned phone number string
     * @returns true if valid, false otherwise
     */
    private validatePhone(phone: string): boolean {
        if (!phone || typeof phone !== 'string') {
            return false;
        }

        // Handle phone numbers with country code
        if (phone.startsWith('+')) {
            // Remove country code for validation
            const withoutCountryCode = phone.substring(1);

            // Chinese country code is +86, so after removing +86, should be 11 digits
            if (phone.startsWith('+86')) {
                const number = phone.substring(3);
                return this.validateChineseMobile(number) || this.validateChineseLandline(number);
            }

            // For other country codes, just check if it's reasonable length
            return withoutCountryCode.length >= 7 && withoutCountryCode.length <= 15;
        }

        // Validate Chinese mobile or landline numbers
        return this.validateChineseMobile(phone) || this.validateChineseLandline(phone);
    }

    /**
     * Validate Chinese mobile number (11 digits, starts with 1, second digit 3-9)
     * @param phone - Phone number string
     * @returns true if valid Chinese mobile number
     */
    private validateChineseMobile(phone: string): boolean {
        if (phone.length !== 11) {
            return false;
        }

        // Must start with 1
        if (!phone.startsWith('1')) {
            return false;
        }

        // Second digit must be 3-9
        const secondDigit = parseInt(phone.charAt(1));
        if (isNaN(secondDigit) || secondDigit < 3 || secondDigit > 9) {
            return false;
        }

        // All characters must be digits
        return /^\d{11}$/.test(phone);
    }

    /**
     * Validate Chinese landline number
     * - 7-8 digits for local numbers
     * - 10-12 digits for numbers with area code
     * @param phone - Phone number string
     * @returns true if valid Chinese landline number
     */
    private validateChineseLandline(phone: string): boolean {
        const length = phone.length;

        // Local landline: 7-8 digits (cannot start with 0 or 1)
        if (length >= 7 && length <= 8) {
            return /^[2-9]\d{6,7}$/.test(phone);
        }

        // Landline with area code: 10-12 digits (must start with 0)
        if (length >= 10 && length <= 12) {
            return /^0\d{9,11}$/.test(phone);
        }

        return false;
    }
}
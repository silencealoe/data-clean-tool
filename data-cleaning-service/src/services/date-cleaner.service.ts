import { Injectable } from '@nestjs/common';
import { CleanResult } from '../common/types';

/**
 * Service for cleaning and standardizing date formats
 * Supports ISO format, Chinese format, American format, and Excel serial numbers
 * Validates date range (1900-2100)
 */
@Injectable()
export class DateCleanerService {
    // Excel epoch starts from January 1, 1900 (but Excel incorrectly treats 1900 as a leap year)
    private readonly EXCEL_EPOCH = new Date(1900, 0, 1);
    private readonly MIN_YEAR = 1900;
    private readonly MAX_YEAR = 2100;

    /**
     * Clean and standardize date format to YYYY-MM-DD
     * @param date - Raw date input (any type)
     * @returns CleanResult with standardized date string or error
     */
    cleanDate(date: any): CleanResult<string> {
        // Handle null, undefined, or empty values
        if (date === null || date === undefined || date === '') {
            return {
                success: false,
                error: 'Date is empty or null'
            };
        }

        // Convert to string and trim
        const dateStr = String(date).trim();

        if (dateStr === '') {
            return {
                success: false,
                error: 'Date is empty after trimming'
            };
        }

        // Try to parse the date
        const parsedDate = this.parseDate(dateStr);

        if (!parsedDate) {
            return {
                success: false,
                error: 'Unable to parse date format'
            };
        }

        // Validate date range
        const year = parsedDate.getFullYear();
        if (year < this.MIN_YEAR || year > this.MAX_YEAR) {
            return {
                success: false,
                error: `Date year ${year} is outside valid range (${this.MIN_YEAR}-${this.MAX_YEAR})`
            };
        }

        // Format to YYYY-MM-DD
        const formattedDate = this.formatDate(parsedDate);

        return {
            success: true,
            value: formattedDate
        };
    }

    /**
     * Parse various date formats into Date object
     * Supports ISO, Chinese, American formats, and Excel serial numbers
     * @param dateStr - Date string to parse
     * @returns Date object or null if parsing fails
     */
    private parseDate(dateStr: string): Date | null {
        // Try Excel serial number first (numeric string)
        if (/^\d+(\.\d+)?$/.test(dateStr)) {
            const serialNumber = parseFloat(dateStr);
            // Excel serial numbers typically range from 1 (1900-01-01) to ~73000 (2099-12-31)
            if (serialNumber >= 1 && serialNumber <= 73050) {
                return this.parseExcelSerialNumber(serialNumber);
            }
        }

        // Try timestamp (Unix timestamp in seconds or milliseconds)
        if (/^\d{10}$/.test(dateStr)) {
            // Unix timestamp in seconds
            const timestamp = parseInt(dateStr) * 1000;
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }

        if (/^\d{13}$/.test(dateStr)) {
            // Unix timestamp in milliseconds
            const timestamp = parseInt(dateStr);
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }

        // Try ISO formats: YYYY-MM-DD, YYYY/MM/DD, YYYY-M-D, YYYY/M/D
        const isoPatterns = [
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
            /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
            /^(\d{4})-(\d{1,2})-(\d{1,2})\s+\d{1,2}:\d{1,2}(:\d{1,2})?/,
            /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+\d{1,2}:\d{1,2}(:\d{1,2})?/
        ];

        for (const pattern of isoPatterns) {
            const match = dateStr.match(pattern);
            if (match) {
                const year = parseInt(match[1]);
                const month = parseInt(match[2]) - 1; // JavaScript months are 0-based
                const day = parseInt(match[3]);
                const date = new Date(year, month, day);
                if (this.isValidDate(date, year, month + 1, day)) {
                    return date;
                }
            }
        }

        // Try American formats: MM/DD/YYYY, MM-DD-YYYY, M/D/YYYY, M-D-YYYY
        const americanPatterns = [
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/
        ];

        for (const pattern of americanPatterns) {
            const match = dateStr.match(pattern);
            if (match) {
                const month = parseInt(match[1]) - 1; // JavaScript months are 0-based
                const day = parseInt(match[2]);
                const year = parseInt(match[3]);
                const date = new Date(year, month, day);
                if (this.isValidDate(date, year, month + 1, day)) {
                    return date;
                }
            }
        }

        // Try Chinese formats: YYYY年MM月DD日, YYYY年M月D日
        const chinesePatterns = [
            /^(\d{4})年(\d{1,2})月(\d{1,2})日$/,
            /^(\d{4})年(\d{1,2})月(\d{1,2})$/
        ];

        for (const pattern of chinesePatterns) {
            const match = dateStr.match(pattern);
            if (match) {
                const year = parseInt(match[1]);
                const month = parseInt(match[2]) - 1; // JavaScript months are 0-based
                const day = parseInt(match[3]);
                const date = new Date(year, month, day);
                if (this.isValidDate(date, year, month + 1, day)) {
                    return date;
                }
            }
        }

        // Try built-in Date parsing as last resort
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date;
        }

        return null;
    }

    /**
     * Parse Excel serial number to Date
     * Excel serial numbers start from 1900-01-01 = 1
     * Note: Excel incorrectly treats 1900 as a leap year
     * @param serialNumber - Excel serial number
     * @returns Date object
     */
    private parseExcelSerialNumber(serialNumber: number): Date {
        // Excel's epoch is 1900-01-01, but Excel incorrectly treats 1900 as a leap year
        // So we need to adjust for this bug
        let days = Math.floor(serialNumber) - 1; // -1 because Excel starts from 1, not 0

        // Excel incorrectly includes Feb 29, 1900, so we need to subtract 1 day
        // for dates after Feb 28, 1900 (serial number 59)
        if (serialNumber > 59) {
            days -= 1;
        }

        const date = new Date(1900, 0, 1); // January 1, 1900
        date.setDate(date.getDate() + days);

        return date;
    }

    /**
     * Validate that the parsed date components match the original values
     * This helps catch invalid dates like February 30th
     * @param date - Parsed Date object
     * @param year - Original year value
     * @param month - Original month value (1-12)
     * @param day - Original day value
     * @returns true if date is valid
     */
    private isValidDate(date: Date, year: number, month: number, day: number): boolean {
        return !isNaN(date.getTime()) &&
            date.getFullYear() === year &&
            date.getMonth() === month - 1 && // JavaScript months are 0-based
            date.getDate() === day;
    }

    /**
     * Format Date object to YYYY-MM-DD string
     * @param date - Date object to format
     * @returns Formatted date string
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-based
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }
}
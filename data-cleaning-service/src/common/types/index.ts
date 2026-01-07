/**
 * Common types and interfaces used across the application
 */

// File status enum
export enum FileStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

// Column type enum
export enum ColumnType {
    PHONE = 'phone',
    DATE = 'date',
    ADDRESS = 'address',
    TEXT = 'text',
    NUMBER = 'number',
}

// Clean result interface
export interface CleanResult<T> {
    success: boolean;
    value?: T;
    error?: string;
}

// Address components interface
export interface AddressComponents {
    province: string;
    city: string;
    district: string;
    detail?: string;
}

// Field error interface
export interface FieldError {
    field: string;
    originalValue: any;
    errorType: string;
    errorMessage: string;
}

// Statistics interface
export interface Statistics {
    totalRows: number;
    cleanedRows: number;
    exceptionRows: number;
    processingTime: number;
}

// Row data interface
export interface RowData {
    rowNumber: number;
    data: Record<string, any>;
}

// Cleaned row interface
export interface CleanedRow {
    rowNumber: number;
    originalData: Record<string, any>;
    cleanedData: Record<string, any>;
}

// Exception row interface
export interface ExceptionRow {
    rowNumber: number;
    originalData: Record<string, any>;
    errors: FieldError[];
}

// Column type map
export type ColumnTypeMap = Record<string, ColumnType>;

// Sheet data interface
export interface SheetData {
    name: string;
    headers: string[];
    rows: RowData[];
    columnTypes: ColumnTypeMap;
}

// Parsed data interface
export interface ParsedData {
    sheets: SheetData[];
    totalRows: number;
}

// Cleaning result interface
export interface CleaningResult {
    jobId: string;
    cleanData: CleanedRow[];
    exceptionData: ExceptionRow[];
    statistics: Statistics;
}

// Validation result interface
export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

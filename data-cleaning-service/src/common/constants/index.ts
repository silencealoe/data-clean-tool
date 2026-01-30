/**
 * Application constants
 */

// Export rule engine constants
export * from './rule-engine.constants';

// Allowed file MIME types
export const ALLOWED_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
    'application/csv', // .csv (alternative MIME type)
    'text/plain', // .csv (sometimes detected as plain text)
    'application/octet-stream', // .csv (sometimes detected by curl)
];

// Allowed file extensions
export const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

// Default max file size (500MB for streaming support)
export const DEFAULT_MAX_FILE_SIZE = 500 * 1024 * 1024;

// Error codes
export const ERROR_CODES = {
    UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
    FILE_SIZE_EXCEEDED: 'FILE_SIZE_EXCEEDED',
    UPLOAD_FAILED: 'UPLOAD_FAILED',
    CORRUPTED_FILE: 'CORRUPTED_FILE',
    EMPTY_FILE: 'EMPTY_FILE',
    PARSE_FAILED: 'PARSE_FAILED',
    TYPE_IDENTIFICATION_FAILED: 'TYPE_IDENTIFICATION_FAILED',
    CLEANING_FAILED: 'CLEANING_FAILED',
    EXPORT_FAILED: 'EXPORT_FAILED',
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    JOB_NOT_FOUND: 'JOB_NOT_FOUND',
    JOB_EXPIRED: 'JOB_EXPIRED',
    RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
    DATABASE_ERROR: 'DATABASE_ERROR',
};

// Phone number validation
export const PHONE_REGEX = {
    MOBILE: /^1[3-9]\d{9}$/,
    LANDLINE: /^\d{7,12}$/,
};

// Date validation
export const DATE_RANGE = {
    MIN_YEAR: 1900,
    MAX_YEAR: 2100,
};

// Chinese provinces
export const PROVINCES = [
    '北京市', '天津市', '上海市', '重庆市',
    '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
    '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
    '河南省', '湖北省', '湖南省', '广东省', '海南省',
    '四川省', '贵州省', '云南省', '陕西省', '甘肃省', '青海省', '台湾省',
    '内蒙古自治区', '广西壮族自治区', '西藏自治区', '宁夏回族自治区', '新疆维吾尔自治区',
    '香港特别行政区', '澳门特别行政区',
];

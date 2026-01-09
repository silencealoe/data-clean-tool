// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100'
export const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000')

// App Configuration
export const APP_NAME = import.meta.env.VITE_APP_NAME || '数据清洗服务'
export const APP_DESCRIPTION = import.meta.env.VITE_APP_DESCRIPTION || '专业的Excel数据清洗和标准化服务'

// File Upload Configuration
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_FILE_TYPES = ['.xlsx', '.xls']
export const ALLOWED_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
]

// Polling Configuration
export const STATUS_POLLING_INTERVAL = 2000 // 2 seconds
export const MAX_POLLING_ATTEMPTS = 150 // 5 minutes max

// Pagination Configuration
export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 100
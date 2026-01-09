/**
 * 文件处理工具函数
 */

import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES, ALLOWED_MIME_TYPES } from './constants';
import type { ValidationResult } from '../types';

/**
 * 验证文件格式和大小
 */
export function validateFile(file: File): ValidationResult {
    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
        return {
            isValid: false,
            error: `文件大小不能超过 ${formatFileSize(MAX_FILE_SIZE)}`
        };
    }

    // 检查文件扩展名
    const fileExtension = getFileExtension(file.name);
    if (!ALLOWED_FILE_TYPES.includes(fileExtension)) {
        return {
            isValid: false,
            error: `请上传支持的文件格式（${ALLOWED_FILE_TYPES.join('、')} 格式）`
        };
    }

    // 检查MIME类型
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return {
            isValid: false,
            error: `文件类型不支持，请上传Excel或CSV文件`
        };
    }

    return {
        isValid: true
    };
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) {
        return '';
    }
    return filename.substring(lastDotIndex).toLowerCase();
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 检查文件是否为支持的文件类型
 */
export function isSupportedFile(file: File): boolean {
    const extension = getFileExtension(file.name);
    return ALLOWED_FILE_TYPES.includes(extension) && ALLOWED_MIME_TYPES.includes(file.type);
}
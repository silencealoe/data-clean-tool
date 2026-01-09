/**
 * 状态管理类型定义
 */

import type { FileRecord, FileFilters, PaginationInfo, ProcessingStatistics } from '../types';

// 上传状态接口
export interface UploadState {
    isUploading: boolean;
    progress: number;
    error: string | null;
    uploadedFile: {
        jobId: string;
        fileId: string;
        fileName: string;
        totalRows: number;
    } | null;
}

// 文件列表状态接口
export interface FileListState {
    files: FileRecord[];
    loading: boolean;
    error: string | null;
    pagination: PaginationInfo;
    filters: FileFilters;
}

// 文件详情状态接口
export interface FileDetailState {
    file: FileRecord | null;
    statistics: ProcessingStatistics | null;
    loading: boolean;
    error: string | null;
}

// 任务状态监控接口
export interface JobStatusState {
    activeJobs: Map<string, {
        jobId: string;
        status: 'processing' | 'completed' | 'failed';
        progress: number;
        statistics?: ProcessingStatistics;
    }>;
    pollingIntervals: Map<string, number>;
}

// 通知状态接口
export interface NotificationState {
    notifications: Array<{
        id: string;
        type: 'success' | 'error' | 'info' | 'warning';
        message: string;
        timestamp: number;
    }>;
}

// 应用主题状态接口
export interface AppThemeState {
    mode: 'light' | 'dark';
    primaryColor: string;
}
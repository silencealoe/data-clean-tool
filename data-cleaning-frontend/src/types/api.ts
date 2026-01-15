/**
 * API类型定义
 * 基于swagger.json生成的TypeScript类型定义
 */

// 文件状态枚举
export type FileStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 处理状态枚举
export type ProcessingStatus = 'processing' | 'completed' | 'failed';

// 上传响应接口
export interface UploadResponse {
    jobId: string;
    fileId: string;
    message: string;
    totalRows: number;
}

// 错误响应接口
export interface ErrorResponse {
    statusCode: number;
    errorCode: string;
    message: string;
    details?: unknown;
    timestamp: string;
}

// 处理统计信息接口
export interface ProcessingStatistics {
    totalRows: number;
    cleanedRows: number;
    exceptionRows: number;
    processingTime: number;
}

// 状态响应接口
export interface StatusResponse {
    jobId: string;
    status: ProcessingStatus;
    progress: number;
    statistics?: ProcessingStatistics;
}

// 文件记录接口
export interface FileRecord {
    id: string;
    jobId: string;
    originalFileName: string;
    fileSize: number;
    fileType: string;
    status: FileStatus;
    uploadedAt: string;
    completedAt?: string | null;
    totalRows?: number | null;
    cleanedRows?: number | null;
    exceptionRows?: number | null;
}

// 文件列表响应接口
export interface FileListResponse {
    files: FileRecord[];
    total: number;
    page: number;
    pageSize: number;
}

// 文件详情接口
export interface FileDetail {
    id: string;
    jobId: string;
    originalFileName: string;
    fileSize: number;
    fileType: string;
    mimeType: string;
    status: FileStatus;
    uploadedAt: string;
    completedAt?: string | null;
    totalRows?: number | null;
    cleanedRows?: number | null;
    exceptionRows?: number | null;
    processingTime?: number | null;
    errorMessage?: string | null;
}

// 文件详情响应接口
export interface FileDetailResponse {
    file: FileDetail;
    statistics?: ProcessingStatistics;
}

// 文件列表查询参数接口
export interface FileListParams extends Record<string, unknown> {
    page?: number;
    pageSize?: number;
    status?: FileStatus;
    startDate?: string;
    endDate?: string;
}

// 分页数据响应接口
export interface PaginatedDataResponse {
    data: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// API客户端接口
export interface ApiClient {
    uploadFile(file: File, onProgress?: (progressEvent: { loaded: number; total?: number }) => void): Promise<UploadResponse>;
    getJobStatus(jobId: string): Promise<StatusResponse>;
    getFileList(params?: FileListParams): Promise<FileListResponse>;
    getFileDetail(fileId: string): Promise<FileDetailResponse>;
    downloadCleanData(jobId: string): Promise<Blob>;
    downloadExceptionData(jobId: string): Promise<Blob>;
    getCleanDataPaginated(jobId: string, page: number, pageSize: number): Promise<PaginatedDataResponse>;
    getExceptionDataPaginated(jobId: string, page: number, pageSize: number): Promise<PaginatedDataResponse>;
}

// 文件验证结果接口
export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

// 分页信息接口
export interface PaginationInfo {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

// 文件筛选接口
export interface FileFilters {
    status?: FileStatus;
    startDate?: string;
    endDate?: string;
}
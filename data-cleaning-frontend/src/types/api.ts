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

    // Rule Configuration API methods
    getCurrentRuleConfig(): Promise<import('./rule-config').RuleConfigResponse>;
    updateRuleConfig(config: import('./rule-config').RuleConfiguration, description?: string): Promise<import('./rule-config').RuleConfigResponse>;
    reloadRuleConfig(): Promise<import('./rule-config').RuleConfigResponse>;
    getRuleConfigHistory(limit?: number): Promise<import('./rule-config').ConfigHistoryResponse>;
    getRuleConfigStats(): Promise<import('./rule-config').ConfigStatsResponse>;
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

// 进度查询响应接口
export interface ProgressResponse {
    jobId: string;
    overallProgress: number;
    processedRows: number;
    totalRows: number;
    workerProgress: WorkerProgress[];
    isProcessing: boolean;
    message?: string;
    statistics?: ProcessingStatistics;  // 添加统计信息（任务完成时提供）
}

// 工作线程进度接口
export interface WorkerProgress {
    workerId: number;
    progress: number;
    processedRows: number;
    totalRows: number;
}

// 性能指标响应接口
export interface MetricsResponse {
    jobId: string;
    cpuUsage: number;
    memoryUsage: number;
    throughput: number;
    workerCount: number;
    timestamp: string;
    isProcessing: boolean;
    message?: string;
}

// 性能报告响应接口
export interface PerformanceReportResponse {
    jobId: string;
    processingMode: 'parallel' | 'sequential';
    workerCount: number;
    avgCpuUsage: number;
    peakCpuUsage: number;
    avgMemoryUsage: number;
    peakMemoryUsage: number;
    avgThroughput: number;
    peakThroughput: number;
    processingTimeMs: number;
    totalRows: number;
    successCount: number;
    errorCount: number;
    message?: string;
}
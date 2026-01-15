/**
 * API客户端服务
 * 使用Axios实现与后端数据清洗服务的通信
 */

import axios, { AxiosError } from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type {
    ApiClient,
    UploadResponse,
    StatusResponse,
    FileListResponse,
    FileDetailResponse,
    FileListParams,
    ErrorResponse,
} from '../types/api';
import { API_BASE_URL, API_TIMEOUT } from '../lib/constants';

/**
 * API错误类
 */
export class ApiError extends Error {
    public statusCode: number;
    public errorCode: string;
    public details?: unknown;
    public timestamp: string;

    constructor(errorResponse: ErrorResponse) {
        super(errorResponse.message);
        this.name = 'ApiError';
        this.statusCode = errorResponse.statusCode;
        this.errorCode = errorResponse.errorCode;
        this.details = errorResponse.details;
        this.timestamp = errorResponse.timestamp;
    }
}

/**
 * API客户端实现类
 */
class ApiClientImpl implements ApiClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
            timeout: API_TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        this.setupInterceptors();
    }

    /**
     * 设置请求和响应拦截器
     */
    private setupInterceptors(): void {
        // 请求拦截器
        this.client.interceptors.request.use(
            (config) => {
                // 可以在这里添加认证token等
                console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                console.error('API Request Error:', error);
                return Promise.reject(error);
            }
        );

        // 响应拦截器
        this.client.interceptors.response.use(
            (response: AxiosResponse) => {
                console.log(`API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error: AxiosError) => {
                console.error('API Response Error:', error);
                return this.handleError(error);
            }
        );
    }

    /**
     * 统一错误处理
     */
    private handleError(error: AxiosError): Promise<never> {
        if (error.response?.data) {
            // 服务器返回的错误响应
            const errorResponse = error.response.data as ErrorResponse;
            throw new ApiError(errorResponse);
        } else if (error.request) {
            // 网络错误或服务器无响应
            throw new ApiError({
                statusCode: 0,
                errorCode: 'NETWORK_ERROR',
                message: '网络连接失败，请检查网络设置',
                timestamp: new Date().toISOString(),
            });
        } else {
            // 其他错误
            throw new ApiError({
                statusCode: 0,
                errorCode: 'UNKNOWN_ERROR',
                message: error.message || '未知错误',
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * 上传文件
     */
    async uploadFile(file: File, onProgress?: (progressEvent: { loaded: number; total?: number }) => void): Promise<UploadResponse> {
        const formData = new FormData();
        formData.append('file', file);

        console.log('Starting file upload:', file.name); // 添加调试日志

        const response = await this.client.post<UploadResponse>(
            '/api/data-cleaning/upload',
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    console.log('Axios progress event:', progressEvent); // 添加调试日志
                    if (onProgress && progressEvent.total) {
                        const progress = {
                            loaded: progressEvent.loaded,
                            total: progressEvent.total
                        };
                        console.log('Calling onProgress with:', progress); // 添加调试日志
                        onProgress(progress);
                    }
                },
            }
        );

        console.log('Upload completed:', response.data); // 添加调试日志
        return response.data;
    }

    /**
     * 获取任务状态
     */
    async getJobStatus(jobId: string): Promise<StatusResponse> {
        const response = await this.client.get<StatusResponse>(
            `/api/data-cleaning/status/${jobId}`
        );

        return response.data;
    }

    /**
     * 获取文件列表
     */
    async getFileList(params?: FileListParams): Promise<FileListResponse> {
        const response = await this.client.get<FileListResponse>(
            '/api/data-cleaning/files',
            { params }
        );

        return response.data;
    }

    /**
     * 获取文件详情
     */
    async getFileDetail(fileId: string): Promise<FileDetailResponse> {
        const response = await this.client.get<FileDetailResponse>(
            `/api/data-cleaning/files/${fileId}`
        );

        return response.data;
    }

    /**
     * 下载清洁数据
     */
    async downloadCleanData(jobId: string): Promise<Blob> {
        const response = await this.client.get(
            `/api/data-cleaning/download/clean/${jobId}`,
            {
                responseType: 'blob',
            }
        );

        return response.data;
    }

    /**
     * 下载异常数据
     */
    async downloadExceptionData(jobId: string): Promise<Blob> {
        const response = await this.client.get(
            `/api/data-cleaning/download/exceptions/${jobId}`,
            {
                responseType: 'blob',
            }
        );

        return response.data;
    }

    /**
     * 分页查询清洁数据
     */
    async getCleanDataPaginated(jobId: string, page: number = 1, pageSize: number = 100): Promise<{
        data: any[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        const response = await this.client.get<{
            data: any[];
            total: number;
            page: number;
            pageSize: number;
            totalPages: number;
        }>(
            `/api/data-cleaning/data/clean/${jobId}`,
            {
                params: {
                    page,
                    pageSize,
                }
            }
        );

        return response.data;
    }

    /**
     * 分页查询异常数据
     */
    async getExceptionDataPaginated(jobId: string, page: number = 1, pageSize: number = 100): Promise<{
        data: any[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        const response = await this.client.get<{
            data: any[];
            total: number;
            page: number;
            pageSize: number;
            totalPages: number;
        }>(
            `/api/data-cleaning/data/exceptions/${jobId}`,
            {
                params: {
                    page,
                    pageSize,
                }
            }
        );

        return response.data;
    }
}

// 创建API客户端实例
export const apiClient = new ApiClientImpl();

// 导出API客户端类型和实例
export type { ApiClient };
export { ApiClientImpl };
/**
 * React Query 客户端配置
 */

import { QueryClient } from '@tanstack/react-query';

// 创建 Query Client 实例
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // 数据保持新鲜的时间（5分钟）
            staleTime: 5 * 60 * 1000,
            // 缓存时间（10分钟）
            gcTime: 10 * 60 * 1000,
            // 重试配置
            retry: (failureCount, error: unknown) => {
                // 对于 404 错误不重试
                if (error && typeof error === 'object' && 'response' in error) {
                    const response = (error as { response?: { status?: number } }).response;
                    if (response?.status === 404) {
                        return false;
                    }
                }
                // 最多重试 3 次
                return failureCount < 3;
            },
            // 重试延迟（指数退避）
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // 窗口重新获得焦点时重新获取数据
            refetchOnWindowFocus: false,
            // 网络重连时重新获取数据
            refetchOnReconnect: true,
        },
        mutations: {
            // 变更重试配置
            retry: (failureCount, error: unknown) => {
                // 对于客户端错误（4xx）不重试
                if (error && typeof error === 'object' && 'response' in error) {
                    const response = (error as { response?: { status?: number } }).response;
                    if (response?.status && response.status >= 400 && response.status < 500) {
                        return false;
                    }
                }
                // 最多重试 2 次
                return failureCount < 2;
            },
            // 变更重试延迟
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        },
    },
});

// Query Keys 常量
export const queryKeys = {
    // 文件相关
    files: ['files'] as const,
    fileList: (params?: Record<string, unknown>) => [...queryKeys.files, 'list', params] as const,
    fileDetail: (fileId: string) => [...queryKeys.files, 'detail', fileId] as const,

    // 任务相关
    jobs: ['jobs'] as const,
    jobStatus: (jobId: string) => [...queryKeys.jobs, 'status', jobId] as const,

    // 下载相关
    downloads: ['downloads'] as const,
    downloadClean: (jobId: string) => [...queryKeys.downloads, 'clean', jobId] as const,
    downloadException: (jobId: string) => [...queryKeys.downloads, 'exception', jobId] as const,

    // 数据查询相关
    cleanData: (jobId: string, page: number, pageSize: number) => [...queryKeys.jobs, 'cleanData', jobId, page, pageSize] as const,
    exceptionData: (jobId: string, page: number, pageSize: number) => [...queryKeys.jobs, 'exceptionData', jobId, page, pageSize] as const,
<<<<<<< HEAD

    // 规则配置相关
    ruleConfig: {
        all: ['rule-config'] as const,
        current: () => [...queryKeys.ruleConfig.all, 'current'] as const,
        history: (limit?: number) => [...queryKeys.ruleConfig.all, 'history', limit] as const,
        stats: () => [...queryKeys.ruleConfig.all, 'stats'] as const,
    },
=======
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
} as const;
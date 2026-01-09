/**
 * 文件下载 Hook
 */

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';
import { useNotificationStore } from '../store';

export type DownloadType = 'clean' | 'exception';

export interface UseFileDownloadOptions {
    onSuccess?: (blob: Blob, jobId: string, type: DownloadType) => void;
    onError?: (error: Error, jobId: string, type: DownloadType) => void;
}

export function useFileDownload(options: UseFileDownloadOptions = {}) {
    const { onSuccess, onError } = options;
    const notificationStore = useNotificationStore();

    // 下载清洁数据
    const downloadCleanMutation = useMutation({
        mutationFn: (jobId: string) => apiClient.downloadCleanData(jobId),
        onSuccess: (blob, jobId) => {
            // 创建下载链接
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `clean_data_${jobId}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            // 显示成功通知
            notificationStore.showSuccess('清洁数据下载成功！');

            // 调用自定义成功回调
            onSuccess?.(blob, jobId, 'clean');
        },
        onError: (error, jobId) => {
            // 显示错误通知
            notificationStore.showError(`清洁数据下载失败：${error.message}`);

            // 调用自定义错误回调
            onError?.(error, jobId, 'clean');
        },
    });

    // 下载异常数据
    const downloadExceptionMutation = useMutation({
        mutationFn: (jobId: string) => apiClient.downloadExceptionData(jobId),
        onSuccess: (blob, jobId) => {
            // 创建下载链接
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `exception_data_${jobId}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            // 显示成功通知
            notificationStore.showSuccess('异常数据下载成功！');

            // 调用自定义成功回调
            onSuccess?.(blob, jobId, 'exception');
        },
        onError: (error, jobId) => {
            // 显示错误通知
            notificationStore.showError(`异常数据下载失败：${error.message}`);

            // 调用自定义错误回调
            onError?.(error, jobId, 'exception');
        },
    });

    // 下载清洁数据的便捷方法
    const downloadCleanData = (jobId: string) => {
        return downloadCleanMutation.mutate(jobId);
    };

    // 下载异常数据的便捷方法
    const downloadExceptionData = (jobId: string) => {
        return downloadExceptionMutation.mutate(jobId);
    };

    return {
        // 清洁数据下载
        downloadCleanData,
        isDownloadingClean: downloadCleanMutation.isPending,
        cleanDownloadError: downloadCleanMutation.error,
        resetCleanDownload: downloadCleanMutation.reset,

        // 异常数据下载
        downloadExceptionData,
        isDownloadingException: downloadExceptionMutation.isPending,
        exceptionDownloadError: downloadExceptionMutation.error,
        resetExceptionDownload: downloadExceptionMutation.reset,

        // 通用状态
        isDownloading: downloadCleanMutation.isPending || downloadExceptionMutation.isPending,
    };
}
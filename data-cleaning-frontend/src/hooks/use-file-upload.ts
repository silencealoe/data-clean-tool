/**
 * 文件上传 Hook
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';
import { queryKeys } from '../lib/query-client';
import type { UploadResponse } from '../types';
import { useUploadStore } from '../store';
import { useNotificationStore } from '../store';

export interface UseFileUploadOptions {
    onSuccess?: (data: UploadResponse, file: File) => void;
    onError?: (error: Error, file: File) => void;
    onSettled?: (data: UploadResponse | undefined, error: Error | null, file: File) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
    const { onSuccess, onError, onSettled } = options;
    const queryClient = useQueryClient();
    const notificationStore = useNotificationStore();

    // 使用 Zustand store 的 hook 来获取响应式状态
    const {
        isUploading,
        progress,
        error,
        uploadedFile,
        setUploading,
        setProgress,
        setError,
        setUploadedFile,
        resetUploadState
    } = useUploadStore();

    const mutation = useMutation({
        mutationFn: (file: File) => {
            // 设置上传状态
            setUploading(true);
            setProgress(0);
            setError(null);

            return apiClient.uploadFile(file, (progressEvent) => {
                if (progressEvent.total) {
                    const progressValue = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    console.log('Upload progress:', progressValue); // 添加调试日志
                    setProgress(progressValue);
                }
            });
        },
        onSuccess: (data, file) => {
            // 更新上传状态
            setUploading(false);
            setProgress(100);
            setUploadedFile({
                jobId: data.jobId,
                fileId: data.fileId,
                fileName: file.name,
                totalRows: data.totalRows,
            });

            // 显示成功通知
            notificationStore.showSuccess(`文件 "${file.name}" 上传成功！正在处理中...`);

            // 使文件列表缓存失效，以便重新获取最新数据
            queryClient.invalidateQueries({
                queryKey: queryKeys.files,
            });

            // 调用自定义成功回调
            onSuccess?.(data, file);
        },
        onError: (error, file) => {
            // 更新上传状态
            setUploading(false);
            setProgress(0);
            setError(error.message);

            // 显示错误通知
            notificationStore.showError(`文件上传失败：${error.message}`);

            // 调用自定义错误回调
            onError?.(error, file);
        },
        onSettled: (data, error, file) => {
            // 调用自定义完成回调
            onSettled?.(data, error, file);
        },
    });

    // 重置上传状态
    const resetUpload = () => {
        resetUploadState();
        mutation.reset();
    };

    // 上传文件的便捷方法
    const uploadFile = (file: File) => {
        return mutation.mutate(file);
    };

    return {
        ...mutation,
        uploadFile,
        resetUpload,
        // 从 store 获取响应式状态
        isUploading,
        progress,
        error,
        uploadedFile,
    };
}
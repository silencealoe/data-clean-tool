/**
 * 文件上传进度Hook
 * 提供真正的HTTP上传进度跟踪
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient } from '../services/api-client';

export interface UploadProgressState {
    uploadId: string | null;
    fileName: string;
    totalSize: number;
    uploadedSize: number;
    progress: number;
    speed: number;
    status: 'idle' | 'uploading' | 'completed' | 'failed';
    estimatedTimeRemaining?: number;
    error: string | null;
}

export interface UseUploadProgressOptions {
    onProgress?: (progress: UploadProgressState) => void;
    onComplete?: (response: { taskId: string; fileId: string; fileName: string }) => void;
    onError?: (error: string) => void;
    enableRealTimeUpdates?: boolean;
}

export function useUploadProgress(options: UseUploadProgressOptions = {}) {
    const {
        onProgress,
        onComplete,
        onError,
        enableRealTimeUpdates = true,
    } = options;

    const [state, setState] = useState<UploadProgressState>({
        uploadId: null,
        fileName: '',
        totalSize: 0,
        uploadedSize: 0,
        progress: 0,
        speed: 0,
        status: 'idle',
        error: null,
    });

    const eventSourceRef = useRef<EventSource | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // 清理资源
    const cleanup = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    // 开始监听上传进度
    const startProgressTracking = useCallback((uploadId: string) => {
        cleanup();

        if (enableRealTimeUpdates) {
            // 使用Server-Sent Events实时更新
            try {
                const eventSource = apiClient.createUploadProgressStream(uploadId);
                eventSourceRef.current = eventSource;

                eventSource.onmessage = (event) => {
                    try {
                        const progressData = JSON.parse(event.data);
                        setState(prev => ({
                            ...prev,
                            ...progressData,
                        }));
                        onProgress?.(progressData);

                        if (progressData.status === 'completed') {
                            onComplete?.(uploadId);
                            cleanup();
                        } else if (progressData.status === 'failed') {
                            onError?.('Upload failed');
                            cleanup();
                        }
                    } catch (error) {
                        console.error('Failed to parse progress data:', error);
                    }
                };

                eventSource.onerror = (error) => {
                    console.error('EventSource error:', error);
                    // 如果SSE失败，回退到轮询
                    startPolling(uploadId);
                };
            } catch (error) {
                console.error('Failed to create EventSource:', error);
                // 回退到轮询
                startPolling(uploadId);
            }
        } else {
            // 使用轮询
            startPolling(uploadId);
        }
    }, [enableRealTimeUpdates, onProgress, onComplete, onError, cleanup]);

    // 轮询上传进度
    const startPolling = useCallback((uploadId: string) => {
        const poll = async () => {
            try {
                const progressData = await apiClient.getUploadProgress(uploadId);
                setState(prev => ({
                    ...prev,
                    ...progressData,
                }));
                onProgress?.(progressData);

                if (progressData.status === 'completed') {
                    onComplete?.(uploadId);
                    cleanup();
                } else if (progressData.status === 'failed') {
                    onError?.('Upload failed');
                    cleanup();
                }
            } catch (error) {
                console.error('Failed to poll upload progress:', error);
                // 如果上传记录不存在，可能已经完成或失败
                if (error.message.includes('not found')) {
                    cleanup();
                }
            }
        };

        // 立即执行一次
        poll();

        // 每500ms轮询一次
        pollIntervalRef.current = setInterval(poll, 500);
    }, [onProgress, onComplete, onError, cleanup]);

    // 上传文件
    const uploadFile = useCallback(async (file: File): Promise<{ taskId: string; fileId: string; fileName: string }> => {
        setState({
            uploadId: null,
            fileName: file.name,
            totalSize: file.size,
            uploadedSize: 0,
            progress: 0,
            speed: 0,
            status: 'uploading',
            error: null,
        });

        try {
            // 使用标准的axios上传，获取HTTP上传进度
            const response = await apiClient.uploadFileAsync(file, (progressEvent) => {
                if (progressEvent.total) {
                    const progress = (progressEvent.loaded / progressEvent.total) * 100;
                    setState(prev => ({
                        ...prev,
                        uploadedSize: progressEvent.loaded,
                        progress,
                        status: 'uploading',
                    }));
                }
            });

            // 上传完成，开始跟踪后端处理进度
            setState(prev => ({
                ...prev,
                uploadId: response.taskId,
                progress: 100,
                status: 'completed',
            }));

            const result = {
                taskId: response.taskId,
                fileId: response.fileId,
                fileName: file.name,
            };

            onComplete?.(result);
            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';
            setState(prev => ({
                ...prev,
                status: 'failed',
                error: errorMessage,
            }));
            onError?.(errorMessage);
            throw error;
        }
    }, [onComplete, onError]);

    // 重置状态
    const reset = useCallback(() => {
        cleanup();
        setState({
            uploadId: null,
            fileName: '',
            totalSize: 0,
            uploadedSize: 0,
            progress: 0,
            speed: 0,
            status: 'idle',
            error: null,
        });
    }, [cleanup]);

    // 组件卸载时清理资源
    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    return {
        ...state,
        uploadFile,
        startProgressTracking,
        reset,
        isUploading: state.status === 'uploading',
        isCompleted: state.status === 'completed',
        isFailed: state.status === 'failed',
        isIdle: state.status === 'idle',
    };
}
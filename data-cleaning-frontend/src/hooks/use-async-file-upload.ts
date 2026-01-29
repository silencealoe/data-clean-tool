/**
 * 异步文件上传 Hook
 * 支持异步队列处理和实时进度监控
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';
import { queryKeys } from '../lib/query-client';
import type { AsyncUploadResponse, TaskStatusResponse } from '../types/api';
import { createTaskPoller, type PollingOptions } from '../lib/polling-utils';
import { useNotificationStore } from '../store';

export interface UseAsyncFileUploadOptions {
    onUploadSuccess?: (data: AsyncUploadResponse, file: File) => void;
    onUploadError?: (error: Error, file: File) => void;
    onProgressUpdate?: (status: TaskStatusResponse) => void;
    onProcessingComplete?: (status: TaskStatusResponse) => void;
    onProcessingError?: (error: Error) => void;
    pollingInterval?: number;
    maxPollingAttempts?: number;
    autoStartPolling?: boolean;
}

export interface AsyncUploadState {
  // 上传阶段状态
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  uploadedFile: {
    taskId: string;
    fileId: string;
    fileName: string;
  } | null;
  
  // 处理阶段状态
  isProcessing: boolean;
  processingStatus: TaskStatusResponse | null;
  processingError: string | null;
  
  // 轮询控制
  isPolling: boolean;
}

export function useAsyncFileUpload(options: UseAsyncFileUploadOptions = {}) {
  const {
    onUploadSuccess,
    onUploadError,
    onProgressUpdate,
    onProcessingComplete,
    onProcessingError,
    pollingInterval = 2000,
    maxPollingAttempts = 300, // 10分钟
    autoStartPolling = true,
  } = options;

  const queryClient = useQueryClient();
  const notificationStore = useNotificationStore();

  // 状态管理
  const [state, setState] = useState<AsyncUploadState>({
    isUploading: false,
    uploadProgress: 0,
    uploadError: null,
    uploadedFile: null,
    isProcessing: false,
    processingStatus: null,
    processingError: null,
    isPolling: false,
  });

  const [poller, setPoller] = useState<ReturnType<typeof createTaskPoller> | null>(null);

  // 开始轮询任务状态
  const startPolling = useCallback((taskId: string) => {
    if (state.isPolling || poller) {
      return;
    }

    console.log(`Starting polling for async task ${taskId}`);
    
    setState(prev => ({ 
      ...prev, 
      isPolling: true, 
      isProcessing: true,
      processingError: null 
    }));

    const pollingOptions: PollingOptions = {
      interval: pollingInterval,
      maxAttempts: maxPollingAttempts,
      onProgress: (status: TaskStatusResponse) => {
        setState(prev => ({
          ...prev,
          processingStatus: status,
        }));
        onProgressUpdate?.(status);
      },
      onComplete: (status: TaskStatusResponse) => {
        console.log(`Async task ${taskId} completed with status: ${status.status}`);
        setState(prev => ({
          ...prev,
          isPolling: false,
          isProcessing: false,
          processingStatus: status,
        }));
        
        // 使文件列表缓存失效
        queryClient.invalidateQueries({
          queryKey: queryKeys.files,
        });

        // 显示完成通知
        if (status.status === 'completed') {
          notificationStore.showSuccess('文件处理完成！');
        } else if (status.status === 'failed') {
          notificationStore.showError(`文件处理失败：${status.errorMessage || '未知错误'}`);
        }

        onProcessingComplete?.(status);
      },
      onError: (error: Error) => {
        console.error(`Polling error for async task ${taskId}:`, error);
        setState(prev => ({
          ...prev,
          isPolling: false,
          isProcessing: false,
          processingError: error.message,
        }));
        
        notificationStore.showError(`状态查询失败：${error.message}`);
        onProcessingError?.(error);
      },
      onTimeout: () => {
        console.warn(`Polling timeout for async task ${taskId}`);
        setState(prev => ({
          ...prev,
          isPolling: false,
          isProcessing: false,
          processingError: '状态查询超时',
        }));
        
        notificationStore.showError('状态查询超时，请手动刷新');
      },
    };

    const newPoller = createTaskPoller(taskId, pollingOptions);
    setPoller(newPoller);
    newPoller.start();
  }, [
    state.isPolling, 
    poller, 
    pollingInterval, 
    maxPollingAttempts, 
    onProgressUpdate, 
    onProcessingComplete, 
    onProcessingError,
    queryClient,
    notificationStore
  ]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (poller) {
      console.log('Stopping async task polling');
      poller.stop();
      setPoller(null);
    }
    setState(prev => ({ ...prev, isPolling: false }));
  }, [poller]);

  // 上传文件的 mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      setState(prev => ({
        ...prev,
        isUploading: true,
        uploadProgress: 0,
        uploadError: null,
        uploadedFile: null,
        processingStatus: null,
        processingError: null,
      }));

      return apiClient.uploadFileAsync(file, (progressEvent) => {
        if (progressEvent.total) {
          const progressValue = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log('Async upload progress:', progressValue);
          setState(prev => ({ ...prev, uploadProgress: progressValue }));
        }
      });
    },
    onSuccess: (data, file) => {
      console.log('Async upload success:', data);
      
      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 100,
        uploadedFile: {
          taskId: data.taskId,
          fileId: data.fileId,
          fileName: file.name,
        },
      }));

      notificationStore.showSuccess(`文件 "${file.name}" 上传成功！开始处理...`);
      onUploadSuccess?.(data, file);

      // 自动开始轮询
      if (autoStartPolling) {
        startPolling(data.taskId);
      }
    },
    onError: (error, file) => {
      console.error('Async upload error:', error);
      
      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 0,
        uploadError: error.message,
      }));

      notificationStore.showError(`文件上传失败：${error.message}`);
      onUploadError?.(error, file);
    },
  });

  // 重置状态
  const reset = useCallback(() => {
    stopPolling();
    setState({
      isUploading: false,
      uploadProgress: 0,
      uploadError: null,
      uploadedFile: null,
      isProcessing: false,
      processingStatus: null,
      processingError: null,
      isPolling: false,
    });
    uploadMutation.reset();
  }, [stopPolling, uploadMutation]);

  // 手动刷新状态
  const refreshStatus = useCallback(() => {
    if (state.uploadedFile?.taskId) {
      stopPolling();
      setTimeout(() => {
        startPolling(state.uploadedFile!.taskId);
      }, 100);
    }
  }, [state.uploadedFile?.taskId, stopPolling, startPolling]);

  // 上传文件的便捷方法
  const uploadFile = useCallback((file: File) => {
    return uploadMutation.mutate(file);
  }, [uploadMutation]);

  return {
    // 状态
    ...state,
    
    // 方法
    uploadFile,
    startPolling,
    stopPolling,
    refreshStatus,
    reset,
    
    // Mutation 状态
    isUploadPending: uploadMutation.isPending,
    uploadError: uploadMutation.error,
  };
}
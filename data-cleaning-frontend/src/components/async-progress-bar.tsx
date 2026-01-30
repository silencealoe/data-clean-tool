/**
 * 异步任务进度条组件
 * 提供实时进度显示、状态转换动画和错误处理
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Download,
  AlertTriangle
} from 'lucide-react';
import type { TaskStatusResponse, TaskStatus } from '../types/api';
import { createTaskPoller, type PollingOptions } from '../lib/polling-utils';
import { cn } from '../lib/utils';

export interface AsyncProgressBarProps {
  taskId: string;
  className?: string;
  pollingInterval?: number;
  maxPollingAttempts?: number;
  onComplete?: (status: TaskStatusResponse) => void;
  onError?: (error: Error) => void;
  onRetry?: () => void;
  showDownloadButton?: boolean;
  showRetryButton?: boolean;
  showDetails?: boolean;
  autoStart?: boolean;
}

interface ProgressState {
  status: TaskStatus;
  progress: number;
  processedRows: number;
  totalRows: number;
  currentPhase: string;
  estimatedTimeRemaining?: number;
  statistics?: any;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const STATUS_CONFIG = {
  pending: {
    label: '等待处理',
    color: 'bg-yellow-500',
    icon: Clock,
    badgeVariant: 'secondary' as const,
  },
  processing: {
    label: '处理中',
    color: 'bg-blue-500',
    icon: Loader2,
    badgeVariant: 'default' as const,
  },
  completed: {
    label: '已完成',
    color: 'bg-green-500',
    icon: CheckCircle,
    badgeVariant: 'success' as const,
  },
  failed: {
    label: '处理失败',
    color: 'bg-red-500',
    icon: XCircle,
    badgeVariant: 'destructive' as const,
  },
  timeout: {
    label: '处理超时',
    color: 'bg-orange-500',
    icon: AlertTriangle,
    badgeVariant: 'destructive' as const,
  },
};

export const AsyncProgressBar: React.FC<AsyncProgressBarProps> = ({
  taskId,
  className,
  pollingInterval = 2000,
  maxPollingAttempts = 300, // 10分钟
  onComplete,
  onError,
  onRetry,
  showDownloadButton = true,
  showRetryButton = true,
  showDetails = true,
  autoStart = true,
}) => {
  const [progressState, setProgressState] = useState<ProgressState>({
    status: 'pending',
    progress: 0,
    processedRows: 0,
    totalRows: 0,
    currentPhase: '初始化',
    createdAt: new Date().toISOString(),
  });

  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 使用 ref 来存储 poller，避免依赖循环
  const pollerRef = useRef<ReturnType<typeof createTaskPoller> | null>(null);

  // 使用 ref 存储回调函数，避免依赖循环
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  // 格式化时间
  const formatTime = useCallback((ms?: number): string => {
    if (!ms) return '--';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }, []);

  // 格式化数字
  const formatNumber = useCallback((num: number): string => {
    return num.toLocaleString();
  }, []);

  // 开始轮询
  const startPolling = useCallback(() => {
    // 如果已经有轮询器在运行，先停止它
    if (pollerRef.current) {
      pollerRef.current.stop();
      pollerRef.current = null;
    }

    console.log(`Starting polling for task ${taskId}`);
    setError(null);
    setIsPolling(true);

    const pollingOptions: PollingOptions = {
      interval: pollingInterval,
      maxAttempts: maxPollingAttempts,
      onProgress: (status: TaskStatusResponse) => {
        setProgressState({
          status: status.status,
          progress: status.progress,
          processedRows: status.processedRows,
          totalRows: status.totalRows,
          currentPhase: status.currentPhase,
          estimatedTimeRemaining: status.estimatedTimeRemaining,
          statistics: status.statistics,
          errorMessage: status.errorMessage,
          createdAt: status.createdAt || new Date().toISOString(),
          startedAt: status.startedAt,
          completedAt: status.completedAt,
        });
      },
      onComplete: (status: TaskStatusResponse) => {
        console.log(`Task ${taskId} completed with status: ${status.status}`);
        setIsPolling(false);
        onCompleteRef.current?.(status);
      },
      onError: (err: Error) => {
        console.error(`Polling error for task ${taskId}:`, err);
        setError(err.message);
        setIsPolling(false);
        onErrorRef.current?.(err);
      },
      onTimeout: () => {
        console.warn(`Polling timeout for task ${taskId}`);
        setError('轮询超时，请手动刷新状态');
        setIsPolling(false);
      },
    };

    const newPoller = createTaskPoller(taskId, pollingOptions);
    pollerRef.current = newPoller;
    newPoller.start();
  }, [taskId, pollingInterval, maxPollingAttempts]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollerRef.current) {
      console.log(`Stopping polling for task ${taskId}`);
      pollerRef.current.stop();
      pollerRef.current = null;
    }
    setIsPolling(false);
  }, [taskId]);

  // 重试
  const handleRetry = useCallback(() => {
    setError(null);
    setProgressState(prev => ({ ...prev, status: 'pending', progress: 0 }));
    onRetry?.();
    startPolling();
  }, [onRetry, startPolling]);

  // 手动刷新状态
  const handleRefresh = useCallback(() => {
    stopPolling();
    setTimeout(() => {
      startPolling();
    }, 100);
  }, [stopPolling, startPolling]);

  // 组件挂载时自动开始轮询
  useEffect(() => {
    if (autoStart) {
      // 直接调用轮询逻辑，避免依赖 startPolling 函数
      if (pollerRef.current) {
        pollerRef.current.stop();
        pollerRef.current = null;
      }

      console.log(`Auto-starting polling for task ${taskId}`);
      setError(null);
      setIsPolling(true);

      const pollingOptions: PollingOptions = {
        interval: pollingInterval,
        maxAttempts: maxPollingAttempts,
        onProgress: (status: TaskStatusResponse) => {
          setProgressState({
            status: status.status,
            progress: status.progress,
            processedRows: status.processedRows,
            totalRows: status.totalRows,
            currentPhase: status.currentPhase,
            estimatedTimeRemaining: status.estimatedTimeRemaining,
            statistics: status.statistics,
            errorMessage: status.errorMessage,
            createdAt: status.createdAt || new Date().toISOString(),
            startedAt: status.startedAt,
            completedAt: status.completedAt,
          });
        },
        onComplete: (status: TaskStatusResponse) => {
          console.log(`Task ${taskId} completed with status: ${status.status}`);
          setIsPolling(false);
          onCompleteRef.current?.(status);
        },
        onError: (err: Error) => {
          console.error(`Polling error for task ${taskId}:`, err);
          setError(err.message);
          setIsPolling(false);
          onErrorRef.current?.(err);
        },
        onTimeout: () => {
          console.warn(`Polling timeout for task ${taskId}`);
          setError('轮询超时，请手动刷新状态');
          setIsPolling(false);
        },
      };

      const newPoller = createTaskPoller(taskId, pollingOptions);
      pollerRef.current = newPoller;
      newPoller.start();
    }

    return () => {
      // 清理函数中直接访问 ref
      if (pollerRef.current) {
        console.log(`Cleaning up polling for task ${taskId}`);
        pollerRef.current.stop();
        pollerRef.current = null;
      }
      setIsPolling(false);
    };
  }, [autoStart, taskId, pollingInterval, maxPollingAttempts]); // 只依赖基本参数

  const statusConfig = STATUS_CONFIG[progressState.status];
  const StatusIcon = statusConfig.icon;
  const isTerminal = ['completed', 'failed', 'timeout'].includes(progressState.status);
  const isProcessing = progressState.status === 'processing';

  return (
    <div className={cn('space-y-4', className)}>
      {/* 状态头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <StatusIcon
            className={cn(
              'h-5 w-5',
              isProcessing && 'animate-spin',
              progressState.status === 'completed' && 'text-green-500',
              progressState.status === 'failed' && 'text-red-500',
              progressState.status === 'timeout' && 'text-orange-500',
              progressState.status === 'pending' && 'text-yellow-500',
              progressState.status === 'processing' && 'text-blue-500'
            )}
          />
          <Badge variant={statusConfig.badgeVariant}>
            {statusConfig.label}
          </Badge>
          <span className="text-sm text-gray-600">
            {progressState.currentPhase}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {!isTerminal && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isPolling}
            >
              <RefreshCw className={cn('h-4 w-4', isPolling && 'animate-spin')} />
            </Button>
          )}

          {showRetryButton && (progressState.status === 'failed' || error) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
            >
              重试
            </Button>
          )}

          {showDownloadButton && progressState.status === 'completed' && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                // 这里应该触发下载逻辑
                console.log('Download triggered for task:', taskId);
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              下载结果
            </Button>
          )}
        </div>
      </div>

      {/* 进度条 */}
      <div className="space-y-2">
        <Progress
          value={progressState.progress}
          className="h-3 transition-all duration-300"
        />
        <div className="flex justify-between text-sm text-gray-600">
          <span>{progressState.progress.toFixed(1)}%</span>
          <span>
            {formatNumber(progressState.processedRows)} / {formatNumber(progressState.totalRows)} 行
          </span>
        </div>
      </div>

      {/* 预估时间 */}
      {isProcessing && progressState.estimatedTimeRemaining && (
        <div className="text-sm text-gray-600 text-center">
          预计剩余时间: {formatTime(progressState.estimatedTimeRemaining)}
        </div>
      )}

      {/* 错误信息 */}
      {(error || progressState.errorMessage) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error || progressState.errorMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* 详细信息 */}
      {showDetails && (
        <div className="text-xs text-gray-500 space-y-1">
          <div>任务ID: {taskId}</div>
          <div>创建时间: {progressState.createdAt ? new Date(progressState.createdAt).toLocaleString() : '--'}</div>
          {progressState.startedAt && (
            <div>开始时间: {new Date(progressState.startedAt).toLocaleString()}</div>
          )}
          {progressState.completedAt && (
            <div>完成时间: {new Date(progressState.completedAt).toLocaleString()}</div>
          )}
          {progressState.statistics && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
              <div className="font-medium mb-1">处理统计:</div>
              <div>总行数: {formatNumber(progressState.statistics.totalRows || 0)}</div>
              <div>清洗行数: {formatNumber(progressState.statistics.processedRows || 0)}</div>
              <div>异常行数: {formatNumber(progressState.statistics.invalidRows || 0)}</div>
              <div>处理时间: {formatTime(progressState.statistics.processingTimeMs)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AsyncProgressBar;
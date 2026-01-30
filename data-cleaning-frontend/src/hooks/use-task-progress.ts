/**
 * 任务进度获取 Hook
 * 用于获取正在处理中的任务的实时进度信息
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';
import { queryKeys } from '../lib/query-client';

export interface TaskProgress {
    taskId: string;
    progress: number;
    processedRows: number;
    totalRows: number;
    currentPhase: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    estimatedTimeRemaining?: number;
    lastUpdated: string;
}

export interface UseTaskProgressOptions {
    taskId: string;
    enabled?: boolean;
    refetchInterval?: number;
}

export function useTaskProgress(options: UseTaskProgressOptions) {
    const { taskId, enabled = true, refetchInterval = 2000 } = options;

    const query = useQuery({
        queryKey: queryKeys.taskProgress(taskId),
        queryFn: async () => {
            const response = await apiClient.getTaskStatus(taskId);
            return response as TaskProgress;
        },
        enabled: enabled && !!taskId,
        refetchInterval: (data) => {
            // 如果任务已完成或失败，停止轮询
            if (data?.status === 'completed' || data?.status === 'failed') {
                return false;
            }
            return refetchInterval;
        },
        staleTime: 0, // 总是获取最新数据
        gcTime: 1 * 60 * 1000, // 1 minute
    });

    // 格式化预估剩余时间
    const formatEstimatedTime = (milliseconds?: number) => {
        if (!milliseconds || milliseconds <= 0) {
            return null;
        }

        const seconds = Math.floor(milliseconds / 1000);
        if (seconds < 60) {
            return `约 ${seconds} 秒`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `约 ${minutes} 分钟`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const remainingMinutes = Math.floor((seconds % 3600) / 60);
            return `约 ${hours} 小时 ${remainingMinutes} 分钟`;
        }
    };

    // 格式化当前阶段
    const formatPhase = (phase: string) => {
        const phaseMap: Record<string, string> = {
            'estimating': '估算文件大小',
            'preparing': '准备处理',
            'initializing': '初始化',
            'parsing': '解析文件',
            'cleaning': '清洗数据',
            'saving_batch': '保存数据',
            'finalizing': '完成处理',
            'completed': '处理完成',
            'failed': '处理失败'
        };
        return phaseMap[phase] || phase;
    };

    return {
        ...query,
        formatEstimatedTime,
        formatPhase,
    };
}
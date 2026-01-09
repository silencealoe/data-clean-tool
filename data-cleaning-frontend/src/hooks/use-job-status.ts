/**
 * 任务状态数据获取 Hook
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../services/api-client';
import { queryKeys } from '../lib/query-client';
import type { StatusResponse } from '../types';

export interface UseJobStatusOptions {
    jobId: string;
    enabled?: boolean;
    pollingInterval?: number;
    stopPollingOnCompleted?: boolean;
}

export function useJobStatus(options: UseJobStatusOptions) {
    const {
        jobId,
        enabled = true,
        pollingInterval = 2000, // 2 seconds
        stopPollingOnCompleted = true
    } = options;

    const queryClient = useQueryClient();
    const pollingIntervalRef = useRef<number | null>(null);

    const query = useQuery({
        queryKey: queryKeys.jobStatus(jobId),
        queryFn: () => apiClient.getJobStatus(jobId),
        enabled: enabled && !!jobId,
        staleTime: 0, // Always consider stale for real-time updates
        gcTime: 2 * 60 * 1000, // 2 minutes
        refetchInterval: false, // We'll handle polling manually
    });

    // 手动轮询逻辑
    useEffect(() => {
        if (!enabled || !jobId || !query.data) {
            return;
        }

        const shouldStopPolling = stopPollingOnCompleted &&
            (query.data.status === 'completed' || query.data.status === 'failed');

        if (shouldStopPolling) {
            if (pollingIntervalRef.current) {
                window.clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            return;
        }

        // 开始轮询
        if (!pollingIntervalRef.current && query.data.status === 'processing') {
            pollingIntervalRef.current = window.setInterval(() => {
                query.refetch();
            }, pollingInterval);
        }

        return () => {
            if (pollingIntervalRef.current) {
                window.clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [enabled, jobId, query.data?.status, pollingInterval, stopPollingOnCompleted, query]);

    // 组件卸载时清理轮询
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) {
                window.clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, []);

    // 开始轮询
    const startPolling = useCallback(() => {
        if (!pollingIntervalRef.current) {
            pollingIntervalRef.current = window.setInterval(() => {
                query.refetch();
            }, pollingInterval);
        }
    }, [pollingInterval, query]);

    // 停止轮询
    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            window.clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }, []);

    // 刷新任务状态
    const refetchJobStatus = () => {
        return query.refetch();
    };

    // 使任务状态缓存失效
    const invalidateJobStatus = () => {
        return queryClient.invalidateQueries({
            queryKey: queryKeys.jobStatus(jobId),
        });
    };

    // 更新任务状态缓存
    const updateJobStatus = (updater: (oldData: StatusResponse) => StatusResponse) => {
        queryClient.setQueryData(queryKeys.jobStatus(jobId), updater);
    };

    return {
        ...query,
        startPolling,
        stopPolling,
        refetchJobStatus,
        invalidateJobStatus,
        updateJobStatus,
    };
}
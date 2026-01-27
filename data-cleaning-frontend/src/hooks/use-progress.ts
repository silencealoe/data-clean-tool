/**
 * 处理进度数据获取 Hook
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';
import { queryKeys } from '../lib/query-client';
import type { ProgressResponse } from '../types/api';

export interface UseProgressOptions {
    jobId: string;
    enabled?: boolean;
    refetchInterval?: number | false;
}

export function useProgress(options: UseProgressOptions) {
    const {
        jobId,
        enabled = true,
        refetchInterval = 2000, // 2 seconds
    } = options;

    const query = useQuery<ProgressResponse>({
        queryKey: [...queryKeys.jobStatus(jobId), 'progress'],
        queryFn: () => apiClient.getProgress(jobId),
        enabled: enabled && !!jobId,
        staleTime: 0,
        gcTime: 2 * 60 * 1000,
        refetchInterval: refetchInterval,
    });

    return query;
}

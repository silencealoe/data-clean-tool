/**
 * 性能指标数据获取 Hook
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';
import { queryKeys } from '../lib/query-client';
import type { MetricsResponse } from '../types/api';

export interface UseMetricsOptions {
    jobId: string;
    enabled?: boolean;
    refetchInterval?: number | false;
}

export function useMetrics(options: UseMetricsOptions) {
    const {
        jobId,
        enabled = true,
        refetchInterval = 2000, // 2 seconds
    } = options;

    const query = useQuery<MetricsResponse>({
        queryKey: [...queryKeys.jobStatus(jobId), 'metrics'],
        queryFn: () => apiClient.getMetrics(jobId),
        enabled: enabled && !!jobId,
        staleTime: 0,
        gcTime: 2 * 60 * 1000,
        refetchInterval: refetchInterval,
    });

    return query;
}

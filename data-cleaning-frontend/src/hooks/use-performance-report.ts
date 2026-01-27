/**
 * 性能报告数据获取 Hook
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';
import { queryKeys } from '../lib/query-client';
import type { PerformanceReportResponse } from '../types/api';

export interface UsePerformanceReportOptions {
    jobId: string;
    enabled?: boolean;
}

export function usePerformanceReport(options: UsePerformanceReportOptions) {
    const {
        jobId,
        enabled = true,
    } = options;

    const query = useQuery<PerformanceReportResponse>({
        queryKey: [...queryKeys.jobStatus(jobId), 'performance-report'],
        queryFn: () => apiClient.getPerformanceReport(jobId),
        enabled: enabled && !!jobId,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
    });

    return query;
}

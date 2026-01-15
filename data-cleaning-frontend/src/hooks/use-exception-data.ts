/**
 * 异常数据查询 Hook
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';
import { queryKeys } from '../lib/query-client';
import type { PaginatedDataResponse } from '../types';

export interface UseExceptionDataOptions {
    jobId: string;
    page?: number;
    pageSize?: number;
    enabled?: boolean;
}

export function useExceptionData(options: UseExceptionDataOptions) {
    const { jobId, page = 1, pageSize = 100, enabled = true } = options;
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: queryKeys.exceptionData({ jobId, page, pageSize }),
        queryFn: () => apiClient.getExceptionDataPaginated(jobId, page, pageSize),
        enabled,
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000, // 5 minutes
    });

    const refetchExceptionData = () => {
        return query.refetch();
    };

    return {
        ...query,
        refetchExceptionData,
    };
}

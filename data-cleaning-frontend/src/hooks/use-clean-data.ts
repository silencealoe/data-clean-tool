/**
 * 清洁数据查询 Hook
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';
import { queryKeys } from '../lib/query-client';
import type { PaginatedDataResponse } from '../types';

export interface UseCleanDataOptions {
    jobId: string;
    page?: number;
    pageSize?: number;
    enabled?: boolean;
}

export function useCleanData(options: UseCleanDataOptions) {
    const { jobId, page = 1, pageSize = 100, enabled = true } = options;
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: queryKeys.cleanData({ jobId, page, pageSize }),
        queryFn: () => apiClient.getCleanDataPaginated(jobId, page, pageSize),
        enabled,
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000, // 5 minutes
    });

    const refetchCleanData = () => {
        return query.refetch();
    };

    return {
        ...query,
        refetchCleanData,
    };
}

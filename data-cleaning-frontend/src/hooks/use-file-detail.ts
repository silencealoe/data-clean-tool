/**
 * 文件详情数据获取 Hook
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';
import { queryKeys } from '../lib/query-client';
import type { FileDetailResponse } from '../types';

export interface UseFileDetailOptions {
    fileId: string;
    enabled?: boolean;
}

export function useFileDetail(options: UseFileDetailOptions) {
    const { fileId, enabled = true } = options;
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: queryKeys.fileDetail(fileId),
        queryFn: () => apiClient.getFileDetail(fileId),
        enabled: enabled && !!fileId,
        staleTime: 1 * 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
    });

    // 刷新文件详情
    const refetchFileDetail = () => {
        return query.refetch();
    };

    // 使文件详情缓存失效
    const invalidateFileDetail = () => {
        return queryClient.invalidateQueries({
            queryKey: queryKeys.fileDetail(fileId),
        });
    };

    // 更新文件详情缓存
    const updateFileDetail = (updater: (oldData: FileDetailResponse) => FileDetailResponse) => {
        queryClient.setQueryData(queryKeys.fileDetail(fileId), updater);
    };

    return {
        ...query,
        refetchFileDetail,
        invalidateFileDetail,
        updateFileDetail,
    };
}
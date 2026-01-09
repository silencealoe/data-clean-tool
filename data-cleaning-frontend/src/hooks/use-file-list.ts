/**
 * 文件列表数据获取 Hook
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';
import { queryKeys } from '../lib/query-client';
import type { FileListParams, FileListResponse } from '../types';

export interface UseFileListOptions {
    params?: FileListParams;
    enabled?: boolean;
}

export function useFileList(options: UseFileListOptions = {}) {
    const { params, enabled = true } = options;
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: queryKeys.fileList(params),
        queryFn: () => apiClient.getFileList(params),
        enabled,
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000, // 5 minutes
    });

    // 刷新文件列表
    const refetchFileList = () => {
        return query.refetch();
    };

    // 使文件列表缓存失效
    const invalidateFileList = () => {
        return queryClient.invalidateQueries({
            queryKey: queryKeys.files,
        });
    };

    // 更新文件列表缓存中的单个文件
    const updateFileInList = (_fileId: string, updater: (oldData: FileListResponse) => FileListResponse) => {
        queryClient.setQueryData(queryKeys.fileList(params), updater);
    };

    return {
        ...query,
        refetchFileList,
        invalidateFileList,
        updateFileInList,
    };
}
/**
 * 文件列表组件
 * 提供分页文件列表显示、状态和日期筛选功能
 */

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { FileText, Calendar, Filter, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useFileList } from '../hooks/use-file-list';
import { useFileListStore } from '../store/file-list-store';
import { formatFileSize } from '../lib/file-utils';
import { cn } from '../lib/utils';
import { DEFAULT_PAGE_SIZE } from '../lib/constants';
import type { FileStatus, FileListParams } from '../types';

interface FileListProps {
    onFileSelect?: (fileId: string) => void;
    className?: string;
}

// 状态标签配置
const statusConfig = {
    pending: { label: '等待中', variant: 'secondary' as const, color: 'bg-gray-100 text-gray-800' },
    processing: { label: '处理中', variant: 'default' as const, color: 'bg-blue-100 text-blue-800' },
    completed: { label: '已完成', variant: 'default' as const, color: 'bg-green-100 text-green-800' },
    failed: { label: '失败', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
};

export function FileList({ onFileSelect, className }: FileListProps) {
    const { filters, pagination } = useFileListStore();
    const [localFilters, setLocalFilters] = useState({
        status: filters.status || '',
        startDate: filters.startDate || '',
        endDate: filters.endDate || '',
    });

    // 构建查询参数
    const queryParams = useMemo((): FileListParams => {
        const params: FileListParams = {
            page: pagination.page,
            pageSize: pagination.pageSize || DEFAULT_PAGE_SIZE,
        };

        if (filters.status) {
            params.status = filters.status;
        }
        if (filters.startDate) {
            params.startDate = filters.startDate;
        }
        if (filters.endDate) {
            params.endDate = filters.endDate;
        }

        return params;
    }, [filters, pagination]);

    // 获取文件列表数据
    const { data, isLoading, error, refetch } = useFileList({
        params: queryParams,
    });

    // 更新store状态
    React.useEffect(() => {
        if (data) {
            useFileListStore.getState().setFiles(data.files);
            useFileListStore.getState().setPagination({
                page: data.page,
                pageSize: data.pageSize,
                total: data.total,
                totalPages: Math.ceil(data.total / data.pageSize),
            });
        }
    }, [data]);

    React.useEffect(() => {
        useFileListStore.getState().setLoading(isLoading);
    }, [isLoading]);

    React.useEffect(() => {
        useFileListStore.getState().setError(error?.message || null);
    }, [error]);

    // 应用筛选
    const applyFilters = () => {
        const newFilters = {
            status: localFilters.status as FileStatus | undefined,
            startDate: localFilters.startDate || undefined,
            endDate: localFilters.endDate || undefined,
        };

        useFileListStore.getState().setFilters(newFilters);
        useFileListStore.getState().setPagination({ ...pagination, page: 1 });
    };

    // 重置筛选
    const resetFilters = () => {
        setLocalFilters({
            status: '',
            startDate: '',
            endDate: '',
        });
        useFileListStore.getState().resetFilters();
        useFileListStore.getState().setPagination({ ...pagination, page: 1 });
    };

    // 分页处理
    const handlePageChange = (newPage: number) => {
        useFileListStore.getState().setPagination({ ...pagination, page: newPage });
    };

    // 文件选择处理
    const handleFileSelect = (fileId: string) => {
        onFileSelect?.(fileId);
    };

    // 格式化日期
    const formatDate = (dateString: string) => {
        try {
            return format(new Date(dateString), 'yyyy-MM-dd HH:mm', { locale: zhCN });
        } catch {
            return dateString;
        }
    };

    if (error) {
        return (
            <Card className={className}>
                <CardContent className="p-6">
                    <div className="text-center text-red-600">
                        <p>加载文件列表失败: {error.message}</p>
                        <Button onClick={() => refetch()} className="mt-2">
                            重试
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    文件列表
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* 筛选器 */}
                <div className="mb-6 space-y-4">
                    <div className="flex flex-wrap gap-4">
                        {/* 状态筛选 */}
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            <select
                                value={localFilters.status}
                                onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value })}
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">全部状态</option>
                                <option value="pending">等待中</option>
                                <option value="processing">处理中</option>
                                <option value="completed">已完成</option>
                                <option value="failed">失败</option>
                            </select>
                        </div>

                        {/* 日期筛选 */}
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <input
                                type="date"
                                value={localFilters.startDate}
                                onChange={(e) => setLocalFilters({ ...localFilters, startDate: e.target.value })}
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="开始日期"
                            />
                            <span className="text-gray-500">至</span>
                            <input
                                type="date"
                                value={localFilters.endDate}
                                onChange={(e) => setLocalFilters({ ...localFilters, endDate: e.target.value })}
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="结束日期"
                            />
                        </div>
                    </div>

                    {/* 筛选按钮 */}
                    <div className="flex gap-2">
                        <Button onClick={applyFilters} size="sm">
                            应用筛选
                        </Button>
                        <Button onClick={resetFilters} variant="outline" size="sm">
                            重置
                        </Button>
                    </div>
                </div>

                {/* 文件列表 */}
                {isLoading ? (
                    <div className="text-center py-12">
                        <div className="relative inline-block">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-300 animate-spin [animation-duration:1.5s] [animation-direction:reverse]"></div>
                        </div>
                        <p className="mt-4 text-gray-600 animate-pulse">加载中...</p>
                        <div className="flex justify-center mt-2 space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                ) : !data?.files.length ? (
                    <div className="text-center py-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        <div className="relative inline-block mb-4">
                            <FileText className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600" />
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full animate-ping"></div>
                        </div>
                        <p className="text-gray-500 text-lg font-medium">暂无文件记录</p>
                        <p className="text-gray-400 text-sm mt-2">上传您的第一个文件开始数据清洗</p>
                    </div>
                ) : (
                    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        {data.files.map((file, index) => (
                            <div
                                key={file.id}
                                className="group border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-950/20 dark:hover:to-indigo-950/20 transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.01] hover:border-blue-300 dark:hover:border-blue-600"
                                onClick={() => handleFileSelect(file.id)}
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors duration-300">
                                                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-900 dark:group-hover:text-blue-100 transition-colors duration-300">
                                                {file.originalFileName}
                                            </h3>
                                            <Badge
                                                variant={statusConfig[file.status].variant}
                                                className={cn(
                                                    statusConfig[file.status].color,
                                                    "transition-all duration-300 group-hover:scale-105"
                                                )}
                                            >
                                                {statusConfig[file.status].label}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-300">
                                            <span>大小: {formatFileSize(file.fileSize)}</span>
                                            <span>上传时间: {formatDate(file.uploadedAt)}</span>
                                            {file.totalRows && (
                                                <span>总行数: {file.totalRows.toLocaleString()}</span>
                                            )}
                                            {file.completedAt && (
                                                <span>完成时间: {formatDate(file.completedAt)}</span>
                                            )}
                                        </div>
                                        {file.status === 'completed' && file.cleanedRows !== null && file.exceptionRows !== null && (
                                            <div className="flex items-center gap-4 text-sm mt-2">
                                                <div className="flex items-center gap-1">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                    <span className="text-green-600 dark:text-green-400 font-medium">
                                                        清洁数据: {(file.cleanedRows ?? 0).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                                    <span className="text-orange-600 dark:text-orange-400 font-medium">
                                                        异常数据: {(file.exceptionRows ?? 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="ml-4 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-105"
                                    >
                                        <Eye className="h-4 w-4 mr-1" />
                                        查看详情
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 分页 */}
                {data && data.total > 0 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                            显示 {((pagination.page - 1) * pagination.pageSize) + 1} - {Math.min(pagination.page * pagination.pageSize, data.total)} 条，
                            共 {data.total} 条记录
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page <= 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                上一页
                            </Button>
                            <span className="text-sm text-gray-600">
                                第 {pagination.page} 页，共 {Math.ceil(data.total / pagination.pageSize)} 页
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page >= Math.ceil(data.total / pagination.pageSize)}
                            >
                                下一页
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
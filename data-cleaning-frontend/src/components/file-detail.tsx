/**
 * 文件详情页面组件
 * 显示文件详细信息和处理统计，根据文件状态显示不同内容
 */

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
    FileText,
    Calendar,
    Database,
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
    ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { DownloadManager } from './download-manager';
import { useFileDetail } from '../hooks/use-file-detail';
import { formatFileSize } from '../lib/file-utils';
import { cn } from '../lib/utils';
import type { FileStatus } from '../types';

interface FileDetailProps {
    fileId: string;
    onBack?: () => void;
    className?: string;
}

// 状态配置
const statusConfig = {
    pending: {
        label: '等待处理',
        icon: Clock,
        color: 'bg-gray-100 text-gray-800',
        description: '文件已上传，等待系统处理'
    },
    processing: {
        label: '处理中',
        icon: Clock,
        color: 'bg-blue-100 text-blue-800',
        description: '系统正在处理您的文件，请耐心等待'
    },
    completed: {
        label: '处理完成',
        icon: CheckCircle,
        color: 'bg-green-100 text-green-800',
        description: '文件处理完成，您可以下载处理结果'
    },
    failed: {
        label: '处理失败',
        icon: XCircle,
        color: 'bg-red-100 text-red-800',
        description: '文件处理过程中出现错误'
    },
};

export function FileDetail({
    fileId,
    onBack,
    className
}: FileDetailProps) {
    const { data, isLoading, error, refetch } = useFileDetail({ fileId });

    // 格式化日期
    const formatDate = (dateString: string) => {
        try {
            return format(new Date(dateString), 'yyyy年MM月dd日 HH:mm:ss', { locale: zhCN });
        } catch {
            return dateString;
        }
    };

    // 格式化处理时间
    const formatProcessingTime = (milliseconds: number) => {
        if (milliseconds < 1000) {
            // 小于1秒时，显示毫秒
            return `${milliseconds}毫秒`;
        }

        const seconds = milliseconds / 1000;
        if (seconds < 60) {
            // 小于1分钟时，显示秒（保留1位小数）
            return `${seconds.toFixed(1)}秒`;
        } else if (seconds < 3600) {
            // 小于1小时时，显示分钟和秒
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.floor(seconds % 60);
            return `${minutes}分${remainingSeconds}秒`;
        } else {
            // 大于1小时时，显示小时和分钟
            const hours = Math.floor(seconds / 3600);
            const remainingMinutes = Math.floor((seconds % 3600) / 60);
            return `${hours}小时${remainingMinutes}分`;
        }
    };

    // 计算处理成功率
    const getSuccessRate = (cleanedRows: number, totalRows: number) => {
        if (totalRows === 0) return 0;
        return Math.round((cleanedRows / totalRows) * 100);
    };

    if (isLoading) {
        return (
            <Card className={cn("border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm", className)}>
                <CardContent className="p-8">
                    <div className="text-center py-12 animate-in fade-in-0 zoom-in-50 duration-1000">
                        <div className="relative inline-block">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-300 animate-spin [animation-duration:1.5s] [animation-direction:reverse]"></div>
                        </div>
                        <p className="mt-4 text-gray-600 dark:text-gray-400 animate-pulse">加载文件详情中...</p>
                        <div className="flex justify-center mt-2 space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className={className}>
                <CardContent className="p-6">
                    <div className="text-center text-red-600">
                        <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                        <p className="text-lg font-medium mb-2">加载失败</p>
                        <p className="text-sm mb-4">{error.message}</p>
                        <div className="flex gap-2 justify-center">
                            <Button onClick={() => refetch()}>
                                重试
                            </Button>
                            {onBack && (
                                <Button variant="outline" onClick={onBack}>
                                    返回列表
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!data?.file) {
        return (
            <Card className={className}>
                <CardContent className="p-6">
                    <div className="text-center text-gray-500">
                        <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>文件不存在</p>
                        {onBack && (
                            <Button variant="outline" onClick={onBack} className="mt-4">
                                返回列表
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { file, statistics } = data;
    const statusInfo = statusConfig[file.status as FileStatus];
    const StatusIcon = statusInfo.icon;

    return (
        <div className={className}>
            {/* 返回按钮 */}
            {onBack && (
                <Button variant="ghost" onClick={onBack} className="mb-4">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    返回列表
                </Button>
            )}

            {/* 文件基本信息 */}
            <Card className="mb-6 border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500 animate-in fade-in-0 slide-in-from-bottom-4 duration-1000">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                            <FileText className="h-5 w-5 text-white" />
                        </div>
                        文件详情
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* 文件名和状态 */}
                        <div className="flex items-center justify-between animate-in fade-in-0 slide-in-from-left-4 duration-700 delay-200">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                                {file.originalFileName}
                            </h2>
                            <Badge className={cn(statusInfo.color, "transition-all duration-300 hover:scale-105")}>
                                <StatusIcon className="h-4 w-4 mr-1" />
                                {statusInfo.label}
                            </Badge>
                        </div>

                        {/* 状态描述 */}
                        <p className="text-gray-600 dark:text-gray-400 text-lg animate-in fade-in-0 slide-in-from-right-4 duration-700 delay-400">
                            {statusInfo.description}
                        </p>

                        {/* 文件信息网格 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                            {[
                                {
                                    icon: Database,
                                    label: '文件大小',
                                    value: formatFileSize(file.fileSize),
                                    color: 'from-blue-500 to-blue-600',
                                    delay: 'delay-500'
                                },
                                {
                                    icon: FileText,
                                    label: '文件类型',
                                    value: file.fileType,
                                    color: 'from-green-500 to-green-600',
                                    delay: 'delay-600'
                                },
                                {
                                    icon: Calendar,
                                    label: '上传时间',
                                    value: formatDate(file.uploadedAt),
                                    color: 'from-purple-500 to-purple-600',
                                    delay: 'delay-700'
                                },
                                ...(file.completedAt ? [{
                                    icon: CheckCircle,
                                    label: '完成时间',
                                    value: formatDate(file.completedAt),
                                    color: 'from-emerald-500 to-emerald-600',
                                    delay: 'delay-800'
                                }] : []),
                                ...(file.processingTime ? [{
                                    icon: Clock,
                                    label: '处理时长',
                                    value: formatProcessingTime(file.processingTime),
                                    color: 'from-orange-500 to-orange-600',
                                    delay: 'delay-900'
                                }] : []),
                                ...(file.totalRows ? [{
                                    icon: Database,
                                    label: '总行数',
                                    value: file.totalRows.toLocaleString(),
                                    color: 'from-indigo-500 to-indigo-600',
                                    delay: 'delay-1000'
                                }] : [])
                            ].map((item, index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        "group bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-950/20 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 hover:scale-105 animate-in fade-in-0 slide-in-from-bottom-2 duration-500",
                                        item.delay
                                    )}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={cn("p-2 bg-gradient-to-r rounded-lg group-hover:scale-110 transition-transform duration-300", item.color)}>
                                            <item.icon className="h-5 w-5 text-white" />
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{item.label}</span>
                                    </div>
                                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 处理统计信息 - 仅在完成状态显示 */}
            {file.status === 'completed' && (statistics || (file.cleanedRows !== null && file.exceptionRows !== null)) && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5" />
                            处理统计
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-medium text-green-700">清洁数据</span>
                                </div>
                                <p className="text-2xl font-bold text-green-600">
                                    {(statistics?.cleanedRows ?? file.cleanedRows ?? 0).toLocaleString()}
                                </p>
                                <p className="text-sm text-green-600">
                                    成功率: {getSuccessRate(
                                        statistics?.cleanedRows ?? file.cleanedRows ?? 0,
                                        statistics?.totalRows ?? file.totalRows ?? 0
                                    )}%
                                </p>
                            </div>

                            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="h-4 w-4 text-orange-600" />
                                    <span className="text-sm font-medium text-orange-700">异常数据</span>
                                </div>
                                <p className="text-2xl font-bold text-orange-600">
                                    {(statistics?.exceptionRows ?? file.exceptionRows ?? 0).toLocaleString()}
                                </p>
                                <p className="text-sm text-orange-600">
                                    异常率: {Math.round(((statistics?.exceptionRows ?? file.exceptionRows ?? 0) / (statistics?.totalRows ?? file.totalRows ?? 1)) * 100)}%
                                </p>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Database className="h-4 w-4 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-700">总计</span>
                                </div>
                                <p className="text-2xl font-bold text-blue-600">
                                    {(statistics?.totalRows ?? file.totalRows ?? 0).toLocaleString()}
                                </p>
                                <p className="text-sm text-blue-600">
                                    处理时间: {statistics?.processingTime ? formatProcessingTime(statistics.processingTime) : (file.processingTime ? formatProcessingTime(file.processingTime) : '未知')}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 错误信息 - 仅在失败状态显示 */}
            {file.status === 'failed' && file.errorMessage && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600">
                            <XCircle className="h-5 w-5" />
                            错误信息
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-800">{file.errorMessage}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 下载功能 - 使用 DownloadManager 组件 */}
            <DownloadManager
                jobId={file.jobId}
                status={file.status as 'processing' | 'completed' | 'failed'}
                statistics={statistics}
                cleanedRows={file.cleanedRows}
                exceptionRows={file.exceptionRows}
            />
        </div>
    );
}
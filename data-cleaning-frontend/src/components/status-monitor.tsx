/**
 * 状态监控组件
 * 显示任务处理进度、状态和统计信息
 */

import { useEffect } from 'react';
import { CheckCircle, XCircle, Clock, BarChart3, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useJobStatus } from '../hooks/use-job-status';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface StatusMonitorProps {
    jobId: string;
    className?: string;
    onStatusChange?: (status: 'processing' | 'completed' | 'failed', progress: number, statistics?: {
        totalRows: number;
        cleanedRows: number;
        exceptionRows: number;
        processingTime: number;
    }) => void;
    showStatistics?: boolean;
    autoRefresh?: boolean;
}

export function StatusMonitor({
    jobId,
    className,
    onStatusChange,
    showStatistics = true,
    autoRefresh = true
}: StatusMonitorProps) {
    const {
        data: statusData,
        isLoading,
        isError,
        error,
        refetch,
        startPolling
    } = useJobStatus({
        jobId,
        enabled: !!jobId,
        pollingInterval: 2000,
        stopPollingOnCompleted: true
    });

    // 通知父组件状态变化
    useEffect(() => {
        if (statusData && onStatusChange) {
            onStatusChange(statusData.status, statusData.progress, statusData.statistics);
        }
    }, [statusData]);

    // 自动开始轮询
    useEffect(() => {
        if (autoRefresh && statusData?.status === 'processing') {
            startPolling();
        }
    }, [autoRefresh, statusData?.status, startPolling]);

    // 获取状态图标和颜色
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'processing':
                return (
                    <div className="relative">
                        <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
                    </div>
                );
            case 'completed':
                return (
                    <div className="relative">
                        <CheckCircle className="h-5 w-5 text-green-500 animate-in zoom-in-50 duration-500" />
                        <div className="absolute -inset-1 bg-green-200 rounded-full animate-ping opacity-20"></div>
                    </div>
                );
            case 'failed':
                return (
                    <div className="relative">
                        <XCircle className="h-5 w-5 text-red-500 animate-in zoom-in-50 duration-500" />
                        <div className="absolute -inset-1 bg-red-200 rounded-full animate-pulse opacity-30"></div>
                    </div>
                );
            default:
                return <Clock className="h-5 w-5 text-gray-500 animate-pulse" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const baseClasses = "transition-all duration-300 animate-in fade-in-0 slide-in-from-right-2";
        switch (status) {
            case 'processing':
                return (
                    <Badge variant="secondary" className={cn("bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", baseClasses)}>
                        <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span>处理中</span>
                        </div>
                    </Badge>
                );
            case 'completed':
                return (
                    <Badge variant="secondary" className={cn("bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", baseClasses)}>
                        <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>已完成</span>
                        </div>
                    </Badge>
                );
            case 'failed':
                return (
                    <Badge variant="destructive" className={baseClasses}>
                        <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-red-300 rounded-full animate-pulse"></div>
                            <span>处理失败</span>
                        </div>
                    </Badge>
                );
            default:
                return <Badge variant="outline" className={baseClasses}>未知状态</Badge>;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'processing':
                return '正在处理数据...';
            case 'completed':
                return '数据处理完成！';
            case 'failed':
                return '数据处理失败';
            default:
                return '状态未知';
        }
    };

    // 加载状态
    if (isLoading) {
        return (
            <Card className={cn('w-full', className)}>
                <CardContent className="p-6">
                    <div className="flex items-center justify-center space-x-2">
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span>正在获取任务状态...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // 错误状态
    if (isError) {
        return (
            <Card className={cn('w-full', className)}>
                <CardContent className="p-6">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            获取任务状态失败：{error?.message || '未知错误'}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => refetch()}
                                className="ml-2"
                            >
                                重试
                            </Button>
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    // 无数据状态
    if (!statusData) {
        return (
            <Card className={cn('w-full', className)}>
                <CardContent className="p-6">
                    <div className="text-center text-muted-foreground">
                        未找到任务信息
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { status, progress, statistics } = statusData;

    return (
        <div className={cn('w-full space-y-4', className)}>
            {/* 主状态卡片 */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center space-x-2">
                            {getStatusIcon(status)}
                            <span>任务状态</span>
                        </CardTitle>
                        {getStatusBadge(status)}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{getStatusText(status)}</span>
                            <span className="text-sm text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                                {progress}%
                            </span>
                        </div>
                        <div className="relative">
                            <Progress value={progress} className="w-full h-3 transition-all duration-500" />
                            {status === 'processing' && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse rounded-full"></div>
                            )}
                        </div>
                    </div>

                    {/* 任务ID */}
                    <div className="text-xs text-muted-foreground">
                        任务ID: {jobId}
                    </div>

                    {/* 控制按钮 */}
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            disabled={isLoading}
                            className="transition-all duration-300 hover:scale-105 hover:shadow-md"
                        >
                            <RefreshCw className={cn("h-4 w-4 mr-1 transition-transform duration-300", isLoading && "animate-spin")} />
                            刷新状态
                        </Button>

                        {status === 'processing' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={startPolling}
                                className="transition-all duration-300 hover:scale-105 hover:shadow-md hover:bg-blue-50 dark:hover:bg-blue-950/20"
                            >
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                    <span>开始自动刷新</span>
                                </div>
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* 统计信息卡片 */}
            {showStatistics && statistics && (
                <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 delay-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center space-x-2">
                            <div className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <span>处理统计</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                {
                                    value: statistics.totalRows.toLocaleString(),
                                    label: '总行数',
                                    color: 'text-blue-600 dark:text-blue-400',
                                    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
                                    delay: 'delay-300'
                                },
                                {
                                    value: statistics.cleanedRows.toLocaleString(),
                                    label: '清洁行数',
                                    color: 'text-green-600 dark:text-green-400',
                                    bgColor: 'bg-green-100 dark:bg-green-900/30',
                                    delay: 'delay-500'
                                },
                                {
                                    value: statistics.exceptionRows.toLocaleString(),
                                    label: '异常行数',
                                    color: 'text-orange-600 dark:text-orange-400',
                                    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
                                    delay: 'delay-700'
                                },
                                {
                                    value: statistics.processingTime < 1000
                                        ? `${statistics.processingTime}毫秒`
                                        : `${(statistics.processingTime / 1000).toFixed(1)}秒`,
                                    label: '处理时间',
                                    color: 'text-purple-600 dark:text-purple-400',
                                    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
                                    delay: 'delay-1000'
                                }
                            ].map((stat, index) => (
                                <div key={index} className={cn("text-center p-3 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-md animate-in fade-in-0 slide-in-from-bottom-2", stat.bgColor, stat.delay)}>
                                    <div className={cn("text-2xl font-bold", stat.color)}>
                                        {stat.value}
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* 处理成功率 */}
                        <div className="mt-6 pt-4 border-t animate-in fade-in-0 slide-in-from-bottom-2 delay-1200">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"></div>
                                    <span>数据清洁率</span>
                                </span>
                                <span className="text-sm text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                                    {((statistics.cleanedRows / statistics.totalRows) * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="relative">
                                <Progress
                                    value={(statistics.cleanedRows / statistics.totalRows) * 100}
                                    className="w-full h-3 transition-all duration-1000"
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse rounded-full"></div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 处理失败时显示错误信息 */}
            {status === 'failed' && (
                <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                        数据处理过程中发生错误，请检查文件格式或联系技术支持。
                    </AlertDescription>
                </Alert>
            )}

            {/* 处理完成时的提示 */}
            {status === 'completed' && (
                <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                        数据处理已完成！您可以下载清洁后的数据文件。
                        {statistics && statistics.exceptionRows > 0 && (
                            <span className="block mt-1">
                                发现 {statistics.exceptionRows} 行异常数据，建议同时下载异常数据文件进行检查。
                            </span>
                        )}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
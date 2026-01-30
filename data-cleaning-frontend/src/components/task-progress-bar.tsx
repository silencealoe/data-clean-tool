/**
 * 任务进度条组件
 * 显示数据处理任务的实时进度信息
 */

import { Clock, Database, Zap, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { useTaskProgress } from '../hooks/use-task-progress';
import { cn } from '../lib/utils';

interface TaskProgressBarProps {
    taskId: string;
    className?: string;
    onComplete?: () => void;
    onError?: (error: string) => void;
}

export function TaskProgressBar({
    taskId,
    className,
    onComplete,
    onError
}: TaskProgressBarProps) {
    const { data: progress, isLoading, error, formatEstimatedTime, formatPhase } = useTaskProgress({
        taskId,
        enabled: !!taskId,
        refetchInterval: 2000
    });

    // 当任务完成时调用回调
    if (progress?.status === 'completed' && onComplete) {
        onComplete();
    }

    // 当任务失败时调用回调
    if (progress?.status === 'failed' && onError) {
        onError('任务处理失败');
    }

    if (isLoading) {
        return (
            <Card className={cn("border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm", className)}>
                <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600"></div>
                        <span className="text-gray-600 dark:text-gray-400">加载进度信息...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className={cn("border-red-200 bg-red-50 dark:bg-red-950/20", className)}>
                <CardContent className="p-6">
                    <div className="flex items-center gap-3 text-red-600">
                        <AlertCircle className="h-5 w-5" />
                        <span>无法获取进度信息</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!progress) {
        return null;
    }

    // 状态配置
    const statusConfig = {
        pending: {
            label: '等待处理',
            icon: Clock,
            color: 'bg-gray-100 text-gray-800',
            bgColor: 'bg-gray-50 border-gray-200'
        },
        processing: {
            label: '处理中',
            icon: Zap,
            color: 'bg-blue-100 text-blue-800',
            bgColor: 'bg-blue-50 border-blue-200'
        },
        completed: {
            label: '处理完成',
            icon: CheckCircle,
            color: 'bg-green-100 text-green-800',
            bgColor: 'bg-green-50 border-green-200'
        },
        failed: {
            label: '处理失败',
            icon: XCircle,
            color: 'bg-red-100 text-red-800',
            bgColor: 'bg-red-50 border-red-200'
        },
    };

    const statusInfo = statusConfig[progress.status] || statusConfig.processing; // 默认使用processing状态
    const StatusIcon = statusInfo.icon;

    return (
        <Card className={cn("border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-lg transition-all duration-300", className)}>
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                            <Database className="h-5 w-5 text-white" />
                        </div>
                        <span>处理进度</span>
                    </div>
                    <Badge className={cn(statusInfo.color, "transition-all duration-300")}>
                        <StatusIcon className="h-4 w-4 mr-1" />
                        {statusInfo.label}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* 进度条 */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                            {formatPhase(progress.currentPhase)}
                        </span>
                        <span className="font-bold text-lg text-blue-600">
                            {progress.progress}%
                        </span>
                    </div>
                    <Progress
                        value={progress.progress}
                        className="h-3 bg-gray-200 dark:bg-gray-700"
                    />
                </div>

                {/* 统计信息 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Database className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">已处理行数</span>
                        </div>
                        <p className="text-xl font-bold text-blue-600">
                            {progress.processedRows.toLocaleString()}
                        </p>
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                            共 {progress.totalRows.toLocaleString()} 行
                        </p>
                    </div>

                    {progress.estimatedTimeRemaining && progress.status === 'processing' && (
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="h-4 w-4 text-orange-600" />
                                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">预估剩余时间</span>
                            </div>
                            <p className="text-xl font-bold text-orange-600">
                                {formatEstimatedTime(progress.estimatedTimeRemaining)}
                            </p>
                        </div>
                    )}
                </div>

                {/* 任务信息 */}
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    <div>任务ID: {progress.taskId}</div>
                    <div>最后更新: {new Date(progress.lastUpdated).toLocaleString('zh-CN')}</div>
                    {progress.startedAt && (
                        <div>开始时间: {new Date(progress.startedAt).toLocaleString('zh-CN')}</div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
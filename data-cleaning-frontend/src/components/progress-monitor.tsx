/**
 * 进度监控组件
 * 显示并行处理的详细进度信息，包括总体进度和各工作线程进度
 */

import { Activity, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';
import { useProgress } from '../hooks/use-progress';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

interface ProgressMonitorProps {
    jobId: string;
    className?: string;
    enabled?: boolean;
    onProgressUpdate?: (progress: number, processedRows: number, totalRows: number, statistics?: {
        totalRows: number;
        cleanedRows: number;
        exceptionRows: number;
        processingTime: number;
    }) => void;
}

export function ProgressMonitor({
    jobId,
    className,
    enabled = true,
    onProgressUpdate
}: ProgressMonitorProps) {
    const {
        data: progressData,
        isLoading,
        isError
    } = useProgress({
        jobId,
        enabled,
        refetchInterval: enabled ? 2000 : false
    });

    // 通知父组件进度更新
    if (progressData && onProgressUpdate) {
        onProgressUpdate(
            progressData.overallProgress,
            progressData.processedRows,
            progressData.totalRows,
            progressData.statistics  // 传递统计信息
        );
    }

    if (!enabled || !progressData) {
        return null;
    }

    if (isLoading) {
        return (
            <Card className={cn('w-full', className)}>
                <CardContent className="p-6">
                    <div className="flex items-center justify-center space-x-2">
                        <Activity className="h-5 w-5 animate-pulse" />
                        <span>正在获取进度信息...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (isError) {
        return null; // 静默失败，不显示错误
    }

    const { overallProgress, processedRows, totalRows, workerProgress, isProcessing } = progressData;

    return (
        <Card className={cn('w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-500', className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center space-x-2">
                        <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span>处理进度详情</span>
                    </CardTitle>
                    {isProcessing && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                <span>实时更新</span>
                            </div>
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* 总体进度 */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">总体进度</span>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-muted-foreground">
                                {processedRows.toLocaleString()} / {totalRows.toLocaleString()} 行
                            </span>
                            <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                {overallProgress.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                    <div className="relative">
                        <Progress value={overallProgress} className="w-full h-3 transition-all duration-500" />
                        {isProcessing && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse rounded-full"></div>
                        )}
                    </div>
                </div>

                {/* 工作线程进度 */}
                {workerProgress && workerProgress.length > 0 && (
                    <div className="space-y-3 pt-2 border-t">
                        <div className="flex items-center space-x-2 text-sm font-medium">
                            <Cpu className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span>工作线程进度</span>
                            <Badge variant="outline" className="text-xs">
                                {workerProgress.length} 个线程
                            </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {workerProgress.map((worker) => (
                                <div
                                    key={worker.workerId}
                                    className="p-3 rounded-lg bg-muted/50 space-y-2 hover:bg-muted transition-colors duration-200"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            线程 #{worker.workerId}
                                        </span>
                                        <span className="text-xs font-mono bg-background px-2 py-0.5 rounded">
                                            {worker.progress.toFixed(1)}%
                                        </span>
                                    </div>
                                    <Progress
                                        value={worker.progress}
                                        className="h-2"
                                    />
                                    <div className="text-xs text-muted-foreground">
                                        {worker.processedRows.toLocaleString()} / {worker.totalRows.toLocaleString()} 行
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

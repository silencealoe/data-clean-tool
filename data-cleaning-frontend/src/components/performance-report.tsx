/**
 * 性能报告组件
 * 显示已完成任务的完整性能报告
 */

import { BarChart3, TrendingUp, Clock, CheckCircle, XCircle, Cpu, MemoryStick, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { usePerformanceReport } from '../hooks/use-performance-report';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

interface PerformanceReportProps {
    jobId: string;
    className?: string;
    enabled?: boolean;
}

export function PerformanceReport({
    jobId,
    className,
    enabled = true
}: PerformanceReportProps) {
    const {
        data: reportData,
        isLoading,
        isError
    } = usePerformanceReport({
        jobId,
        enabled
    });

    if (!enabled || !reportData) {
        return null;
    }

    if (isLoading) {
        return (
            <Card className={cn('w-full', className)}>
                <CardContent className="p-6">
                    <div className="flex items-center justify-center space-x-2">
                        <BarChart3 className="h-5 w-5 animate-pulse" />
                        <span>正在加载性能报告...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (isError) {
        return null; // 静默失败
    }

    const {
        processingMode,
        workerCount,
        avgCpuUsage,
        peakCpuUsage,
        avgMemoryUsage,
        peakMemoryUsage,
        avgThroughput,
        peakThroughput,
        processingTimeMs,
        totalRows,
        successCount,
        errorCount
    } = reportData;

    const successRate = (successCount / totalRows) * 100;
    const processingTimeSec = processingTimeMs / 1000;

    return (
        <Card className={cn('w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-300', className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center space-x-2">
                        <div className="p-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                            <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span>性能报告</span>
                    </CardTitle>
                    <Badge variant="outline" className="capitalize">
                        {processingMode === 'parallel' ? '并行处理' : '顺序处理'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* 处理概览 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {totalRows.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">总行数</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400 flex items-center justify-center space-x-1">
                            <CheckCircle className="h-5 w-5" />
                            <span>{successCount.toLocaleString()}</span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">成功</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400 flex items-center justify-center space-x-1">
                            <XCircle className="h-5 w-5" />
                            <span>{errorCount.toLocaleString()}</span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">错误</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 flex items-center justify-center space-x-1">
                            <Clock className="h-5 w-5" />
                            <span>{processingTimeSec.toFixed(1)}s</span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">处理时间</div>
                    </div>
                </div>

                {/* 成功率 */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium flex items-center space-x-2">
                            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span>成功率</span>
                        </span>
                        <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            {successRate.toFixed(2)}%
                        </span>
                    </div>
                    <Progress value={successRate} className="h-3" />
                </div>

                {/* 性能指标 */}
                {processingMode === 'parallel' && (
                    <div className="space-y-4 pt-4 border-t">
                        <div className="text-sm font-medium">性能指标</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* CPU 使用率 */}
                            <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center space-x-2">
                                    <Cpu className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-xs font-medium">CPU 使用率</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">平均</span>
                                        <span className="font-mono">{avgCpuUsage.toFixed(1)}%</span>
                                    </div>
                                    <Progress value={avgCpuUsage} className="h-2" />
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">峰值</span>
                                        <span className="font-mono">{peakCpuUsage.toFixed(1)}%</span>
                                    </div>
                                    <Progress value={peakCpuUsage} className="h-2" />
                                </div>
                            </div>

                            {/* 内存使用 */}
                            <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center space-x-2">
                                    <MemoryStick className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                    <span className="text-xs font-medium">内存使用</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">平均</span>
                                        <span className="font-mono">{avgMemoryUsage.toFixed(0)}MB</span>
                                    </div>
                                    <Progress value={(avgMemoryUsage / 2048) * 100} className="h-2" />
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">峰值</span>
                                        <span className="font-mono">{peakMemoryUsage.toFixed(0)}MB</span>
                                    </div>
                                    <Progress value={(peakMemoryUsage / 2048) * 100} className="h-2" />
                                </div>
                            </div>

                            {/* 吞吐量 */}
                            <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center space-x-2">
                                    <Zap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                    <span className="text-xs font-medium">吞吐量</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">平均</span>
                                        <span className="font-mono">{avgThroughput.toLocaleString()} 行/秒</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">峰值</span>
                                        <span className="font-mono">{peakThroughput.toLocaleString()} 行/秒</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-2 border-t">
                                        <span className="text-muted-foreground">工作线程</span>
                                        <span className="font-mono">{workerCount} 个</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

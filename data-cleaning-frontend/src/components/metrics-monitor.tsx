/**
 * 性能指标监控组件
 * 实时显示CPU、内存、吞吐量等性能指标
 */

import { Gauge, Cpu, MemoryStick, Zap, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { useMetrics } from '../hooks/use-metrics';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

interface MetricsMonitorProps {
    jobId: string;
    className?: string;
    enabled?: boolean;
}

export function MetricsMonitor({
    jobId,
    className,
    enabled = true
}: MetricsMonitorProps) {
    const {
        data: metricsData,
        isLoading,
        isError
    } = useMetrics({
        jobId,
        enabled,
        refetchInterval: enabled ? 2000 : false
    });

    if (!enabled || !metricsData) {
        return null;
    }

    if (isLoading) {
        return (
            <Card className={cn('w-full', className)}>
                <CardContent className="p-6">
                    <div className="flex items-center justify-center space-x-2">
                        <Gauge className="h-5 w-5 animate-pulse" />
                        <span>正在获取性能指标...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (isError) {
        return null; // 静默失败
    }

    const { cpuUsage, memoryUsage, throughput, workerCount, isProcessing, timestamp } = metricsData;

    // 格式化时间戳
    const formattedTime = new Date(timestamp).toLocaleTimeString('zh-CN');

    return (
        <Card className={cn('w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-200', className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center space-x-2">
                        <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                            <Gauge className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span>性能指标</span>
                    </CardTitle>
                    {isProcessing && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                            <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span>实时监控</span>
                            </div>
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* 指标网格 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* CPU 使用率 */}
                    <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                            <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded">
                                <Cpu className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">CPU</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {cpuUsage.toFixed(1)}%
                        </div>
                        <Progress value={cpuUsage} className="h-2" />
                    </div>

                    {/* 内存使用 */}
                    <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                            <div className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded">
                                <MemoryStick className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">内存</span>
                        </div>
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {memoryUsage.toFixed(0)}MB
                        </div>
                        <Progress value={(memoryUsage / 2048) * 100} className="h-2" />
                    </div>

                    {/* 吞吐量 */}
                    <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                            <div className="p-1 bg-orange-100 dark:bg-orange-900/30 rounded">
                                <Zap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">吞吐量</span>
                        </div>
                        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {throughput.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">行/秒</div>
                    </div>

                    {/* 工作线程数 */}
                    <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                            <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded">
                                <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">线程数</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {workerCount}
                        </div>
                        <div className="text-xs text-muted-foreground">个工作线程</div>
                    </div>
                </div>

                {/* 更新时间 */}
                <div className="pt-2 border-t text-xs text-muted-foreground text-center">
                    最后更新: {formattedTime}
                </div>
            </CardContent>
        </Card>
    );
}

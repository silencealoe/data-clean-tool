import { useState } from 'react';
import { FileUpload } from '@/components/file-upload';
import { DownloadManager } from '@/components/download-manager';
import { ProgressMonitor } from '@/components/progress-monitor';
import { MetricsMonitor } from '@/components/metrics-monitor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * 文件上传页面
 */
export function UploadPage() {
    const navigate = useNavigate();
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<{
        jobId: string;
        fileId: string;
        fileName: string;
        totalRows: number;
    } | null>(null);
    const [currentStatus, setCurrentStatus] = useState<'processing' | 'completed' | 'failed' | null>(null);
    const [currentStatistics, setCurrentStatistics] = useState<{
        totalRows: number;
        cleanedRows: number;
        exceptionRows: number;
        processingTime: number;
    } | null>(null);

    const handleUploadSuccess = (data: {
        jobId: string;
        fileId: string;
        fileName: string;
        totalRows: number;
    }) => {
        setCurrentJobId(data.jobId);
        setUploadedFile(data);
        setCurrentStatus('processing'); // 设置为处理中
        setCurrentStatistics(null); // 重置统计信息
    };

    const handleUploadError = (error: string) => {
        console.error('Upload error:', error);
        setCurrentJobId(null);
        setUploadedFile(null);
        setCurrentStatus(null);
        setCurrentStatistics(null);
    };

    const handleProgressUpdate = (progress: number, _processedRows: number, totalRows: number, statistics?: {
        totalRows: number;
        cleanedRows: number;
        exceptionRows: number;
        processingTime: number;
    }) => {
        // 更新总行数
        if (uploadedFile && totalRows > 0 && uploadedFile.totalRows !== totalRows) {
            setUploadedFile(prev => prev ? {
                ...prev,
                totalRows: totalRows
            } : null);
        }

        // 如果进度达到100%，更新状态为完成
        if (progress >= 100 && currentStatus !== 'completed') {
            setCurrentStatus('completed');
            // 如果有统计信息，保存它
            if (statistics) {
                setCurrentStatistics(statistics);
            }
        }
    };

    const handleGoBack = () => {
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950 transition-colors duration-500">
            <div className="container mx-auto px-4 py-8">
                {/* 头部导航 */}
                <div className="mb-8 animate-in fade-in-0 slide-in-from-top-4 duration-1000">
                    <Button
                        variant="ghost"
                        onClick={handleGoBack}
                        className="mb-6 transition-all duration-300 hover:scale-105 hover:shadow-md hover:bg-blue-50 dark:hover:bg-blue-950/20"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        返回首页
                    </Button>
                    <div className="text-center">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                            文件上传
                        </h1>
                        <p className="text-lg text-gray-600 dark:text-gray-400">
                            上传Excel或CSV文件开始数据清洗处理
                        </p>
                    </div>
                </div>

                {/* 文件上传区域 */}
                <div className="max-w-4xl mx-auto space-y-8">
                    <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-200 border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-xl">
                                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                                    <ArrowLeft className="h-5 w-5 text-white rotate-90" />
                                </div>
                                选择文件
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FileUpload
                                onUploadSuccess={handleUploadSuccess}
                                onUploadError={handleUploadError}
                            />
                        </CardContent>
                    </Card>

                    {/* 状态监控区域 - 已移除，使用进度监控代替 */}

                    {/* 进度监控 - 显示实时处理进度 */}
                    {currentJobId && (
                        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-500">
                            <ProgressMonitor
                                jobId={currentJobId}
                                enabled={currentStatus === 'processing'}
                                onProgressUpdate={handleProgressUpdate}
                                className="border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500"
                            />
                        </div>
                    )}

                    {/* 性能指标监控 - 实时显示CPU、内存等指标 */}
                    {currentJobId && (
                        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-600">
                            <MetricsMonitor
                                jobId={currentJobId}
                                enabled={currentStatus === 'processing'}
                                className="border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500"
                            />
                        </div>
                    )}

                    {/* 上传文件信息 */}
                    {uploadedFile && (
                        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-700 border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3 text-xl">
                                    <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                                        <ArrowLeft className="h-5 w-5 text-white rotate-45" />
                                    </div>
                                    文件信息
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[
                                        { label: '文件名', value: uploadedFile.fileName, delay: 'delay-800' },
                                        {
                                            label: '总行数',
                                            value: uploadedFile.totalRows > 0 ? uploadedFile.totalRows.toLocaleString() : '解析中...',
                                            delay: 'delay-900'
                                        },
                                        { label: '任务ID', value: uploadedFile.jobId, mono: true, delay: 'delay-1000' },
                                        { label: '文件ID', value: uploadedFile.fileId, mono: true, delay: 'delay-[1100ms]' }
                                    ].map((item, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-950/20 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-300 hover:scale-105 animate-in fade-in-0 slide-in-from-left-4 duration-500",
                                                item.delay
                                            )}
                                        >
                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                {item.label}
                                            </p>
                                            <p className={cn(
                                                "font-semibold text-gray-900 dark:text-gray-100",
                                                item.mono && "font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded"
                                            )}>
                                                {item.value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* 处理完成统计信息 */}
                    {currentStatus === 'completed' && currentStatistics && (
                        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-800 border-0 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3 text-xl">
                                    <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    处理完成
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {[
                                        {
                                            label: '总行数',
                                            value: currentStatistics.totalRows.toLocaleString(),
                                            color: 'from-blue-500 to-blue-600',
                                            delay: 'delay-900'
                                        },
                                        {
                                            label: '成功处理',
                                            value: currentStatistics.cleanedRows.toLocaleString(),
                                            color: 'from-green-500 to-green-600',
                                            delay: 'delay-1000'
                                        },
                                        {
                                            label: '异常数据',
                                            value: currentStatistics.exceptionRows.toLocaleString(),
                                            color: 'from-orange-500 to-orange-600',
                                            delay: 'delay-[1100ms]'
                                        },
                                        {
                                            label: '处理耗时',
                                            value: `${(currentStatistics.processingTime / 1000).toFixed(2)}秒`,
                                            color: 'from-purple-500 to-purple-600',
                                            delay: 'delay-[1200ms]'
                                        }
                                    ].map((item, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 hover:scale-105 animate-in fade-in-0 slide-in-from-bottom-4 duration-500",
                                                item.delay
                                            )}
                                        >
                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                                                {item.label}
                                            </p>
                                            <p className={cn(
                                                "text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                                                item.color
                                            )}>
                                                {item.value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                {/* 平均速度 */}
                                {currentStatistics.processingTime > 0 && (
                                    <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-[1300ms]">
                                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                            平均处理速度
                                        </p>
                                        <p className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-indigo-600 bg-clip-text text-transparent">
                                            {Math.round(currentStatistics.totalRows / (currentStatistics.processingTime / 1000)).toLocaleString()} 行/秒
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* 下载管理器 - 只在处理完成后显示 */}
                    {currentJobId && currentStatus && (
                        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-[1200ms]">
                            <DownloadManager
                                jobId={currentJobId}
                                status={currentStatus}
                                statistics={currentStatistics || undefined}
                                className="border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
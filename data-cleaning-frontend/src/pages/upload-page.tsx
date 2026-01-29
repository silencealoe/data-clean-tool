import { useState } from 'react';
import { FileUpload } from '@/components/file-upload';
import { DownloadManager } from '@/components/download-manager';
import { ProgressMonitor } from '@/components/progress-monitor';
import { MetricsMonitor } from '@/components/metrics-monitor';
import { AsyncProgressBar } from '@/components/async-progress-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Zap, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAsyncFileUpload } from '@/hooks/use-async-file-upload';
import type { TaskStatusResponse } from '@/types/api';

/**
 * 文件上传页面
 */
export function UploadPage() {
    const navigate = useNavigate();
    const [processingMode, setProcessingMode] = useState<'sync' | 'async'>('sync');
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

    // 异步处理状态
    const [asyncTaskId, setAsyncTaskId] = useState<string | null>(null);
    const [asyncFileInfo, setAsyncFileInfo] = useState<{
        taskId: string;
        fileId: string;
        fileName: string;
    } | null>(null);

    // 异步上传处理
    const {
        uploadFile: uploadFileAsync,
        uploadedFile: asyncUploadedFile,
        processingStatus: asyncProcessingStatus,
        reset: resetAsync,
    } = useAsyncFileUpload({
        onUploadSuccess: (data, file) => {
            setAsyncTaskId(data.taskId);
            setAsyncFileInfo({
                taskId: data.taskId,
                fileId: data.fileId,
                fileName: file.name,
            });
        },
        onProcessingComplete: (status) => {
            if (status.status === 'completed') {
                setCurrentStatus('completed');
                if (status.statistics) {
                    setCurrentStatistics(status.statistics);
                }
            } else if (status.status === 'failed') {
                setCurrentStatus('failed');
            }
        },
    });

    const handleUploadSuccess = (data: {
        jobId: string;
        fileId: string;
        fileName: string;
        totalRows: number;
    }) => {
        if (processingMode === 'sync') {
            setCurrentJobId(data.jobId);
            setUploadedFile(data);
            setCurrentStatus('processing');
            setCurrentStatistics(null);
        }
    };

    const handleUploadError = (error: string) => {
        console.error('Upload error:', error);
        if (processingMode === 'sync') {
            setCurrentJobId(null);
            setUploadedFile(null);
            setCurrentStatus(null);
            setCurrentStatistics(null);
        }
    };

    const handleProgressUpdate = (progress: number, _processedRows: number, totalRows: number, statistics?: {
        totalRows: number;
        cleanedRows: number;
        exceptionRows: number;
        processingTime: number;
    }) => {
        if (processingMode === 'sync') {
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
        }
    };

    const handleGoBack = () => {
        navigate('/');
    };

    const handleModeSwitch = (mode: 'sync' | 'async') => {
        setProcessingMode(mode);
        // 重置状态
        setCurrentJobId(null);
        setUploadedFile(null);
        setCurrentStatus(null);
        setCurrentStatistics(null);
        setAsyncTaskId(null);
        setAsyncFileInfo(null);
        resetAsync();
    };

    const handleAsyncDownload = (status: TaskStatusResponse) => {
        if (status.status === 'completed' && asyncFileInfo) {
            navigate(`/files/${asyncFileInfo.fileId}`);
        }
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
                    {/* 处理模式选择 */}
                    <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-100 border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-xl">
                                <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl">
                                    <Zap className="h-5 w-5 text-white" />
                                </div>
                                处理模式
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div
                                    className={cn(
                                        "p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105",
                                        processingMode === 'sync'
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                                            : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                                    )}
                                    onClick={() => handleModeSwitch('sync')}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-2">
                                            <Clock className="h-5 w-5 text-blue-500" />
                                            <h3 className="font-medium">同步处理</h3>
                                        </div>
                                        {processingMode === 'sync' && (
                                            <Badge variant="default">当前模式</Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        上传后等待处理完成，适合小文件和需要立即查看结果的场景
                                    </p>
                                </div>

                                <div
                                    className={cn(
                                        "p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105",
                                        processingMode === 'async'
                                            ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                                            : "border-gray-200 dark:border-gray-700 hover:border-green-300"
                                    )}
                                    onClick={() => handleModeSwitch('async')}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-2">
                                            <Zap className="h-5 w-5 text-green-500" />
                                            <h3 className="font-medium">异步处理</h3>
                                        </div>
                                        {processingMode === 'async' && (
                                            <Badge variant="success">当前模式</Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        上传后立即返回，后台处理文件，适合大文件和批量处理
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

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
                            {processingMode === 'sync' ? (
                                <FileUpload
                                    onUploadSuccess={handleUploadSuccess}
                                    onUploadError={handleUploadError}
                                />
                            ) : (
                                <div className="text-center p-8">
                                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                                        异步模式下，请使用专用的异步上传页面以获得最佳体验
                                    </p>
                                    <Button
                                        onClick={() => navigate('/upload/async')}
                                        className="transition-all duration-300 hover:scale-105 hover:shadow-md"
                                    >
                                        前往异步上传页面
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 进度监控 - 显示实时处理进度 */}
                    {currentJobId && processingMode === 'sync' && (
                        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-500">
                            <ProgressMonitor
                                jobId={currentJobId}
                                enabled={currentStatus === 'processing'}
                                onProgressUpdate={handleProgressUpdate}
                                className="border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500"
                            />
                        </div>
                    )}

                    {/* 异步进度监控 */}
                    {asyncTaskId && processingMode === 'async' && (
                        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-500 border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3 text-xl">
                                    <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                                        <Zap className="h-5 w-5 text-white" />
                                    </div>
                                    异步处理进度
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <AsyncProgressBar
                                    taskId={asyncTaskId}
                                    onComplete={handleAsyncDownload}
                                    showDownloadButton={true}
                                    showRetryButton={true}
                                    showDetails={true}
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* 性能指标监控 - 实时显示CPU、内存等指标 */}
                    {currentJobId && processingMode === 'sync' && (
                        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-600">
                            <MetricsMonitor
                                jobId={currentJobId}
                                enabled={currentStatus === 'processing'}
                                className="border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500"
                            />
                        </div>
                    )}

                    {/* 上传文件信息 */}
                    {(uploadedFile || asyncFileInfo) && (
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
                                    {processingMode === 'sync' && uploadedFile && (
                                        <>
                                            <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-950/20 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-300 hover:scale-105 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-800">
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">文件名</p>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100">{uploadedFile.fileName}</p>
                                            </div>
                                            <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-950/20 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-300 hover:scale-105 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-900">
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">总行数</p>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {uploadedFile.totalRows > 0 ? uploadedFile.totalRows.toLocaleString() : '解析中...'}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-950/20 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-300 hover:scale-105 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-1000">
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">任务ID</p>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100 font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                                    {uploadedFile.jobId}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-950/20 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-300 hover:scale-105 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-[1100ms]">
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">文件ID</p>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100 font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                                    {uploadedFile.fileId}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                    {processingMode === 'async' && asyncFileInfo && (
                                        <>
                                            <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-950/20 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-300 hover:scale-105 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-800">
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">文件名</p>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100">{asyncFileInfo.fileName}</p>
                                            </div>
                                            <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-950/20 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-300 hover:scale-105 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-900">
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">任务ID</p>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100 font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                                    {asyncFileInfo.taskId}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-950/20 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-300 hover:scale-105 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-1000">
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">文件ID</p>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100 font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                                    {asyncFileInfo.fileId}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-950/20 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-300 hover:scale-105 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-[1100ms]">
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">处理状态</p>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {asyncProcessingStatus?.status || '等待中'}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* 处理完成统计信息 */}
                    {currentStatus === 'completed' && currentStatistics && processingMode === 'sync' && (
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
                    {currentJobId && currentStatus && processingMode === 'sync' && (
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
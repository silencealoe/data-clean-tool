import { useState } from 'react';
import { FileUpload } from '@/components/file-upload';
import { StatusMonitor } from '@/components/status-monitor';
import { DownloadManager } from '@/components/download-manager';
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
        setCurrentStatus(null);
        setCurrentStatistics(null); // 重置统计信息
    };

    const handleUploadError = (error: string) => {
        console.error('Upload error:', error);
        setCurrentJobId(null);
        setUploadedFile(null);
        setCurrentStatus(null);
        setCurrentStatistics(null);
    };

    const handleStatusChange = (status: 'processing' | 'completed' | 'failed', progress: number, statistics?: {
        totalRows: number;
        cleanedRows: number;
        exceptionRows: number;
        processingTime: number;
    }) => {
        console.log('Status changed:', status, progress, statistics);

        // 更新状态
        setCurrentStatus(status);

        // 更新统计信息
        if (statistics) {
            setCurrentStatistics(statistics);

            // 如果有上传文件信息，更新总行数
            if (uploadedFile && statistics.totalRows > 0) {
                setUploadedFile(prev => prev ? {
                    ...prev,
                    totalRows: statistics.totalRows
                } : null);
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

                    {/* 状态监控区域 */}
                    {currentJobId && (
                        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-400">
                            <StatusMonitor
                                jobId={currentJobId}
                                onStatusChange={handleStatusChange}
                                showStatistics={true}
                                autoRefresh={true}
                            />
                        </div>
                    )}

                    {/* 上传文件信息 */}
                    {uploadedFile && (
                        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-600 border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
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
                                        { label: '文件名', value: uploadedFile.fileName, delay: 'delay-700' },
                                        {
                                            label: '总行数',
                                            value: uploadedFile.totalRows > 0 ? uploadedFile.totalRows.toLocaleString() : '解析中...',
                                            delay: 'delay-800'
                                        },
                                        { label: '任务ID', value: uploadedFile.jobId, mono: true, delay: 'delay-900' },
                                        { label: '文件ID', value: uploadedFile.fileId, mono: true, delay: 'delay-1000' }
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

                    {/* 下载管理器 - 只在处理完成后显示 */}
                    {currentJobId && currentStatus && (
                        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-800">
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
/**
 * 组件演示页面
 * 展示文件上传和状态监控组件的使用
 */

import { useState } from 'react';
import { FileUpload } from './file-upload';
import { StatusMonitor } from './status-monitor';
import { DownloadManagerDemo } from './download-manager-demo';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

export function ComponentDemo() {
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [currentView, setCurrentView] = useState<'upload' | 'download'>('upload');
    const [uploadedFile, setUploadedFile] = useState<{
        jobId: string;
        fileId: string;
        fileName: string;
        totalRows: number;
    } | null>(null);

    const handleUploadSuccess = (data: {
        jobId: string;
        fileId: string;
        fileName: string;
        totalRows: number;
    }) => {
        setCurrentJobId(data.jobId);
        setUploadedFile(data);
    };

    const handleUploadError = (error: string) => {
        console.error('Upload error:', error);
        setCurrentJobId(null);
        setUploadedFile(null);
    };

    const handleStatusChange = (status: 'processing' | 'completed' | 'failed', progress: number) => {
        console.log('Status changed:', status, progress);
    };

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold mb-2">数据清洗服务</h1>
                <p className="text-muted-foreground">专业的Excel数据清洗和标准化服务</p>
            </div>

            {/* 视图切换 */}
            <div className="flex justify-center gap-2">
                <Button
                    variant={currentView === 'upload' ? 'default' : 'outline'}
                    onClick={() => setCurrentView('upload')}
                >
                    文件上传演示
                </Button>
                <Button
                    variant={currentView === 'download' ? 'default' : 'outline'}
                    onClick={() => setCurrentView('download')}
                >
                    下载管理演示
                </Button>
            </div>

            {currentView === 'upload' && (
                <>
                    {/* 文件上传区域 */}
                    <Card>
                        <CardHeader>
                            <CardTitle>文件上传</CardTitle>
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
                        <Card>
                            <CardHeader>
                                <CardTitle>处理状态监控</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <StatusMonitor
                                    jobId={currentJobId}
                                    onStatusChange={handleStatusChange}
                                    showStatistics={true}
                                    autoRefresh={true}
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* 上传文件信息 */}
                    {uploadedFile && (
                        <Card>
                            <CardHeader>
                                <CardTitle>文件信息</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <p><strong>文件名:</strong> {uploadedFile.fileName}</p>
                                    <p><strong>任务ID:</strong> {uploadedFile.jobId}</p>
                                    <p><strong>文件ID:</strong> {uploadedFile.fileId}</p>
                                    <p><strong>总行数:</strong> {uploadedFile.totalRows.toLocaleString()}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {currentView === 'download' && <DownloadManagerDemo />}
        </div>
    );
}
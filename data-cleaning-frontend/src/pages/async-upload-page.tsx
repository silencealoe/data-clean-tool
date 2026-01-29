/**
 * 异步文件上传页面
 * 支持异步队列处理和实时进度监控
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileSpreadsheet, X, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AsyncProgressBar } from '@/components/async-progress-bar';
import { cn } from '@/lib/utils';
import { validateFile, formatFileSize } from '@/lib/file-utils';
import { useAsyncFileUpload } from '@/hooks/use-async-file-upload';
import type { TaskStatusResponse } from '@/types/api';

export function AsyncUploadPage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // 异步上传和处理状态
  const {
    isUploading,
    uploadProgress,
    uploadError,
    uploadedFile,
    isProcessing,
    processingStatus,
    processingError,
    isPolling,
    uploadFile,
    refreshStatus,
    reset,
  } = useAsyncFileUpload({
    onUploadSuccess: (data, file) => {
      console.log('Upload successful:', data);
    },
    onUploadError: (error, file) => {
      console.error('Upload failed:', error);
    },
    onProgressUpdate: (status) => {
      console.log('Processing progress:', status);
    },
    onProcessingComplete: (status) => {
      console.log('Processing complete:', status);
    },
    onProcessingError: (error) => {
      console.error('Processing error:', error);
    },
  });

  // 处理文件选择
  const handleFileSelect = useCallback((file: File) => {
    setValidationError(null);

    // 验证文件
    const validation = validateFile(file);
    if (!validation.isValid) {
      setValidationError(validation.error || '文件验证失败');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }, []);

  // 处理文件拖拽
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // 处理文件输入变化
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // 开始上传
  const handleUpload = useCallback(() => {
    if (selectedFile && !isUploading) {
      uploadFile(selectedFile);
    }
  }, [selectedFile, isUploading, uploadFile]);

  // 清除选择的文件
  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
  }, []);

  // 重新开始
  const handleStartOver = useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    reset();
  }, [reset]);

  // 返回首页
  const handleGoBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // 处理下载
  const handleDownload = useCallback((status: TaskStatusResponse) => {
    if (status.status === 'completed' && uploadedFile) {
      // 这里应该触发下载逻辑
      console.log('Download triggered for task:', uploadedFile.taskId);
      // 可以导航到下载页面或直接下载文件
      navigate(`/files/${uploadedFile.fileId}`);
    }
  }, [uploadedFile, navigate]);

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
              异步文件处理
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              上传文件后可立即进行其他操作，系统将在后台处理您的文件
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* 文件上传区域 */}
          <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-200 border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                文件上传
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* 上传进行中状态 */}
              {isUploading && (
                <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                  <div className="text-center">
                    <div className="relative inline-block">
                      <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-blue-500 animate-pulse" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full animate-ping"></div>
                    </div>
                    <h3 className="text-lg font-medium">正在上传文件...</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedFile?.name}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="w-full h-2 transition-all duration-300" />
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        {uploadProgress}% 完成
                      </p>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 文件已选择但未上传状态 */}
              {selectedFile && !isUploading && !uploadedFile && (
                <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                  <div className="border rounded-xl p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800 transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <FileSpreadsheet className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-green-900 dark:text-green-100">{selectedFile.name}</p>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearFile}
                        className="hover:bg-red-100 hover:text-red-600 transition-colors duration-200"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button onClick={handleUpload} className="w-full transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
                    开始上传
                  </Button>
                </div>
              )}

              {/* 文件选择区域 */}
              {!selectedFile && !isUploading && !uploadedFile && (
                <div
                  className={cn(
                    'border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ease-in-out transform hover:scale-[1.02] hover:shadow-lg',
                    isDragOver
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 scale-[1.02] shadow-lg'
                      : 'border-muted-foreground/25 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/10'
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className={cn(
                    "transition-all duration-300 ease-in-out",
                    isDragOver ? "scale-110" : "scale-100"
                  )}>
                    <Upload className={cn(
                      "h-12 w-12 mx-auto mb-4 transition-colors duration-300",
                      isDragOver ? "text-blue-500" : "text-muted-foreground"
                    )} />
                  </div>
                  <h3 className="text-lg font-medium mb-2 transition-colors duration-300">上传数据文件</h3>
                  <p className="text-sm text-muted-foreground mb-4 transition-colors duration-300">
                    拖拽文件到此处，或点击选择文件
                  </p>
                  <p className="text-xs text-muted-foreground mb-6 transition-colors duration-300">
                    支持 .xlsx、.xls 和 .csv 格式，文件大小不超过 500MB
                  </p>

                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="async-file-upload"
                  />
                  <Button asChild className="transition-all duration-300 hover:scale-105 hover:shadow-md">
                    <label htmlFor="async-file-upload" className="cursor-pointer">
                      选择文件
                    </label>
                  </Button>
                </div>
              )}

              {/* 验证错误显示 */}
              {validationError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              {/* 上传错误显示 */}
              {uploadError && !isUploading && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* 异步进度监控 */}
          {uploadedFile && (
            <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-400 border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                    <FileSpreadsheet className="h-5 w-5 text-white" />
                  </div>
                  处理进度
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AsyncProgressBar
                  taskId={uploadedFile.taskId}
                  onComplete={handleDownload}
                  onRetry={handleStartOver}
                  showDownloadButton={true}
                  showRetryButton={true}
                  showDetails={true}
                />
              </CardContent>
            </Card>
          )}

          {/* 文件信息 */}
          {uploadedFile && (
            <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-600 border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                    <FileSpreadsheet className="h-5 w-5 text-white" />
                  </div>
                  文件信息
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { label: '文件名', value: uploadedFile.fileName, delay: 'delay-700' },
                    { label: '任务ID', value: uploadedFile.taskId, mono: true, delay: 'delay-800' },
                    { label: '文件ID', value: uploadedFile.fileId, mono: true, delay: 'delay-900' },
                    { 
                      label: '处理状态', 
                      value: processingStatus?.status || '等待中', 
                      delay: 'delay-1000' 
                    }
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

          {/* 操作按钮 */}
          {uploadedFile && (
            <div className="flex justify-center space-x-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-800">
              <Button
                variant="outline"
                onClick={handleStartOver}
                className="transition-all duration-300 hover:scale-105 hover:shadow-md"
              >
                上传新文件
              </Button>
              <Button
                variant="outline"
                onClick={refreshStatus}
                disabled={isPolling}
                className="transition-all duration-300 hover:scale-105 hover:shadow-md"
              >
                刷新状态
              </Button>
              <Button
                onClick={() => navigate('/files')}
                className="transition-all duration-300 hover:scale-105 hover:shadow-md"
              >
                查看所有文件
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
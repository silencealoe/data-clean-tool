/**
 * 文件上传组件
 * 支持拖拽上传、文件验证和上传进度显示
 */

import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, X, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { validateFile, formatFileSize } from '../lib/file-utils';
import { useFileUpload } from '../hooks/use-file-upload';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';

interface FileUploadProps {
    className?: string;
    onUploadSuccess?: (data: { jobId: string; fileId: string; fileName: string; totalRows: number }) => void;
    onUploadError?: (error: string) => void;
}

export function FileUpload({ className, onUploadSuccess, onUploadError }: FileUploadProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    const { uploadFile, isUploading, progress, error, uploadedFile, resetUpload } = useFileUpload({
        onSuccess: (data, file) => {
            onUploadSuccess?.({
                jobId: data.jobId,
                fileId: data.fileId,
                fileName: file.name,
                totalRows: data.totalRows
            });
        },
        onError: (error) => {
            onUploadError?.(error.message);
        }
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
        resetUpload();
    }, [resetUpload]);

    // 重新选择文件
    const handleSelectAnother = useCallback(() => {
        setSelectedFile(null);
        setValidationError(null);
        resetUpload();
    }, [resetUpload]);

    return (
        <div className={cn('w-full max-w-2xl mx-auto', className)}>
            {/* 上传成功状态 */}
            {uploadedFile && !isUploading && (
                <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                    <Alert className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                        <div className="flex items-center space-x-2">
                            <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                                <FileSpreadsheet className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        </div>
                        <AlertDescription className="text-green-800 dark:text-green-200">
                            <div className="font-medium mb-1">文件 "{uploadedFile.fileName}" 上传成功！</div>
                            <div className="space-y-1 text-sm">
                                <div className="flex items-center space-x-2">
                                    <span className="font-medium">任务ID:</span>
                                    <code className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-xs font-mono">
                                        {uploadedFile.jobId}
                                    </code>
                                </div>
                                <div className="text-green-700 dark:text-green-300">
                                    文件正在处理中，请稍后查看详情页面获取处理结果
                                </div>
                            </div>
                        </AlertDescription>
                    </Alert>
                    <Button
                        onClick={handleSelectAnother}
                        variant="outline"
                        className="w-full transition-all duration-300 hover:scale-[1.02] hover:shadow-md hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                    >
                        上传另一个文件
                    </Button>
                </div>
            )}

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
                        <Progress value={progress} className="w-full h-2 transition-all duration-300" />
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-muted-foreground">
                                {progress}% 完成 {/* 添加调试信息 */}
                                <span className="text-xs ml-2 text-gray-400">(Debug: {progress})</span>
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
                        id="file-upload"
                    />
                    <Button asChild className="transition-all duration-300 hover:scale-105 hover:shadow-md">
                        <label htmlFor="file-upload" className="cursor-pointer">
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
            {error && !isUploading && (
                <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
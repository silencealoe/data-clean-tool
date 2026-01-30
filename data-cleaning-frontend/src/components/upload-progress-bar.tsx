/**
 * 文件上传进度条组件
 * 专门用于显示文件上传相关的信息和进度
 */

import React from 'react';
import { Progress } from './ui/progress';
import { FileSpreadsheet, Upload, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/file-utils';

export interface UploadProgressBarProps {
    file: File | null;
    progress: number;
    isUploading: boolean;
    isCompleted: boolean;
    error?: string | Error | null;
    className?: string;
    showFileInfo?: boolean;
    showSpeedInfo?: boolean;
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
    file,
    progress,
    isUploading,
    isCompleted,
    error,
    className,
    showFileInfo = true,
    showSpeedInfo = true,
}) => {
    // 获取错误信息字符串
    const getErrorMessage = () => {
        if (!error) return null;
        if (typeof error === 'string') return error;
        if (error instanceof Error) return error.message;
        return String(error);
    };

    const errorMessage = getErrorMessage();
    // 计算上传速度（简化版本，实际应该基于时间计算）
    const uploadedBytes = file ? Math.round((progress / 100) * file.size) : 0;
    const uploadedMB = uploadedBytes / 1024 / 1024;
    const totalMB = file ? file.size / 1024 / 1024 : 0;

    // 获取状态图标和颜色
    const getStatusIcon = () => {
        if (errorMessage) {
            return <XCircle className="h-5 w-5 text-red-500" />;
        }
        if (isCompleted) {
            return <CheckCircle className="h-5 w-5 text-green-500" />;
        }
        if (isUploading) {
            return <Upload className="h-5 w-5 text-blue-500 animate-pulse" />;
        }
        return <FileSpreadsheet className="h-5 w-5 text-gray-400" />;
    };

    const getStatusText = () => {
        if (errorMessage) return '上传失败';
        if (isCompleted) return '上传完成';
        if (isUploading) return '正在上传';
        return '准备上传';
    };

    const getStatusColor = () => {
        if (errorMessage) return 'text-red-600 dark:text-red-400';
        if (isCompleted) return 'text-green-600 dark:text-green-400';
        if (isUploading) return 'text-blue-600 dark:text-blue-400';
        return 'text-gray-600 dark:text-gray-400';
    };

    if (!file) {
        return null;
    }

    return (
        <div className={cn('space-y-4', className)}>
            {/* 文件信息头部 */}
            {showFileInfo && (
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <FileSpreadsheet className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.size)} • {file.type || '未知类型'}
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        {getStatusIcon()}
                        <span className={cn('text-sm font-medium', getStatusColor())}>
                            {getStatusText()}
                        </span>
                    </div>
                </div>
            )}

            {/* 进度条 */}
            <div className="space-y-2">
                <Progress
                    value={progress}
                    className={cn(
                        'w-full h-2 transition-all duration-300',
                        errorMessage && '[&>div]:bg-red-500',
                        isCompleted && '[&>div]:bg-green-500'
                    )}
                />

                {/* 进度信息 */}
                <div className="flex justify-between items-center text-sm">
                    <div className="flex flex-col">
                        <span className={cn('font-medium', getStatusColor())}>
                            {progress.toFixed(1)}% 完成
                        </span>
                        {showSpeedInfo && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {uploadedMB.toFixed(2)} MB / {totalMB.toFixed(2)} MB
                            </span>
                        )}
                    </div>

                    {/* 动画指示器 */}
                    {isUploading && (
                        <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* 状态详情 */}
            <div className={cn(
                'rounded-lg p-3 border transition-all duration-300',
                errorMessage && 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
                isCompleted && 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
                isUploading && 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
                !isUploading && !isCompleted && !errorMessage && 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            )}>
                <div className="flex items-center justify-between text-sm">
                    <span className={cn(
                        'font-medium',
                        errorMessage && 'text-red-700 dark:text-red-300',
                        isCompleted && 'text-green-700 dark:text-green-300',
                        isUploading && 'text-blue-700 dark:text-blue-300',
                        !isUploading && !isCompleted && !errorMessage && 'text-gray-700 dark:text-gray-300'
                    )}>
                        上传状态
                    </span>
                    <span className={cn(
                        'font-medium',
                        errorMessage && 'text-red-600 dark:text-red-400',
                        isCompleted && 'text-green-600 dark:text-green-400',
                        isUploading && 'text-blue-600 dark:text-blue-400',
                        !isUploading && !isCompleted && !errorMessage && 'text-gray-600 dark:text-gray-400'
                    )}>
                        {getStatusText()}
                    </span>
                </div>

                <div className={cn(
                    'mt-2 text-xs',
                    errorMessage && 'text-red-600 dark:text-red-400',
                    isCompleted && 'text-green-600 dark:text-green-400',
                    isUploading && 'text-blue-600 dark:text-blue-400',
                    !isUploading && !isCompleted && !errorMessage && 'text-gray-600 dark:text-gray-400'
                )}>
                    {errorMessage && `错误: ${errorMessage}`}
                    {isCompleted && '文件已成功上传到服务器，开始处理...'}
                    {isUploading && '文件正在上传到服务器，请勿关闭页面'}
                    {!isUploading && !isCompleted && !errorMessage && '准备上传文件到服务器'}
                </div>
            </div>

            {/* 错误详情 */}
            {errorMessage && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-red-700 dark:text-red-300">
                            上传失败
                        </span>
                    </div>
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {errorMessage}
                    </p>
                </div>
            )}
        </div>
    );
};

export default UploadProgressBar;
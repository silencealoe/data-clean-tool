/**
 * 下载管理组件
 * 提供下载按钮和状态显示，实现文件下载逻辑，添加下载成功/失败反馈
 */

import { Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useFileDownload } from '../hooks/use-file-download';
import type { ProcessingStatistics } from '../types';

export interface DownloadManagerProps {
    jobId: string;
    status: 'processing' | 'completed' | 'failed';
    statistics?: ProcessingStatistics;
    cleanedRows?: number | null;
    exceptionRows?: number | null;
    className?: string;
}

export function DownloadManager({
    jobId,
    status,
    statistics,
    cleanedRows,
    exceptionRows,
    className
}: DownloadManagerProps) {
    const {
        downloadCleanData,
        downloadExceptionData,
        isDownloadingClean,
        isDownloadingException,
        isDownloading
    } = useFileDownload();

    // 获取清洁数据行数
    const getCleanedRows = () => {
        return statistics?.cleanedRows ?? cleanedRows ?? 0;
    };

    // 获取异常数据行数
    const getExceptionRows = () => {
        return statistics?.exceptionRows ?? exceptionRows ?? 0;
    };

    // 处理清洁数据下载
    const handleDownloadCleanData = () => {
        downloadCleanData(jobId);
    };

    // 处理异常数据下载
    const handleDownloadExceptionData = () => {
        downloadExceptionData(jobId);
    };

    // 如果状态不是完成，不显示下载功能
    if (status !== 'completed') {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        下载数据
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-4">
                        {status === 'processing' && (
                            <div className="flex items-center justify-center gap-2 text-blue-600">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>文件处理中，请等待处理完成后下载</span>
                            </div>
                        )}
                        {status === 'failed' && (
                            <div className="flex items-center justify-center gap-2 text-red-600">
                                <AlertCircle className="h-5 w-5" />
                                <span>文件处理失败，无法下载</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const cleanRows = getCleanedRows();
    const exceptionRowsCount = getExceptionRows();
    const hasCleanData = cleanRows > 0;
    const hasExceptionData = exceptionRowsCount > 0;

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    下载数据
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* 下载状态提示 */}
                {isDownloading && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl animate-in fade-in-0 slide-in-from-top-2 duration-500">
                        <div className="flex items-center gap-3 text-blue-700 dark:text-blue-300">
                            <div className="relative">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <div className="absolute -inset-1 bg-blue-200 dark:bg-blue-800 rounded-full animate-ping opacity-20"></div>
                            </div>
                            <span className="text-sm font-medium">
                                {isDownloadingClean && '正在下载清洁数据...'}
                                {isDownloadingException && '正在下载异常数据...'}
                            </span>
                            <div className="flex space-x-1 ml-auto">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 下载按钮区域 */}
                <div className="space-y-4">
                    {/* 清洁数据下载 */}
                    {hasCleanData && (
                        <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02] animate-in fade-in-0 slide-in-from-left-4 duration-500">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl group-hover:bg-green-200 dark:group-hover:bg-green-800/40 transition-colors duration-300">
                                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-green-900 dark:text-green-100 group-hover:text-green-800 dark:group-hover:text-green-50 transition-colors duration-300">
                                        清洁数据
                                    </h3>
                                    <p className="text-sm text-green-700 dark:text-green-300">
                                        已清洗并标准化的数据，可直接使用
                                    </p>
                                </div>
                                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 transition-all duration-300 group-hover:scale-105">
                                    {cleanRows.toLocaleString()} 行
                                </Badge>
                            </div>
                            <Button
                                onClick={handleDownloadCleanData}
                                disabled={isDownloadingClean}
                                className="bg-green-600 hover:bg-green-700 text-white transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                {isDownloadingClean ? (
                                    <div className="flex items-center space-x-1">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>下载中...</span>
                                    </div>
                                ) : (
                                    '下载'
                                )}
                            </Button>
                        </div>
                    )}

                    {/* 异常数据下载 */}
                    {hasExceptionData && (
                        <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800 rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02] animate-in fade-in-0 slide-in-from-right-4 duration-500 delay-200">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl group-hover:bg-orange-200 dark:group-hover:bg-orange-800/40 transition-colors duration-300">
                                    <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-orange-900 dark:text-orange-100 group-hover:text-orange-800 dark:group-hover:text-orange-50 transition-colors duration-300">
                                        异常数据
                                    </h3>
                                    <p className="text-sm text-orange-700 dark:text-orange-300">
                                        无法自动清洗的数据，需要人工处理
                                    </p>
                                </div>
                                <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 transition-all duration-300 group-hover:scale-105">
                                    {exceptionRowsCount.toLocaleString()} 行
                                </Badge>
                            </div>
                            <Button
                                onClick={handleDownloadExceptionData}
                                disabled={isDownloadingException}
                                variant="outline"
                                className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                {isDownloadingException ? (
                                    <div className="flex items-center space-x-1">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>下载中...</span>
                                    </div>
                                ) : (
                                    '下载'
                                )}
                            </Button>
                        </div>
                    )}

                    {/* 无数据提示 */}
                    {!hasCleanData && !hasExceptionData && (
                        <div className="text-center py-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                            <div className="relative inline-block mb-4">
                                <div className="flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full">
                                    <AlertCircle className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full animate-ping"></div>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                                <span className="text-lg font-medium">暂无可下载的数据</span>
                            </div>
                            <p className="text-sm text-gray-400 dark:text-gray-500">
                                文件处理完成，但没有生成可下载的数据
                            </p>
                        </div>
                    )}
                </div>

                {/* 下载说明 */}
                {(hasCleanData || hasExceptionData) && (
                    <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">下载说明：</h4>
                        <ul className="text-xs text-gray-600 space-y-1">
                            <li>• 清洁数据：已经过系统自动清洗和标准化处理的数据</li>
                            <li>• 异常数据：系统无法自动处理的数据，建议人工检查</li>
                            <li>• 下载的文件格式为 Excel (.xlsx)，可直接使用</li>
                            <li>• 如果下载失败，请检查网络连接后重试</li>
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
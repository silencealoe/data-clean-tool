/**
 * 数据查看组件
 * 支持Tab切换查看清洁数据和异常数据，支持分页
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, Download, FileText, AlertTriangle, Eye, RefreshCw } from 'lucide-react';
import { useCleanData } from '../hooks/use-clean-data';
import { useExceptionData } from '../hooks/use-exception-data';
import { cn } from '../lib/utils';

interface DataViewerProps {
    jobId: string;
    className?: string;
}

export function DataViewer({ jobId, className }: DataViewerProps) {
    const [activeTab, setActiveTab] = useState<'clean' | 'exception'>('clean');
    const [cleanPage, setCleanPage] = useState(1);
    const [exceptionPage, setExceptionPage] = useState(1);
    const pageSize = 50;

    const {
        data: cleanDataResponse,
        isLoading: cleanIsLoading,
        refetch: refetchCleanData,
    } = useCleanData({ jobId, page: cleanPage, pageSize, enabled: activeTab === 'clean' });

    const {
        data: exceptionDataResponse,
        isLoading: exceptionIsLoading,
        refetch: refetchExceptionData,
    } = useExceptionData({ jobId, page: exceptionPage, pageSize, enabled: activeTab === 'exception' });

    // 解构响应数据
    const cleanData = cleanDataResponse?.data || [];
    const cleanTotal = cleanDataResponse?.total || 0;
    const currentCleanPage = cleanDataResponse?.page || cleanPage;
    const cleanTotalPages = cleanDataResponse?.totalPages || 1;

    const exceptionData = exceptionDataResponse?.data || [];
    const exceptionTotal = exceptionDataResponse?.total || 0;
    const currentExceptionPage = exceptionDataResponse?.page || exceptionPage;
    const exceptionTotalPages = exceptionDataResponse?.totalPages || 1;

    const handleDownloadClean = async () => {
        try {
            const response = await fetch(`http://localhost:3100/api/data-cleaning/download/clean/${jobId}`);
            if (!response.ok) throw new Error('下载失败');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `clean_data_${jobId}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('下载失败:', error);
            alert('下载失败，请稍后重试');
        }
    };

    const handleDownloadException = async () => {
        try {
            const response = await fetch(`http://localhost:3100/api/data-cleaning/download/exceptions/${jobId}`);
            if (!response.ok) throw new Error('下载失败');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `exception_data_${jobId}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('下载失败:', error);
            alert('下载失败，请稍后重试');
        }
    };

    const renderCleanDataTable = () => {
        if (cleanIsLoading) {
            return (
                <div className="text-center py-12">
                    <div className="relative inline-block">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-300 animate-spin [animation-duration:1.5s] [animation-direction:reverse]"></div>
                    </div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400 animate-pulse">加载清洁数据中...</p>
                </div>
            );
        }

        if (!cleanData || cleanData.length === 0) {
            return (
                <div className="text-center py-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                    <div className="relative inline-block mb-4">
                        <FileText className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full animate-ping"></div>
                    </div>
                    <p className="text-gray-500 text-lg font-medium">暂无清洁数据</p>
                    <p className="text-gray-400 text-sm mt-2">没有找到清洁后的数据记录</p>
                </div>
            );
        }

        const headers = Object.keys(cleanData[0] || {}).filter(key => key !== 'id' && key !== 'jobId' && key !== 'createdAt' && key !== 'rowNumber' && key !== 'additionalFields');

        // 字段名中英文映射
        const fieldNameMap: Record<string, string> = {
            'name': '姓名',
            'phone': '手机号',
            'date': '日期',
            'province': '省',
            'city': '市',
            'district': '区',
            'addressDetail': '详细地址',
        };

        return (
            <>
                <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="w-20 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-900 z-10 border-r border-gray-200 dark:border-gray-700">
                                        行号
                                    </th>
                                    {headers.map((key) => (
                                        <th key={key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 tracking-wider whitespace-nowrap min-w-[150px]">
                                            {fieldNameMap[key] || key}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {cleanData.map((row: any, index: number) => (
                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="w-20 px-4 py-4 text-center text-sm font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
                                            {row.rowNumber || index + 1}
                                        </td>
                                        {headers.map((key) => (
                                            <td
                                                key={`${index}-${key}`}
                                                className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap min-w-[150px] max-w-xs truncate"
                                                title={row[key] !== null && row[key] !== undefined ? String(row[key]) : '-'}
                                            >
                                                {row[key] !== null && row[key] !== undefined ? String(row[key]) : '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 分页控件 */}
                {cleanTotal > 0 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            显示 {((currentCleanPage - 1) * pageSize) + 1} - {Math.min(currentCleanPage * pageSize, cleanTotal)} 条，
                            共 {cleanTotal.toLocaleString()} 条记录
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCleanPage(currentCleanPage - 1)}
                                disabled={currentCleanPage <= 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                上一页
                            </Button>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                第 {currentCleanPage} 页，共 {cleanTotalPages} 页
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCleanPage(currentCleanPage + 1)}
                                disabled={currentCleanPage >= cleanTotalPages}
                            >
                                下一页
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </>
        );
    };

    const renderExceptionDataTable = () => {
        if (exceptionIsLoading) {
            return (
                <div className="text-center py-12">
                    <div className="relative inline-block">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600 mx-auto"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-300 animate-spin [animation-duration:1.5s] [animation-direction:reverse]"></div>
                    </div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400 animate-pulse">加载异常数据中...</p>
                </div>
            );
        }

        if (!exceptionData || exceptionData.length === 0) {
            return (
                <div className="text-center py-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                    <div className="relative inline-block mb-4">
                        <AlertTriangle className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full animate-ping"></div>
                    </div>
                    <p className="text-gray-500 text-lg font-medium">暂无异常数据</p>
                    <p className="text-gray-400 text-sm mt-2">所有数据都已成功清洗</p>
                </div>
            );
        }

        return (
            <>
                <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="w-20 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-900 z-10 border-r border-gray-200 dark:border-gray-700">
                                        行号
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap min-w-[250px]">
                                        原始数据
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap min-w-[350px]">
                                        错误详情
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {exceptionData.map((row: any, index: number) => (
                                    <tr key={index} className="hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors">
                                        <td className="w-20 px-4 py-4 text-center text-sm font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
                                            {row.rowNumber || index + 1}
                                        </td>
                                        <td className="px-4 py-4 text-sm font-mono min-w-[250px]">
                                            <div className="max-w-md overflow-auto bg-gray-50 dark:bg-gray-800 p-3 rounded text-xs">
                                                <pre className="whitespace-pre-wrap break-words">
                                                    {typeof row.originalData === 'object'
                                                        ? JSON.stringify(row.originalData, null, 2)
                                                        : String(row.originalData || '-')}
                                                </pre>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-sm min-w-[350px]">
                                            <div className="space-y-2 max-w-lg">
                                                {Array.isArray(row.errors) && row.errors.map((error: any, errorIndex: number) => (
                                                    <div key={errorIndex} className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded p-3">
                                                        <div className="flex items-start gap-2">
                                                            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-semibold text-red-900 dark:text-red-100 text-sm">{error.field}</p>
                                                                <p className="text-xs text-red-700 dark:text-red-300 mt-1 break-words">{error.errorMessage}</p>
                                                                {error.originalValue && (
                                                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 break-words">
                                                                        原值: {String(error.originalValue)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 分页控件 */}
                {exceptionTotal > 0 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            显示 {((currentExceptionPage - 1) * pageSize) + 1} - {Math.min(currentExceptionPage * pageSize, exceptionTotal)} 条，
                            共 {exceptionTotal.toLocaleString()} 条记录
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExceptionPage(currentExceptionPage - 1)}
                                disabled={currentExceptionPage <= 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                上一页
                            </Button>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                第 {currentExceptionPage} 页，共 {exceptionTotalPages} 页
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExceptionPage(currentExceptionPage + 1)}
                                disabled={currentExceptionPage >= exceptionTotalPages}
                            >
                                下一页
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </>
        );
    };

    return (
        <Card className={cn("border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500 animate-in fade-in-0 slide-in-from-bottom-4", className)}>
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                        <Eye className="h-5 w-5 text-white" />
                    </div>
                    查看数据
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'clean' | 'exception')} className="w-full">
                    <div className="flex items-center justify-between mb-4">
                        <TabsList className="grid w-[400px] grid-cols-2">
                            <TabsTrigger value="clean" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                清洁数据
                                {cleanTotal > 0 && (
                                    <span className="ml-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                                        {cleanTotal}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="exception" className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                异常数据
                                {exceptionTotal > 0 && (
                                    <span className="ml-1 px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                                        {exceptionTotal}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => activeTab === 'clean' ? refetchCleanData() : refetchExceptionData()}
                            >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                刷新
                            </Button>
                            {activeTab === 'clean' && cleanTotal > 0 && (
                                <Button size="sm" onClick={handleDownloadClean}>
                                    <Download className="h-4 w-4 mr-1" />
                                    下载清洁数据
                                </Button>
                            )}
                            {activeTab === 'exception' && exceptionTotal > 0 && (
                                <Button size="sm" onClick={handleDownloadException} variant="destructive">
                                    <Download className="h-4 w-4 mr-1" />
                                    下载异常数据
                                </Button>
                            )}
                        </div>
                    </div>

                    <TabsContent value="clean" className="mt-0">
                        {renderCleanDataTable()}
                    </TabsContent>

                    <TabsContent value="exception" className="mt-0">
                        {renderExceptionDataTable()}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

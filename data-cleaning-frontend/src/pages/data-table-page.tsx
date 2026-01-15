/**
 * 数据表格查询页面
 * 支持分页查询清洁数据和异常数据
 */

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Download, FileText, AlertTriangle } from 'lucide-react';
import { useCleanData } from '../hooks/use-clean-data';
import { useExceptionData } from '../hooks/use-exception-data';
import { cn } from '../lib/utils';

export function DataTablePage() {
    const { jobId } = useParams<{ jobId: string }>();
    const [activeTab, setActiveTab] = useState<'clean' | 'exception'>('clean');
    const [page, setPage] = useState(1);
    const pageSize = 100;

    const {
        data: cleanData,
        total: cleanTotal,
        page: cleanPage,
        totalPages: cleanTotalPages,
        isLoading: cleanIsLoading,
        refetch: refetchCleanData,
    } = useCleanData({ jobId, page, pageSize, enabled: activeTab === 'clean' });

    const {
        data: exceptionData,
        total: exceptionTotal,
        page: exceptionPage,
        totalPages: exceptionTotalPages,
        isLoading: exceptionIsLoading,
        refetch: refetchExceptionData,
    } = useExceptionData({ jobId, page, pageSize, enabled: activeTab === 'exception' });

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    const handleDownloadClean = async () => {
        try {
            const response = await fetch(`http://localhost:3100/api/data-cleaning/download/clean/${jobId}`);
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

    return (
        <div className="container mx-auto max-w-6xl py-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        数据查询
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* 标签切换 */}
                    <div className="flex gap-4 mb-6">
                        <Button
                            variant={activeTab === 'clean' ? 'default' : 'outline'}
                            onClick={() => { setActiveTab('clean'); setPage(1); }}
                        >
                            清洁数据
                        </Button>
                        <Button
                            variant={activeTab === 'exception' ? 'default' : 'outline'}
                            onClick={() => { setActiveTab('exception'); setPage(1); }}
                        >
                            异常数据
                        </Button>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2 mb-6">
                        <Button onClick={() => refetchCleanData()} variant="outline" size="sm">
                            刷新数据
                        </Button>
                        {activeTab === 'clean' && (
                            <Button onClick={handleDownloadClean} size="sm">
                                <Download className="h-4 w-4 mr-1" />
                                下载清洁数据
                            </Button>
                        )}
                        {activeTab === 'exception' && (
                            <Button onClick={handleDownloadException} size="sm">
                                <Download className="h-4 w-4 mr-1" />
                                下载异常数据
                            </Button>
                        )}
                    </div>

                    {/* 加载状态 */}
                    {cleanIsLoading || exceptionIsLoading ? (
                        <div className="text-center py-12">
                            <div className="relative inline-block">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-300 animate-spin [animation-duration:1.5s] [animation-direction:reverse]"></div>
                            </div>
                            <p className="mt-4 text-gray-600 animate-pulse">加载中...</p>
                        </div>
                    ) : activeTab === 'clean' && cleanData.length === 0 ? (
                        <div className="text-center py-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                            <div className="relative inline-block mb-4">
                                <FileText className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600" />
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full animate-ping"></div>
                            </div>
                            <p className="text-gray-500 text-lg font-medium">暂无清洁数据</p>
                            <p className="text-gray-400 text-sm mt-2">所有数据都已清洗完成</p>
                        </div>
                    ) : activeTab === 'exception' && exceptionData?.length === 0 ? (
                        <div className="text-center py-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                            <div className="relative inline-block mb-4">
                                <AlertTriangle className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600" />
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full animate-ping"></div>
                            </div>
                            <p className="text-gray-500 text-lg font-medium">暂无异常数据</p>
                            <p className="text-gray-400 text-sm mt-2">所有数据都已清洗完成</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">行号</TableHead>
                                    {activeTab === 'clean' && cleanData.length > 0 && (
                                        <>
                                            {Object.keys(cleanData[0].data).map((key) => (
                                                <TableHead key={key}>{key}</TableHead>
                                            ))}
                                        </>
                                    )}
                                    {activeTab === 'exception' && exceptionData.length > 0 && (
                                        <>
                                            <TableHead>原始数据</TableHead>
                                            <TableHead>错误原因</TableHead>
                                        </>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activeTab === 'clean' && cleanData.map((row, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{row.rowNumber}</TableCell>
                                        {Object.entries(row.data).map(([key, value], cellIndex) => (
                                            <TableCell key={`${index}-${cellIndex}`}>
                                                {value !== null && value !== undefined ? String(value) : ''}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                                {activeTab === 'exception' && exceptionData.map((row, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{row.rowNumber}</TableCell>
                                        <TableCell className="font-medium">
                                            {typeof row.originalData === 'object' 
                                                ? JSON.stringify(row.originalData) 
                                                : String(row.originalData || '')}
                                        </TableCell>
                                        <TableCell className="text-red-600">
                                            {Array.isArray(row.errors) && row.errors.map((error, errorIndex) => (
                                                <div key={errorIndex} className="mb-1">
                                                    <strong>{error.field}:</strong> {error.errorMessage}
                                                </div>
                                            ))}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}

                    {/* 分页 */}
                    {((activeTab === 'clean' && cleanTotal > 0) || (activeTab === 'exception' && exceptionTotal > 0)) && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                            <div className="text-sm text-gray-600">
                                显示 {((activeTab === 'clean' ? ((cleanPage - 1) * pageSize) + 1 : (exceptionPage - 1) * pageSize + 1))} - {Math.min(activeTab === 'clean' ? cleanPage * pageSize : exceptionPage * pageSize, activeTab === 'clean' ? cleanTotal : exceptionTotal)} 条，
                                共 {activeTab === 'clean' ? cleanTotal : exceptionTotal} 条记录
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange((activeTab === 'clean' ? cleanPage : exceptionPage) - 1)}
                                    disabled={(activeTab === 'clean' ? cleanPage : exceptionPage) <= 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    上一页
                                </Button>
                                <span className="text-sm text-gray-600">
                                    第 {activeTab === 'clean' ? cleanPage : exceptionPage} 页，
                                    共 {activeTab === 'clean' ? cleanTotalPages : exceptionTotalPages} 页
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange((activeTab === 'clean' ? cleanPage : exceptionPage) + 1)}
                                    disabled={(activeTab === 'clean' ? cleanPage : exceptionPage) >= (activeTab === 'clean' ? cleanTotalPages : exceptionTotalPages)}
                                >
                                    下一页
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

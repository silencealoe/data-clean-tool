/**
 * DownloadManager 组件演示
 * 用于展示下载管理组件的不同状态
 */

import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { DownloadManager } from './download-manager';
import type { ProcessingStatistics } from '../types';

export function DownloadManagerDemo() {
    const [demoState, setDemoState] = useState<'processing' | 'completed' | 'failed' | 'completed-no-data'>('completed');

    // 模拟统计数据
    const mockStatistics: ProcessingStatistics = {
        totalRows: 1000,
        cleanedRows: 850,
        exceptionRows: 150,
        processingTime: 45
    };

    const mockJobId = 'demo-job-12345';

    const getStatisticsForState = () => {
        switch (demoState) {
            case 'completed':
                return mockStatistics;
            case 'completed-no-data':
                return {
                    totalRows: 100,
                    cleanedRows: 0,
                    exceptionRows: 0,
                    processingTime: 30
                };
            default:
                return undefined;
        }
    };

    const getStatusForState = (): 'processing' | 'completed' | 'failed' => {
        if (demoState === 'completed-no-data') return 'completed';
        return demoState;
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>DownloadManager 组件演示</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <p className="text-gray-600">
                            选择不同的状态来查看 DownloadManager 组件在各种情况下的表现：
                        </p>

                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant={demoState === 'processing' ? 'default' : 'outline'}
                                onClick={() => setDemoState('processing')}
                                size="sm"
                            >
                                处理中
                            </Button>
                            <Button
                                variant={demoState === 'completed' ? 'default' : 'outline'}
                                onClick={() => setDemoState('completed')}
                                size="sm"
                            >
                                处理完成（有数据）
                            </Button>
                            <Button
                                variant={demoState === 'completed-no-data' ? 'default' : 'outline'}
                                onClick={() => setDemoState('completed-no-data')}
                                size="sm"
                            >
                                处理完成（无数据）
                            </Button>
                            <Button
                                variant={demoState === 'failed' ? 'default' : 'outline'}
                                onClick={() => setDemoState('failed')}
                                size="sm"
                            >
                                处理失败
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <DownloadManager
                jobId={mockJobId}
                status={getStatusForState()}
                statistics={getStatisticsForState()}
            />
        </div>
    );
}
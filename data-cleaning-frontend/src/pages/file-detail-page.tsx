import { useParams, useNavigate } from 'react-router-dom';
import { FileDetail } from '@/components/file-detail';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

/**
 * 文件详情页面
 */
export function FileDetailPage() {
    const { fileId } = useParams<{ fileId: string }>();
    const navigate = useNavigate();

    const handleGoBack = () => {
        navigate('/files');
    };

    if (!fileId) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950 transition-colors duration-500 flex items-center justify-center">
                <div className="text-center animate-in fade-in-0 zoom-in-50 duration-1000">
                    <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ArrowLeft className="h-10 w-10 text-white rotate-45" />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-4">
                        文件ID缺失
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                        无法找到指定的文件
                    </p>
                    <Button
                        onClick={handleGoBack}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        返回文件列表
                    </Button>
                </div>
            </div>
        );
    }

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
                        返回文件列表
                    </Button>
                    <div className="text-center">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                            文件详情
                        </h1>
                        <p className="text-lg text-gray-600 dark:text-gray-400">
                            查看文件处理详情和下载结果
                        </p>
                    </div>
                </div>

                {/* 文件详情区域 */}
                <div className="max-w-4xl mx-auto animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-200">
                    <FileDetail fileId={fileId} />
                </div>
            </div>
        </div>
    );
}
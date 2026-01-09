import { FileList } from '@/components/file-list';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * 文件管理页面
 */
export function FilesPage() {
    const navigate = useNavigate();

    const handleFileSelect = (fileId: string) => {
        navigate(`/files/${fileId}`);
    };

    const handleGoBack = () => {
        navigate('/');
    };

    const handleNewUpload = () => {
        navigate('/upload');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950 transition-colors duration-500">
            <div className="container mx-auto px-4 py-8">
                {/* 头部导航 */}
                <div className="mb-8 animate-in fade-in-0 slide-in-from-top-4 duration-1000">
                    <div className="flex items-center justify-between mb-6">
                        <Button
                            variant="ghost"
                            onClick={handleGoBack}
                            className="transition-all duration-300 hover:scale-105 hover:shadow-md hover:bg-blue-50 dark:hover:bg-blue-950/20"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            返回首页
                        </Button>
                        <Button
                            onClick={handleNewUpload}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            上传新文件
                        </Button>
                    </div>
                    <div className="text-center">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                            文件管理
                        </h1>
                        <p className="text-lg text-gray-600 dark:text-gray-400">
                            查看和管理已上传的文件
                        </p>
                    </div>
                </div>

                {/* 文件列表区域 */}
                <div className="max-w-6xl mx-auto animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-200">
                    <FileList
                        onFileSelect={handleFileSelect}
                        className="border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-500"
                    />
                </div>
            </div>
        </div>
    );
}
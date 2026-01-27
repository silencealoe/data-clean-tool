import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, BarChart3, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';



/**
 * 主页组件
 * 显示服务信息和快速操作入口
 */
export function HomePage() {
    const navigate = useNavigate();

    const serviceInfo = {
        name: '数据清洗服务',
        description: '专业的Excel数据清洗和标准化服务',
        purpose: '帮助用户快速清洗和标准化Excel数据，提高数据质量和可用性',
        features: [
            '支持Excel文件上传和处理',
            '自动识别和清洗脏数据',
            '实时处理状态监控',
            '清洗结果统计和分析',
            '清洁数据和异常数据分别下载'
        ]
    };

    const quickActions = [
        {
            title: '上传文件',
            description: '上传Excel文件开始数据清洗',
            icon: Upload,
            href: '/upload',
            color: 'bg-blue-500 hover:bg-blue-600'
        },
        {
            title: '文件管理',
            description: '查看和管理已上传的文件',
            icon: FileText,
            href: '/files',
            color: 'bg-green-500 hover:bg-green-600'
        },
        {
            title: '规则配置',
            description: '查看和编辑数据清洗规则',
            icon: BarChart3,
            href: '/rule-config',
            color: 'bg-purple-500 hover:bg-purple-600'
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950 transition-colors duration-500">
            <div className="container mx-auto px-4 py-8">
                {/* 头部区域 */}
                <div className="text-center mb-12 animate-fade-in duration-1000">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-6 animate-zoom-in duration-1000 delay-200">
                        {serviceInfo.name}
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300 mb-6 animate-slide-in-from-bottom duration-1000 delay-400">
                        {serviceInfo.description}
                    </p>
                    <p className="text-lg text-gray-700 dark:text-gray-400 max-w-3xl mx-auto animate-slide-in-from-bottom duration-1000 delay-600">
                        {serviceInfo.purpose}
                    </p>
                </div>

                {/* 功能特性卡片 */}
                <div className="mb-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-800">
                    <Card className="max-w-4xl mx-auto hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                                    <BarChart3 className="h-6 w-6 text-white" />
                                </div>
                                服务特性
                            </CardTitle>
                            <CardDescription className="text-base">
                                我们的数据清洗服务提供以下核心功能
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {serviceInfo.features.map((feature, index) => (
                                    <div
                                        key={index}
                                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all duration-300 hover:scale-105 animate-in fade-in-0 slide-in-from-left-4 duration-500"
                                        style={{ animationDelay: `${(index + 1) * 200}ms` }}
                                    >
                                        <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mt-2 flex-shrink-0 animate-pulse" />
                                        <span className="text-gray-700 dark:text-gray-300 font-medium">{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 快速操作区域 */}
                <div className="mb-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-1000">
                    <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-8">
                        快速开始
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {quickActions.map((action, index) => (
                            <Card
                                key={index}
                                className="group hover:shadow-2xl transition-all duration-500 cursor-pointer border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:scale-105 hover:-translate-y-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-700"
                                style={{ animationDelay: `${1200 + index * 200}ms` }}
                            >
                                <CardHeader>
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "p-4 rounded-xl text-white transition-all duration-300 group-hover:scale-110 group-hover:rotate-3",
                                            action.color
                                        )}>
                                            <action.icon className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                                                {action.title}
                                            </CardTitle>
                                            <CardDescription className="text-base">
                                                {action.description}
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Button
                                        className="w-full group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                                        onClick={() => navigate(action.href)}
                                    >
                                        开始使用
                                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* 使用流程说明 */}
                <div className="max-w-4xl mx-auto animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-1400">
                    <Card className="hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-center text-2xl">使用流程</CardTitle>
                            <CardDescription className="text-center text-base">
                                简单四步完成数据清洗
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                {[
                                    { step: '1', title: '上传文件', desc: '选择Excel文件上传', color: 'from-blue-500 to-blue-600' },
                                    { step: '2', title: '开始处理', desc: '系统自动清洗数据', color: 'from-purple-500 to-purple-600' },
                                    { step: '3', title: '监控进度', desc: '实时查看处理状态', color: 'from-indigo-500 to-indigo-600' },
                                    { step: '4', title: '下载结果', desc: '获取清洗后的数据', color: 'from-green-500 to-green-600' }
                                ].map((item, index) => (
                                    <div
                                        key={index}
                                        className="text-center group hover:scale-110 transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-4 duration-700"
                                        style={{ animationDelay: `${1600 + index * 200}ms` }}
                                    >
                                        <div className={cn(
                                            "w-16 h-16 bg-gradient-to-r text-white rounded-2xl flex items-center justify-center font-bold text-xl mx-auto mb-4 shadow-lg group-hover:shadow-2xl transition-all duration-300 group-hover:rotate-6",
                                            item.color
                                        )}>
                                            {item.step}
                                        </div>
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                                            {item.title}
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-300">
                                            {item.desc}
                                        </p>
                                        {index < 3 && (
                                            <div className="hidden md:block absolute top-8 left-full w-8 h-0.5 bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-500 animate-pulse"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
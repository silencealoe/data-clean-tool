/**
 * Rule Configuration Page
 * Main page component for viewing and editing rule configurations
 */

import { useState } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Settings,
    Edit,
    X,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Loader2,
    ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRuleConfigManager } from '@/hooks';
import { RuleConfigViewer } from '@/components/rule-config-viewer';
import { RuleConfigEditor } from '@/components/rule-config-editor-simple';
import { DEFAULT_RULE_CONFIG } from '@/lib/default-rule-config';
import type { RuleConfiguration } from '@/types/rule-config';

/**
 * Rule Configuration Page Component
 */
export function RuleConfigPage() {
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [editingConfig, setEditingConfig] = useState<RuleConfiguration | null>(null);

    const {
        config,
        stats,
        isLoading,
        isError,
        error,
        configQuery,
        updateConfig,
        reloadConfig,
        updateMutation,
        reloadMutation,
        refetchConfig,
    } = useRuleConfigManager();

    // 使用配置数据，如果没有从后端获取到配置，则使用默认配置
    const displayConfig = config || DEFAULT_RULE_CONFIG;
    const isUsingDefaultConfig = !config;

    // Handle edit mode toggle
    const handleEdit = () => {
        if (displayConfig) {
            setEditingConfig(JSON.parse(JSON.stringify(displayConfig))); // Deep clone
            setIsEditing(true);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditingConfig(null);
        updateMutation.reset();
    };

    const handleSave = (updatedConfig: RuleConfiguration, description?: string) => {
        updateConfig(
            { config: updatedConfig, description },
            {
                onSuccess: () => {
                    setIsEditing(false);
                    setEditingConfig(null);
                },
            }
        );
    };

    // Handle reload configuration
    const handleReload = () => {
        reloadConfig(undefined, {
            onSuccess: () => {
                // Reset editing state if in edit mode
                if (isEditing) {
                    setIsEditing(false);
                    setEditingConfig(null);
                }
            },
        });
    };

    // Handle retry on error
    const handleRetry = () => {
        refetchConfig();
    };

    // Loading state - 只有在没有任何配置数据时才显示加载状态
    if (isLoading && !displayConfig) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950">
                <div className="container mx-auto px-4 py-8">
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                            <p className="text-gray-600 dark:text-gray-400">正在加载规则配置...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Error state - 只有在没有任何配置数据且发生错误时才显示错误状态
    if (isError && !displayConfig) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950">
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-2xl mx-auto">
                        <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800 dark:text-red-200">
                                加载规则配置失败: {error?.message || '未知错误'}
                            </AlertDescription>
                        </Alert>
                        <div className="mt-4 text-center">
                            <Button onClick={handleRetry} variant="outline">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                重试
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950">
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-6">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/')}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            返回首页
                        </Button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                                规则配置管理
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 text-lg">
                                查看和编辑数据清洗规则配置
                                {isUsingDefaultConfig && (
                                    <span className="ml-2 text-orange-600 font-medium">
                                        (当前显示默认配置)
                                    </span>
                                )}
                            </p>
                        </div>

                        {/* Status Badge */}
                        {displayConfig && (
                            <div className="text-right">
                                <div className="flex flex-col items-end gap-2">
                                    <Badge variant="secondary" className="mb-1">
                                        版本 {displayConfig.metadata.version}
                                    </Badge>
                                    {isUsingDefaultConfig && (
                                        <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                                            默认配置
                                        </Badge>
                                    )}
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {stats?.isInitialized ? '已初始化' : '未初始化'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Success/Error Messages */}
                {isUsingDefaultConfig && (
                    <Alert className="mb-6 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-800 dark:text-orange-200">
                            无法连接到服务器获取配置，正在显示默认规则配置。您可以编辑并保存配置到服务器。
                        </AlertDescription>
                    </Alert>
                )}

                {updateMutation.isSuccess && (
                    <Alert className="mb-6 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800 dark:text-green-200">
                            配置更新成功！
                        </AlertDescription>
                    </Alert>
                )}

                {reloadMutation.isSuccess && (
                    <Alert className="mb-6 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800 dark:text-green-200">
                            配置重载成功！
                        </AlertDescription>
                    </Alert>
                )}

                {(updateMutation.isError || reloadMutation.isError) && (
                    <Alert className="mb-6 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800 dark:text-red-200">
                            操作失败: {(updateMutation.error || reloadMutation.error)?.message || '未知错误'}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Action Buttons */}
                <div className="mb-6">
                    <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-0 shadow-lg">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                                        <Settings className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl">操作面板</CardTitle>
                                        <CardDescription>管理规则配置</CardDescription>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {!isEditing ? (
                                        <>
                                            <Button
                                                onClick={handleEdit}
                                                disabled={!displayConfig || configQuery.isLoading}
                                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                                            >
                                                <Edit className="h-4 w-4 mr-2" />
                                                编辑配置
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={handleReload}
                                                disabled={reloadMutation.isPending || configQuery.isLoading}
                                            >
                                                {reloadMutation.isPending ? (
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="h-4 w-4 mr-2" />
                                                )}
                                                重载配置
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={handleCancelEdit}
                                                disabled={updateMutation.isPending}
                                            >
                                                <X className="h-4 w-4 mr-2" />
                                                取消
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                    </Card>
                </div>

                {/* Main Content */}
                {displayConfig && (
                    <div className="space-y-6">
                        {!isEditing ? (
                            <RuleConfigViewer
                                config={displayConfig}
                                onEdit={handleEdit}
                                stats={stats}
                            />
                        ) : (
                            <RuleConfigEditor
                                config={editingConfig || displayConfig}
                                onSave={handleSave}
                                onCancel={handleCancelEdit}
                                isLoading={updateMutation.isPending}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
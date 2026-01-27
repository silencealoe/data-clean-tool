/**
 * Rule Configuration Viewer Component
 * Displays rule configuration in read-only format
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ChevronDown,
    ChevronRight,
    Info,
    Settings,
    List,
    Edit,
    Calendar,
    Hash,
    FileText,
    ToggleLeft,
    ToggleRight
} from 'lucide-react';
import type { RuleConfiguration, FieldRule, ConfigStatsResponse } from '@/types/rule-config';

interface RuleConfigViewerProps {
    config: RuleConfiguration;
    onEdit?: () => void;
    stats?: ConfigStatsResponse;
}

/**
 * Configuration Metadata Display Component
 */
function ConfigMetadata({ metadata, stats }: { metadata: RuleConfiguration['metadata']; stats?: ConfigStatsResponse }) {
    return (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                        <Info className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">配置信息</CardTitle>
                        <CardDescription>规则配置基本信息</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">配置名称:</span>
                            <span className="font-semibold">{metadata.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">版本:</span>
                            <Badge variant="secondary">{metadata.version}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">优先级:</span>
                            <Badge variant="outline">{metadata.priority}</Badge>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {stats && (
                            <>
                                <div className="flex items-center gap-2">
                                    <List className="h-4 w-4 text-gray-500" />
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">字段数:</span>
                                    <Badge variant="outline">{stats.totalFields}</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Settings className="h-4 w-4 text-gray-500" />
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">规则数:</span>
                                    <Badge variant="outline">{stats.totalRules}</Badge>
                                </div>
                                {stats.lastUpdated && (
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-gray-500" />
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">最后更新:</span>
                                        <span className="text-sm">{new Date(stats.lastUpdated).toLocaleString('zh-CN')}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">描述:</span> {metadata.description}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Field Rules Display Component
 */
function FieldRulesDisplay({ fieldRules }: { fieldRules: Record<string, FieldRule[]> }) {
    const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

    const toggleField = (fieldName: string) => {
        const newExpanded = new Set(expandedFields);
        if (newExpanded.has(fieldName)) {
            newExpanded.delete(fieldName);
        } else {
            newExpanded.add(fieldName);
        }
        setExpandedFields(newExpanded);
    };

    const fieldNames = Object.keys(fieldRules);

    return (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                        <List className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">字段规则</CardTitle>
                        <CardDescription>各字段的验证规则配置</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {fieldNames.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        暂无字段规则配置
                    </div>
                ) : (
                    <div className="space-y-3">
                        {fieldNames.map((fieldName) => {
                            const rules = fieldRules[fieldName];
                            const isExpanded = expandedFields.has(fieldName);

                            return (
                                <div key={fieldName} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                                    <button
                                        onClick={() => toggleField(fieldName)}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4 text-gray-500" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-gray-500" />
                                            )}
                                            <span className="font-medium">{fieldName}</span>
                                            <Badge variant="secondary">{rules.length} 个规则</Badge>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 space-y-3">
                                            {rules.map((rule, index) => (
                                                <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-sm">{rule.name}</span>
                                                            <Badge variant="outline" className="text-xs">
                                                                {rule.strategy}
                                                            </Badge>
                                                            {rule.required && (
                                                                <Badge variant="destructive" className="text-xs">
                                                                    必填
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {rule.priority && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                优先级: {rule.priority}
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    {Object.keys(rule.params).length > 0 && (
                                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                                            <span className="font-medium">参数:</span>
                                                            <pre className="mt-1 bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs overflow-x-auto">
                                                                {JSON.stringify(rule.params, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}

                                                    {rule.errorMessage && (
                                                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                                                            <span className="font-medium">错误消息:</span> {rule.errorMessage}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Global Settings Display Component
 */
function GlobalSettingsDisplay({ globalSettings }: { globalSettings: RuleConfiguration['globalSettings'] }) {
    return (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl">
                        <Settings className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">全局设置</CardTitle>
                        <CardDescription>规则引擎全局配置选项</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Settings */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                            基础设置
                        </h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">严格模式</span>
                                <div className="flex items-center gap-2">
                                    {globalSettings.strictMode ? (
                                        <ToggleRight className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <ToggleLeft className="h-5 w-5 text-gray-400" />
                                    )}
                                    <span className="text-sm font-medium">
                                        {globalSettings.strictMode ? '启用' : '禁用'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">错误时继续</span>
                                <div className="flex items-center gap-2">
                                    {globalSettings.continueOnError ? (
                                        <ToggleRight className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <ToggleLeft className="h-5 w-5 text-gray-400" />
                                    )}
                                    <span className="text-sm font-medium">
                                        {globalSettings.continueOnError ? '启用' : '禁用'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">最大错误数</span>
                                <Badge variant="outline">{globalSettings.maxErrors}</Badge>
                            </div>
                        </div>
                    </div>

                    {/* Performance Settings */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                            性能设置
                        </h4>
                        <div className="space-y-3">
                            {globalSettings.enableCaching !== undefined && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">启用缓存</span>
                                    <div className="flex items-center gap-2">
                                        {globalSettings.enableCaching ? (
                                            <ToggleRight className="h-5 w-5 text-green-500" />
                                        ) : (
                                            <ToggleLeft className="h-5 w-5 text-gray-400" />
                                        )}
                                        <span className="text-sm font-medium">
                                            {globalSettings.enableCaching ? '启用' : '禁用'}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {globalSettings.cacheTimeout !== undefined && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">缓存超时</span>
                                    <Badge variant="outline">{globalSettings.cacheTimeout}s</Badge>
                                </div>
                            )}
                            {globalSettings.parallelProcessing !== undefined && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">并行处理</span>
                                    <div className="flex items-center gap-2">
                                        {globalSettings.parallelProcessing ? (
                                            <ToggleRight className="h-5 w-5 text-green-500" />
                                        ) : (
                                            <ToggleLeft className="h-5 w-5 text-gray-400" />
                                        )}
                                        <span className="text-sm font-medium">
                                            {globalSettings.parallelProcessing ? '启用' : '禁用'}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {globalSettings.maxParallelTasks !== undefined && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">最大并行任务</span>
                                    <Badge variant="outline">{globalSettings.maxParallelTasks}</Badge>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Monitoring Settings */}
                    {(globalSettings.logLevel || globalSettings.enablePerformanceMonitoring !== undefined) && (
                        <div className="space-y-4 md:col-span-2">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                                监控设置
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {globalSettings.logLevel && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">日志级别</span>
                                        <Badge variant="secondary">{globalSettings.logLevel.toUpperCase()}</Badge>
                                    </div>
                                )}
                                {globalSettings.enablePerformanceMonitoring !== undefined && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">性能监控</span>
                                        <div className="flex items-center gap-2">
                                            {globalSettings.enablePerformanceMonitoring ? (
                                                <ToggleRight className="h-5 w-5 text-green-500" />
                                            ) : (
                                                <ToggleLeft className="h-5 w-5 text-gray-400" />
                                            )}
                                            <span className="text-sm font-medium">
                                                {globalSettings.enablePerformanceMonitoring ? '启用' : '禁用'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Main Rule Configuration Viewer Component
 */
export function RuleConfigViewer({ config, onEdit, stats }: RuleConfigViewerProps) {
    return (
        <div className="space-y-6">
            {/* Configuration Metadata */}
            <ConfigMetadata metadata={config.metadata} stats={stats} />

            {/* Field Rules */}
            <FieldRulesDisplay fieldRules={config.fieldRules} />

            {/* Global Settings */}
            <GlobalSettingsDisplay globalSettings={config.globalSettings} />

            {/* Edit Button */}
            {onEdit && (
                <div className="text-center pt-4">
                    <Button
                        onClick={onEdit}
                        size="lg"
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                        <Edit className="h-4 w-4 mr-2" />
                        编辑配置
                    </Button>
                </div>
            )}
        </div>
    );
}
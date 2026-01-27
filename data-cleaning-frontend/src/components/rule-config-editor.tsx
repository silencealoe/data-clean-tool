/**
 * Rule Configuration Editor Component
 * Provides form-based editing interface for rule configurations
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Save,
    X,
    Info,
    Settings,
    List,
    Loader2
} from 'lucide-react';
import { MetadataEditor, FieldRulesEditor, GlobalSettingsEditor } from './rule-config-editor-parts';
import type {
    RuleConfiguration
} from '@/types/rule-config';

// Validation schemas
const ruleMetadataSchema = z.object({
    name: z.string().min(1, '配置名称不能为空'),
    description: z.string().min(1, '配置描述不能为空'),
    version: z.string().min(1, '版本号不能为空'),
    priority: z.number().min(0, '优先级不能小于0'),
});

const fieldRuleSchema = z.object({
    name: z.string().min(1, '规则名称不能为空'),
    strategy: z.string().min(1, '验证策略不能为空'),
    params: z.record(z.string(), z.any()),
    required: z.boolean(),
    priority: z.number().optional(),
    errorMessage: z.string().optional(),
});

const globalSettingsSchema = z.object({
    strictMode: z.boolean(),
    continueOnError: z.boolean(),
    maxErrors: z.number().min(1, '最大错误数必须大于0'),
    enableCaching: z.boolean().optional(),
    cacheTimeout: z.number().min(1).optional(),
    parallelProcessing: z.boolean().optional(),
    maxParallelTasks: z.number().min(1).optional(),
    logLevel: z.string().optional(),
    enablePerformanceMonitoring: z.boolean().optional(),
});

const ruleConfigSchema = z.object({
    metadata: ruleMetadataSchema,
    fieldRules: z.record(z.string(), z.array(fieldRuleSchema)),
    globalSettings: globalSettingsSchema,
});

type RuleConfigFormData = z.infer<typeof ruleConfigSchema>;

interface RuleConfigEditorProps {
    config: RuleConfiguration;
    onSave: (config: RuleConfiguration, description?: string) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export function RuleConfigEditor({ config, onSave, onCancel, isLoading = false }: RuleConfigEditorProps) {
    const [saveDescription, setSaveDescription] = useState('');
    const [activeTab, setActiveTab] = useState<'metadata' | 'fieldRules' | 'globalSettings'>('metadata');

    const form = useForm<RuleConfigFormData>({
        resolver: zodResolver(ruleConfigSchema),
        defaultValues: config,
    });

    const { handleSubmit, formState: { errors, isDirty }, reset, watch } = form;

    // Reset form when config changes
    useEffect(() => {
        reset(config);
    }, [config, reset]);

    const handleSave = (data: RuleConfigFormData) => {
        onSave(data as RuleConfiguration, saveDescription || undefined);
    };

    const handleCancel = () => {
        reset(config);
        setSaveDescription('');
        onCancel();
    };

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">编辑规则配置</CardTitle>
                            <CardDescription>修改规则配置参数</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                                disabled={isLoading}
                            >
                                <X className="h-4 w-4 mr-2" />
                                取消
                            </Button>
                            <Button
                                onClick={handleSubmit(handleSave)}
                                disabled={isLoading || !isDirty}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                保存配置
                            </Button>
                        </div>
                    </div>

                    {/* Tab Buttons */}
                    <div className="flex gap-2 mt-4">
                        <Button
                            type="button"
                            variant={activeTab === 'metadata' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveTab('metadata')}
                        >
                            <Info className="h-4 w-4 mr-2" />
                            基本信息
                        </Button>
                        <Button
                            type="button"
                            variant={activeTab === 'fieldRules' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveTab('fieldRules')}
                        >
                            <List className="h-4 w-4 mr-2" />
                            字段规则
                        </Button>
                        <Button
                            type="button"
                            variant={activeTab === 'globalSettings' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveTab('globalSettings')}
                        >
                            <Settings className="h-4 w-4 mr-2" />
                            全局设置
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* Form Content */}
            <form onSubmit={handleSubmit(handleSave)} className="space-y-6">
                {/* Metadata Tab */}
                {activeTab === 'metadata' && (
                    <MetadataEditor form={form} errors={errors.metadata} />
                )}

                {/* Field Rules Tab */}
                {activeTab === 'fieldRules' && (
                    <FieldRulesEditor form={form} errors={errors.fieldRules} />
                )}

                {/* Global Settings Tab */}
                {activeTab === 'globalSettings' && (
                    <GlobalSettingsEditor form={form} errors={errors.globalSettings} />
                )}

                {/* Save Description */}
                <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg">保存说明</CardTitle>
                        <CardDescription>为本次修改添加说明（可选）</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder="描述本次配置修改的内容和原因..."
                            value={saveDescription}
                            onChange={(e) => setSaveDescription(e.target.value)}
                            className="min-h-[80px]"
                        />
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
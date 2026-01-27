/**
 * Simple Rule Configuration Editor Component
 * Provides JSON-based editing interface for rule configurations
 */

import { useState, useEffect } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Save,
    X,
    Settings,
    Loader2
} from 'lucide-react';
import type {
    RuleConfiguration
} from '@/types/rule-config';

interface RuleConfigEditorProps {
    config: RuleConfiguration;
    onSave: (config: RuleConfiguration, description?: string) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export function RuleConfigEditor({ config, onSave, onCancel, isLoading = false }: RuleConfigEditorProps) {
    const [saveDescription, setSaveDescription] = useState('');
    const [editedConfig, setEditedConfig] = useState<RuleConfiguration>(config);
    const [jsonText, setJsonText] = useState<string>(JSON.stringify(config, null, 2));
    const [jsonError, setJsonError] = useState<string>('');

    // Update jsonText when config prop changes
    useEffect(() => {
        setEditedConfig(config);
        setJsonText(JSON.stringify(config, null, 2));
        setJsonError('');
    }, [config]);

    const handleSave = () => {
        onSave(editedConfig, saveDescription || undefined);
    };

    const handleCancel = () => {
        setEditedConfig(config);
        setJsonText(JSON.stringify(config, null, 2));
        setSaveDescription('');
        setJsonError('');
        onCancel();
    };

    const handleJsonChange = (value: string) => {
        setJsonText(value); // Always update the text input
        try {
            const newConfig = JSON.parse(value);
            setEditedConfig(newConfig);
            setJsonError('');
        } catch (error) {
            setJsonError('JSON格式错误');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
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
                                onClick={handleSave}
                                disabled={isLoading || !!jsonError}
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
                </CardHeader>
            </Card>

            {/* JSON Editor */}
            <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                            <Settings className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">配置编辑</CardTitle>
                            <CardDescription>
                                直接编辑JSON配置 {jsonError && <span className="text-red-500">- {jsonError}</span>}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <div className="px-6 pb-6">
                    <Textarea
                        value={jsonText}
                        onChange={(e) => handleJsonChange(e.target.value)}
                        className="min-h-[400px] font-mono text-sm"
                        placeholder="编辑规则配置JSON..."
                    />
                </div>
            </Card>

            {/* Save Description */}
            <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                    <CardTitle className="text-lg">保存说明</CardTitle>
                    <CardDescription>为本次修改添加说明（可选）</CardDescription>
                </CardHeader>
                <div className="px-6 pb-6">
                    <Textarea
                        placeholder="描述本次配置修改的内容和原因..."
                        value={saveDescription}
                        onChange={(e) => setSaveDescription(e.target.value)}
                        className="min-h-[80px]"
                    />
                </div>
            </Card>
        </div>
    );
}
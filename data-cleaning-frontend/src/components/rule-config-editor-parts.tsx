/**
 * Rule Configuration Editor Sub-components
 * Individual form sections for editing different parts of the configuration
 */

import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Plus,
    Trash2,
    Info,
    Settings,
    List,
    AlertCircle,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import { VALIDATION_STRATEGIES, LOG_LEVELS } from '@/types/rule-config';

/**
 * Metadata Editor Component
 */
export function MetadataEditor({ form, errors }: {
    form: UseFormReturn<any>;
    errors?: any;
}) {
    const { register, watch } = form;

    return (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                        <Info className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">配置信息</CardTitle>
                        <CardDescription>编辑规则配置基本信息</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="metadata.name">配置名称 *</Label>
                        <Input
                            id="metadata.name"
                            {...register('metadata.name')}
                            placeholder="输入配置名称"
                        />
                        {errors?.name && (
                            <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <AlertDescription className="text-red-800 dark:text-red-200">
                                    {errors.name.message}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="metadata.version">版本号 *</Label>
                        <Input
                            id="metadata.version"
                            {...register('metadata.version')}
                            placeholder="例如: 1.0.0"
                        />
                        {errors?.version && (
                            <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <AlertDescription className="text-red-800 dark:text-red-200">
                                    {errors.version.message}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="metadata.priority">优先级 *</Label>
                        <Input
                            id="metadata.priority"
                            type="number"
                            {...register('metadata.priority', { valueAsNumber: true })}
                            placeholder="输入优先级数值"
                        />
                        {errors?.priority && (
                            <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <AlertDescription className="text-red-800 dark:text-red-200">
                                    {errors.priority.message}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="metadata.description">配置描述 *</Label>
                    <Textarea
                        id="metadata.description"
                        {...register('metadata.description')}
                        placeholder="描述此配置的用途和特点"
                        className="min-h-[80px]"
                    />
                    {errors?.description && (
                        <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800 dark:text-red-200">
                                {errors.description.message}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
/**
 * Field Rules Editor Component
 */
export function FieldRulesEditor({ form, errors }: {
    form: UseFormReturn<any>;
    errors?: any;
}) {
    const { control, register, watch, setValue } = form;
    const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
    const [newFieldName, setNewFieldName] = useState('');

    const fieldRules = watch('fieldRules') || {};
    const fieldNames = Object.keys(fieldRules);

    const toggleField = (fieldName: string) => {
        const newExpanded = new Set(expandedFields);
        if (newExpanded.has(fieldName)) {
            newExpanded.delete(fieldName);
        } else {
            newExpanded.add(fieldName);
        }
        setExpandedFields(newExpanded);
    };

    const addField = () => {
        if (newFieldName && !fieldRules[newFieldName]) {
            setValue(`fieldRules.${newFieldName}`, []);
            setNewFieldName('');
            setExpandedFields(new Set([...expandedFields, newFieldName]));
        }
    };

    const removeField = (fieldName: string) => {
        const newFieldRules = { ...fieldRules };
        delete newFieldRules[fieldName];
        setValue('fieldRules', newFieldRules);

        const newExpanded = new Set(expandedFields);
        newExpanded.delete(fieldName);
        setExpandedFields(newExpanded);
    };

    const addRule = (fieldName: string) => {
        const currentRules = fieldRules[fieldName] || [];
        const newRule = {
            name: `规则${currentRules.length + 1}`,
            strategy: 'regex',
            params: {},
            required: false,
            priority: 1,
            errorMessage: ''
        };
        setValue(`fieldRules.${fieldName}`, [...currentRules, newRule]);
    };

    const removeRule = (fieldName: string, ruleIndex: number) => {
        const currentRules = fieldRules[fieldName] || [];
        const newRules = currentRules.filter((_: any, index: number) => index !== ruleIndex);
        setValue(`fieldRules.${fieldName}`, newRules);
    };

    return (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                            <List className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">字段规则</CardTitle>
                            <CardDescription>配置各字段的验证规则</CardDescription>
                        </div>
                    </div>

                    {/* Add Field */}
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder="字段名称"
                            value={newFieldName}
                            onChange={(e) => setNewFieldName(e.target.value)}
                            className="w-32"
                        />
                        <Button
                            type="button"
                            onClick={addField}
                            disabled={!newFieldName || fieldRules[newFieldName]}
                            size="sm"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            添加字段
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {fieldNames.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        暂无字段规则，请添加字段
                    </div>
                ) : (
                    <div className="space-y-4">
                        {fieldNames.map((fieldName) => {
                            const rules = fieldRules[fieldName] || [];
                            const isExpanded = expandedFields.has(fieldName);

                            return (
                                <div key={fieldName} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                                    <div className="px-4 py-3 flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={() => toggleField(fieldName)}
                                            className="flex items-center gap-3 hover:text-blue-600 transition-colors"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                            <span className="font-medium">{fieldName}</span>
                                            <Badge variant="secondary">{rules.length} 个规则</Badge>
                                        </button>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => addRule(fieldName)}
                                            >
                                                <Plus className="h-4 w-4 mr-1" />
                                                添加规则
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => removeField(fieldName)}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
                                            {rules.map((rule: any, ruleIndex: number) => (
                                                <RuleEditor
                                                    key={ruleIndex}
                                                    fieldName={fieldName}
                                                    ruleIndex={ruleIndex}
                                                    form={form}
                                                    onRemove={() => removeRule(fieldName, ruleIndex)}
                                                />
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
 * Individual Rule Editor Component
 */
function RuleEditor({ fieldName, ruleIndex, form, onRemove }: {
    fieldName: string;
    ruleIndex: number;
    form: UseFormReturn<any>;
    onRemove: () => void;
}) {
    const { register, watch, setValue } = form;
    const rulePrefix = `fieldRules.${fieldName}.${ruleIndex}`;

    const strategy = watch(`${rulePrefix}.strategy`);
    const params = watch(`${rulePrefix}.params`) || {};

    const updateParams = (newParams: any) => {
        setValue(`${rulePrefix}.params`, newParams);
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="font-medium">规则配置</h4>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRemove}
                    className="text-red-600 hover:text-red-700"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>规则名称</Label>
                    <Input {...register(`${rulePrefix}.name`)} placeholder="规则名称" />
                </div>

                <div className="space-y-2">
                    <Label>验证策略</Label>
                    <Select
                        value={strategy}
                        onValueChange={(value) => setValue(`${rulePrefix}.strategy`, value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="选择验证策略" />
                        </SelectTrigger>
                        <SelectContent>
                            {VALIDATION_STRATEGIES.map((strategy) => (
                                <SelectItem key={strategy.value} value={strategy.value}>
                                    <div>
                                        <div className="font-medium">{strategy.label}</div>
                                        <div className="text-xs text-gray-500">{strategy.description}</div>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>优先级</Label>
                    <Input
                        type="number"
                        {...register(`${rulePrefix}.priority`, { valueAsNumber: true })}
                        placeholder="优先级"
                    />
                </div>

                <div className="flex items-center space-x-2">
                    <Switch
                        checked={watch(`${rulePrefix}.required`)}
                        onCheckedChange={(checked) => setValue(`${rulePrefix}.required`, checked)}
                    />
                    <Label>必填字段</Label>
                </div>
            </div>

            <div className="space-y-2">
                <Label>错误消息</Label>
                <Input {...register(`${rulePrefix}.errorMessage`)} placeholder="自定义错误消息（可选）" />
            </div>

            <div className="space-y-2">
                <Label>策略参数</Label>
                <Textarea
                    value={JSON.stringify(params, null, 2)}
                    onChange={(e) => {
                        try {
                            const newParams = JSON.parse(e.target.value);
                            updateParams(newParams);
                        } catch {
                            // Invalid JSON, ignore
                        }
                    }}
                    placeholder="JSON格式的策略参数"
                    className="font-mono text-sm"
                />
            </div>
        </div>
    );
}
/**
 * Global Settings Editor Component
 */
export function GlobalSettingsEditor({ form, errors }: {
    form: UseFormReturn<any>;
    errors?: any;
}) {
    const { register, watch, setValue } = form;

    return (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl">
                        <Settings className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">全局设置</CardTitle>
                        <CardDescription>配置规则引擎全局参数</CardDescription>
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

                        <div className="flex items-center justify-between">
                            <div>
                                <Label>严格模式</Label>
                                <p className="text-xs text-gray-500">启用严格验证模式</p>
                            </div>
                            <Switch
                                checked={watch('globalSettings.strictMode')}
                                onCheckedChange={(checked) => setValue('globalSettings.strictMode', checked)}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <Label>错误时继续</Label>
                                <p className="text-xs text-gray-500">遇到错误时继续处理</p>
                            </div>
                            <Switch
                                checked={watch('globalSettings.continueOnError')}
                                onCheckedChange={(checked) => setValue('globalSettings.continueOnError', checked)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>最大错误数</Label>
                            <Input
                                type="number"
                                {...register('globalSettings.maxErrors', { valueAsNumber: true })}
                                placeholder="最大错误数"
                            />
                            {errors?.maxErrors && (
                                <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                    <AlertDescription className="text-red-800 dark:text-red-200">
                                        {errors.maxErrors.message}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </div>

                    {/* Performance Settings */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                            性能设置
                        </h4>

                        <div className="flex items-center justify-between">
                            <div>
                                <Label>启用缓存</Label>
                                <p className="text-xs text-gray-500">启用结果缓存机制</p>
                            </div>
                            <Switch
                                checked={watch('globalSettings.enableCaching') || false}
                                onCheckedChange={(checked) => setValue('globalSettings.enableCaching', checked)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>缓存超时（秒）</Label>
                            <Input
                                type="number"
                                {...register('globalSettings.cacheTimeout', { valueAsNumber: true })}
                                placeholder="缓存超时时间"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <Label>并行处理</Label>
                                <p className="text-xs text-gray-500">启用并行处理</p>
                            </div>
                            <Switch
                                checked={watch('globalSettings.parallelProcessing') || false}
                                onCheckedChange={(checked) => setValue('globalSettings.parallelProcessing', checked)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>最大并行任务数</Label>
                            <Input
                                type="number"
                                {...register('globalSettings.maxParallelTasks', { valueAsNumber: true })}
                                placeholder="最大并行任务数"
                            />
                        </div>
                    </div>

                    {/* Monitoring Settings */}
                    <div className="space-y-4 md:col-span-2">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                            监控设置
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>日志级别</Label>
                                <Select
                                    value={watch('globalSettings.logLevel') || ''}
                                    onValueChange={(value) => setValue('globalSettings.logLevel', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="选择日志级别" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LOG_LEVELS.map((level) => (
                                            <SelectItem key={level.value} value={level.value}>
                                                {level.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>性能监控</Label>
                                    <p className="text-xs text-gray-500">启用性能监控</p>
                                </div>
                                <Switch
                                    checked={watch('globalSettings.enablePerformanceMonitoring') || false}
                                    onCheckedChange={(checked) => setValue('globalSettings.enablePerformanceMonitoring', checked)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
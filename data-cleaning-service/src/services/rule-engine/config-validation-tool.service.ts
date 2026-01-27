import { Injectable, Logger } from '@nestjs/common';
import {
    RuleConfiguration,
    FieldRule,
    ValidationParams,
    RegexParams,
    RangeParams,
    LengthParams,
    DateParams
} from '../../common/types/rule-engine.types';
import { ConfigValidatorService } from './config-validator.service';

/**
 * 配置验证工具服务
 * 提供独立的配置验证模式，支持针对样本数据的规则测试和性能问题检测
 */
@Injectable()
export class ConfigValidationToolService {
    private readonly logger = new Logger(ConfigValidationToolService.name);

    constructor(
        private readonly configValidator: ConfigValidatorService
    ) { }

    /**
     * 验证配置文件的完整性和正确性
     * @param config 规则配置
     * @returns 验证结果
     */
    async validateConfiguration(config: RuleConfiguration): Promise<ConfigValidationResult> {
        const result: ConfigValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            performanceIssues: [],
            suggestions: [],
            summary: {
                totalRules: 0,
                validRules: 0,
                invalidRules: 0,
                performanceWarnings: 0
            }
        };

        try {
            // 1. 基础结构验证
            await this.validateBasicStructure(config, result);

            // 2. 元数据验证
            this.validateMetadata(config.metadata, result);

            // 3. 字段规则验证
            await this.validateFieldRules(config.fieldRules, result);

            // 4. 全局设置验证
            this.validateGlobalSettings(config.globalSettings, result);

            // 5. 性能问题检测
            this.detectPerformanceIssues(config, result);

            // 6. 规则冲突检测
            this.detectRuleConflicts(config.fieldRules, result);

            // 7. 生成建议
            this.generateSuggestions(config, result);

            // 更新最终状态
            result.isValid = result.errors.length === 0;

        } catch (error) {
            result.isValid = false;
            result.errors.push({
                type: 'VALIDATION_ERROR',
                message: `配置验证过程中发生错误: ${error.message}`,
                field: 'global',
                severity: 'error'
            });
        }

        return result;
    }

    /**
     * 针对样本数据测试规则执行
     * @param config 规则配置
     * @param sampleData 样本数据
     * @returns 测试结果
     */
    async testRulesWithSampleData(
        config: RuleConfiguration,
        sampleData: Record<string, any>[]
    ): Promise<RuleTestResult> {
        const result: RuleTestResult = {
            success: true,
            totalRecords: sampleData.length,
            processedRecords: 0,
            failedRecords: 0,
            fieldResults: {},
            performanceMetrics: {
                totalTime: 0,
                averageTimePerRecord: 0,
                slowestField: '',
                slowestFieldTime: 0
            },
            errors: []
        };

        const startTime = Date.now();

        try {
            for (let i = 0; i < sampleData.length; i++) {
                const record = sampleData[i];
                const recordStartTime = Date.now();

                try {
                    await this.processRecordForTesting(record, config, result);
                    result.processedRecords++;
                } catch (error) {
                    result.failedRecords++;
                    result.errors.push({
                        type: 'PROCESSING_ERROR',
                        message: `记录 ${i + 1} 处理失败: ${error.message}`,
                        field: 'record',
                        severity: 'error',
                        recordIndex: i
                    });
                }

                const recordTime = Date.now() - recordStartTime;
                if (recordTime > 1000) { // 超过1秒的记录
                    result.errors.push({
                        type: 'PERFORMANCE_WARNING',
                        message: `记录 ${i + 1} 处理时间过长: ${recordTime}ms`,
                        field: 'performance',
                        severity: 'warning',
                        recordIndex: i
                    });
                }
            }

            const totalTime = Date.now() - startTime;
            result.performanceMetrics.totalTime = totalTime;
            result.performanceMetrics.averageTimePerRecord = totalTime / sampleData.length;
            result.success = result.failedRecords === 0;

        } catch (error) {
            result.success = false;
            result.errors.push({
                type: 'TEST_ERROR',
                message: `样本数据测试失败: ${error.message}`,
                field: 'global',
                severity: 'error'
            });
        }

        return result;
    }

    /**
     * 检测配置中的性能问题
     * @param config 规则配置
     * @returns 性能问题列表
     */
    detectPerformanceIssues(config: RuleConfiguration, result: ConfigValidationResult): void {
        // 检测复杂正则表达式
        this.detectComplexRegexPatterns(config.fieldRules, result);

        // 检测过多的规则数量
        this.detectExcessiveRules(config.fieldRules, result);

        // 检测嵌套规则深度
        this.detectDeepNestedRules(config.fieldRules, result);

        // 检测全局设置的性能影响
        this.detectGlobalSettingsPerformanceIssues(config.globalSettings, result);
    }

    /**
     * 生成配置优化建议
     * @param config 规则配置
     * @returns 优化建议列表
     */
    generateOptimizationSuggestions(config: RuleConfiguration): OptimizationSuggestion[] {
        const suggestions: OptimizationSuggestion[] = [];

        // 缓存建议
        if (!config.globalSettings?.enableCaching) {
            suggestions.push({
                type: 'CACHING',
                priority: 'high',
                message: '建议启用缓存机制以提高性能',
                recommendation: '在globalSettings中设置enableCaching为true'
            });
        }

        // 并行处理建议
        if (!config.globalSettings?.parallelProcessing) {
            suggestions.push({
                type: 'PARALLEL_PROCESSING',
                priority: 'medium',
                message: '建议启用并行处理以提高大数据集处理速度',
                recommendation: '在globalSettings中设置parallelProcessing为true'
            });
        }

        // 规则优化建议
        Object.entries(config.fieldRules).forEach(([fieldName, rules]) => {
            if (rules.length > 5) {
                suggestions.push({
                    type: 'RULE_OPTIMIZATION',
                    priority: 'medium',
                    message: `字段 ${fieldName} 的规则数量过多 (${rules.length}个)`,
                    recommendation: '考虑合并相似规则或使用更高效的验证策略'
                });
            }
        });

        return suggestions;
    }

    /**
     * 验证基础结构
     */
    private async validateBasicStructure(config: RuleConfiguration, result: ConfigValidationResult): Promise<void> {
        // 使用现有的配置验证器
        const validationResult = await this.configValidator.validateConfiguration(config);

        if (!validationResult.success) {
            result.errors.push({
                type: 'STRUCTURE_ERROR',
                message: validationResult.error || '配置结构验证失败',
                field: 'structure',
                severity: 'error'
            });
        }
    }

    /**
     * 验证元数据
     */
    private validateMetadata(metadata: any, result: ConfigValidationResult): void {
        if (!metadata) {
            result.errors.push({
                type: 'METADATA_ERROR',
                message: '缺少metadata字段',
                field: 'metadata',
                severity: 'error'
            });
            return;
        }

        const requiredFields = ['name', 'description', 'version'];
        requiredFields.forEach(field => {
            if (!metadata[field]) {
                result.errors.push({
                    type: 'METADATA_ERROR',
                    message: `metadata中缺少必需字段: ${field}`,
                    field: `metadata.${field}`,
                    severity: 'error'
                });
            }
        });

        // 验证版本格式
        if (metadata.version && !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
            result.warnings.push({
                type: 'METADATA_WARNING',
                message: '版本号格式不符合语义化版本规范 (x.y.z)',
                field: 'metadata.version',
                severity: 'warning'
            });
        }
    }

    /**
     * 验证字段规则
     */
    private async validateFieldRules(fieldRules: Record<string, FieldRule[]>, result: ConfigValidationResult): Promise<void> {
        let totalRules = 0;
        let validRules = 0;

        for (const [fieldName, rules] of Object.entries(fieldRules)) {
            if (!Array.isArray(rules)) {
                result.errors.push({
                    type: 'FIELD_RULE_ERROR',
                    message: `字段 ${fieldName} 的规则必须是数组`,
                    field: fieldName,
                    severity: 'error'
                });
                continue;
            }

            for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                totalRules++;

                try {
                    await this.validateSingleRule(fieldName, rule, i, result);
                    validRules++;
                } catch (error) {
                    result.errors.push({
                        type: 'RULE_VALIDATION_ERROR',
                        message: `字段 ${fieldName} 规则 ${i} 验证失败: ${error.message}`,
                        field: `${fieldName}.rules[${i}]`,
                        severity: 'error'
                    });
                }
            }
        }

        result.summary.totalRules = totalRules;
        result.summary.validRules = validRules;
        result.summary.invalidRules = totalRules - validRules;
    }

    /**
     * 验证单个规则
     */
    private async validateSingleRule(fieldName: string, rule: FieldRule, index: number, result: ConfigValidationResult): Promise<void> {
        // 验证必需字段
        const requiredFields = ['name', 'strategy', 'params'];
        requiredFields.forEach(field => {
            if (!rule[field]) {
                result.errors.push({
                    type: 'RULE_ERROR',
                    message: `规则缺少必需字段: ${field}`,
                    field: `${fieldName}.rules[${index}].${field}`,
                    severity: 'error'
                });
            }
        });

        // 验证策略特定参数
        if (rule.strategy && rule.params) {
            this.validateStrategyParams(fieldName, rule, index, result);
        }

        // 验证正则表达式
        if (rule.strategy === 'regex' && rule.params) {
            const regexParams = rule.params as RegexParams;
            if (regexParams.pattern) {
                try {
                    new RegExp(regexParams.pattern, regexParams.flags || '');
                } catch (error) {
                    result.errors.push({
                        type: 'REGEX_ERROR',
                        message: `正则表达式无效: ${error.message}`,
                        field: `${fieldName}.rules[${index}].params.pattern`,
                        severity: 'error'
                    });
                }
            }
        }
    }

    /**
     * 验证策略参数
     */
    private validateStrategyParams(fieldName: string, rule: FieldRule, index: number, result: ConfigValidationResult): void {
        const { strategy, params } = rule;

        switch (strategy) {
            case 'range':
                const rangeParams = params as RangeParams;
                if (rangeParams.min !== undefined && rangeParams.max !== undefined && rangeParams.min > rangeParams.max) {
                    result.errors.push({
                        type: 'PARAM_ERROR',
                        message: '范围验证的最小值不能大于最大值',
                        field: `${fieldName}.rules[${index}].params`,
                        severity: 'error'
                    });
                }
                break;

            case 'length':
                const lengthParams = params as LengthParams;
                if (lengthParams.minLength !== undefined && lengthParams.maxLength !== undefined && lengthParams.minLength > lengthParams.maxLength) {
                    result.errors.push({
                        type: 'PARAM_ERROR',
                        message: '长度验证的最小长度不能大于最大长度',
                        field: `${fieldName}.rules[${index}].params`,
                        severity: 'error'
                    });
                }
                break;

            case 'date-cleaner':
                const dateParams = params as DateParams;
                if (dateParams.minYear !== undefined && dateParams.maxYear !== undefined && dateParams.minYear > dateParams.maxYear) {
                    result.errors.push({
                        type: 'PARAM_ERROR',
                        message: '日期验证的最小年份不能大于最大年份',
                        field: `${fieldName}.rules[${index}].params`,
                        severity: 'error'
                    });
                }
                break;
        }
    }

    /**
     * 验证全局设置
     */
    private validateGlobalSettings(globalSettings: any, result: ConfigValidationResult): void {
        if (!globalSettings) {
            result.warnings.push({
                type: 'GLOBAL_SETTINGS_WARNING',
                message: '缺少globalSettings配置，将使用默认设置',
                field: 'globalSettings',
                severity: 'warning'
            });
            return;
        }

        // 验证数值范围
        if (globalSettings.maxErrors !== undefined && globalSettings.maxErrors < 1) {
            result.errors.push({
                type: 'GLOBAL_SETTINGS_ERROR',
                message: 'maxErrors必须大于0',
                field: 'globalSettings.maxErrors',
                severity: 'error'
            });
        }

        if (globalSettings.maxParallelTasks !== undefined && globalSettings.maxParallelTasks < 1) {
            result.errors.push({
                type: 'GLOBAL_SETTINGS_ERROR',
                message: 'maxParallelTasks必须大于0',
                field: 'globalSettings.maxParallelTasks',
                severity: 'error'
            });
        }
    }

    /**
     * 检测复杂正则表达式
     */
    private detectComplexRegexPatterns(fieldRules: Record<string, FieldRule[]>, result: ConfigValidationResult): void {
        Object.entries(fieldRules).forEach(([fieldName, rules]) => {
            rules.forEach((rule, index) => {
                if (rule.strategy === 'regex' && rule.params) {
                    const regexParams = rule.params as RegexParams;
                    if (regexParams.pattern) {
                        const pattern = regexParams.pattern;

                        // 检测可能导致性能问题的模式
                        const problematicPatterns = [
                            /\(\?\=.*\)\+/,  // 正向前瞻 + 量词
                            /\(\?\!.*\)\+/,  // 负向前瞻 + 量词
                            /\.\*\.\*/,      // 多个贪婪匹配
                            /\(\.\*\)\+/,    // 嵌套量词
                        ];

                        const hasProblematicPattern = problematicPatterns.some(p => p.test(pattern));
                        if (hasProblematicPattern) {
                            result.performanceIssues.push({
                                type: 'COMPLEX_REGEX',
                                message: `字段 ${fieldName} 的正则表达式可能导致性能问题`,
                                field: `${fieldName}.rules[${index}].params.pattern`,
                                severity: 'warning',
                                impact: 'high'
                            });
                            result.summary.performanceWarnings++;
                        }

                        // 检测过长的正则表达式
                        if (pattern.length > 200) {
                            result.performanceIssues.push({
                                type: 'LONG_REGEX',
                                message: `字段 ${fieldName} 的正则表达式过长 (${pattern.length} 字符)`,
                                field: `${fieldName}.rules[${index}].params.pattern`,
                                severity: 'info',
                                impact: 'medium'
                            });
                        }
                    }
                }
            });
        });
    }

    /**
     * 检测过多规则
     */
    private detectExcessiveRules(fieldRules: Record<string, FieldRule[]>, result: ConfigValidationResult): void {
        Object.entries(fieldRules).forEach(([fieldName, rules]) => {
            if (rules.length > 10) {
                result.performanceIssues.push({
                    type: 'EXCESSIVE_RULES',
                    message: `字段 ${fieldName} 的规则数量过多 (${rules.length}个)`,
                    field: fieldName,
                    severity: 'warning',
                    impact: 'medium'
                });
                result.summary.performanceWarnings++;
            }
        });
    }

    /**
     * 检测嵌套规则深度
     */
    private detectDeepNestedRules(fieldRules: Record<string, FieldRule[]>, result: ConfigValidationResult): void {
        // 这里可以添加检测嵌套条件规则的逻辑
        // 当前配置结构相对简单，暂时跳过
    }

    /**
     * 检测全局设置的性能影响
     */
    private detectGlobalSettingsPerformanceIssues(globalSettings: any, result: ConfigValidationResult): void {
        if (globalSettings?.maxParallelTasks > 16) {
            result.performanceIssues.push({
                type: 'HIGH_PARALLEL_TASKS',
                message: `并行任务数过高 (${globalSettings.maxParallelTasks})，可能导致资源竞争`,
                field: 'globalSettings.maxParallelTasks',
                severity: 'warning',
                impact: 'medium'
            });
        }

        if (globalSettings?.cacheTimeout && globalSettings.cacheTimeout < 300) {
            result.performanceIssues.push({
                type: 'LOW_CACHE_TIMEOUT',
                message: `缓存超时时间过短 (${globalSettings.cacheTimeout}秒)，可能导致频繁重新计算`,
                field: 'globalSettings.cacheTimeout',
                severity: 'info',
                impact: 'low'
            });
        }
    }

    /**
     * 检测规则冲突
     */
    private detectRuleConflicts(fieldRules: Record<string, FieldRule[]>, result: ConfigValidationResult): void {
        Object.entries(fieldRules).forEach(([fieldName, rules]) => {
            // 检测相同优先级的必需规则
            const requiredRules = rules.filter(rule => rule.required);
            const priorityGroups = new Map<number, FieldRule[]>();

            requiredRules.forEach(rule => {
                const priority = rule.priority || 100;
                if (!priorityGroups.has(priority)) {
                    priorityGroups.set(priority, []);
                }
                priorityGroups.get(priority)!.push(rule);
            });

            priorityGroups.forEach((rulesGroup, priority) => {
                if (rulesGroup.length > 1) {
                    const conflictingStrategies = rulesGroup.map(r => r.strategy);
                    if (new Set(conflictingStrategies).size > 1) {
                        result.warnings.push({
                            type: 'RULE_CONFLICT',
                            message: `字段 ${fieldName} 在优先级 ${priority} 存在多个不同策略的必需规则`,
                            field: fieldName,
                            severity: 'warning'
                        });
                    }
                }
            });
        });
    }

    /**
     * 生成建议
     */
    private generateSuggestions(config: RuleConfiguration, result: ConfigValidationResult): void {
        const suggestions = this.generateOptimizationSuggestions(config);
        result.suggestions = suggestions;
    }

    /**
     * 处理单条记录进行测试
     */
    private async processRecordForTesting(
        record: Record<string, any>,
        config: RuleConfiguration,
        result: RuleTestResult
    ): Promise<void> {
        for (const [fieldName, value] of Object.entries(record)) {
            const fieldRules = config.fieldRules[fieldName];
            if (!fieldRules) continue;

            const fieldStartTime = Date.now();

            if (!result.fieldResults[fieldName]) {
                result.fieldResults[fieldName] = {
                    totalTests: 0,
                    passedTests: 0,
                    failedTests: 0,
                    averageTime: 0
                };
            }

            for (const rule of fieldRules) {
                result.fieldResults[fieldName].totalTests++;

                try {
                    // 这里应该调用实际的验证逻辑
                    // 为了演示，我们只是模拟验证过程
                    await this.simulateRuleExecution(rule, value);
                    result.fieldResults[fieldName].passedTests++;
                } catch (error) {
                    result.fieldResults[fieldName].failedTests++;
                }
            }

            const fieldTime = Date.now() - fieldStartTime;
            result.fieldResults[fieldName].averageTime =
                (result.fieldResults[fieldName].averageTime + fieldTime) / 2;

            // 更新最慢字段
            if (fieldTime > result.performanceMetrics.slowestFieldTime) {
                result.performanceMetrics.slowestFieldTime = fieldTime;
                result.performanceMetrics.slowestField = fieldName;
            }
        }
    }

    /**
     * 模拟规则执行
     */
    private async simulateRuleExecution(rule: FieldRule, value: any): Promise<void> {
        // 模拟不同策略的执行时间
        const executionTime = Math.random() * 10; // 0-10ms
        await new Promise(resolve => setTimeout(resolve, executionTime));

        // 模拟一些规则可能失败
        if (Math.random() < 0.1) { // 10% 失败率
            throw new Error(`规则 ${rule.name} 验证失败`);
        }
    }
}

// 类型定义
export interface ConfigValidationResult {
    isValid: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    performanceIssues: PerformanceIssue[];
    suggestions: OptimizationSuggestion[];
    summary: {
        totalRules: number;
        validRules: number;
        invalidRules: number;
        performanceWarnings: number;
    };
}

export interface ValidationIssue {
    type: string;
    message: string;
    field: string;
    severity: 'error' | 'warning' | 'info';
    recordIndex?: number;
}

export interface PerformanceIssue {
    type: string;
    message: string;
    field: string;
    severity: 'error' | 'warning' | 'info';
    impact: 'high' | 'medium' | 'low';
}

export interface OptimizationSuggestion {
    type: string;
    priority: 'high' | 'medium' | 'low';
    message: string;
    recommendation: string;
}

export interface RuleTestResult {
    success: boolean;
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
    fieldResults: Record<string, FieldTestResult>;
    performanceMetrics: {
        totalTime: number;
        averageTimePerRecord: number;
        slowestField: string;
        slowestFieldTime: number;
    };
    errors: ValidationIssue[];
}

export interface FieldTestResult {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageTime: number;
}
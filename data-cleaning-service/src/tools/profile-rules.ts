#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ConfigValidationToolService } from '../services/rule-engine/config-validation-tool.service';
import { RuleConfiguration } from '../common/types/rule-engine.types';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

/**
 * 规则性能分析工具
 * 用于分析规则执行性能，检测性能瓶颈
 */
class RuleProfiler {
    private validationService: ConfigValidationToolService;

    async initialize() {
        const app = await NestFactory.createApplicationContext(AppModule, {
            logger: false
        });
        this.validationService = app.get(ConfigValidationToolService);
        return app;
    }

    /**
     * 分析规则性能
     */
    async profileRules(configPath: string, dataPath?: string): Promise<void> {
        try {
            console.log(`🔍 分析规则性能: ${configPath}`);
            if (dataPath) {
                console.log(`📊 使用数据文件: ${dataPath}`);
            }
            console.log('='.repeat(50));

            // 读取配置文件
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const config: RuleConfiguration = JSON.parse(configContent);

            // 基础性能分析
            await this.analyzeConfigPerformance(config);

            // 如果提供了数据文件，进行实际执行分析
            if (dataPath) {
                const sampleData = await this.readSampleData(dataPath);
                await this.analyzeExecutionPerformance(config, sampleData);
            }

        } catch (error) {
            console.error(`❌ 性能分析失败: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * 分析配置性能特征
     */
    private async analyzeConfigPerformance(config: RuleConfiguration): Promise<void> {
        console.log(`📋 配置性能分析:`);

        const stats = {
            totalFields: Object.keys(config.fieldRules).length,
            totalRules: 0,
            regexRules: 0,
            complexRegexRules: 0,
            rangeRules: 0,
            lengthRules: 0,
            customRules: 0,
            averageRulesPerField: 0,
            maxRulesPerField: 0,
            minRulesPerField: Infinity
        };

        // 分析规则统计
        Object.entries(config.fieldRules).forEach(([fieldName, rules]) => {
            stats.totalRules += rules.length;
            stats.maxRulesPerField = Math.max(stats.maxRulesPerField, rules.length);
            stats.minRulesPerField = Math.min(stats.minRulesPerField, rules.length);

            rules.forEach(rule => {
                switch (rule.strategy) {
                    case 'regex':
                        stats.regexRules++;
                        const regexParams = rule.params as any;
                        if (regexParams?.pattern && this.isComplexRegex(regexParams.pattern)) {
                            stats.complexRegexRules++;
                        }
                        break;
                    case 'range':
                        stats.rangeRules++;
                        break;
                    case 'length':
                        stats.lengthRules++;
                        break;
                    default:
                        stats.customRules++;
                        break;
                }
            });
        });

        stats.averageRulesPerField = stats.totalRules / stats.totalFields;
        if (stats.minRulesPerField === Infinity) stats.minRulesPerField = 0;

        // 输出统计信息
        console.log(`   字段数量: ${stats.totalFields}`);
        console.log(`   规则总数: ${stats.totalRules}`);
        console.log(`   平均每字段规则数: ${stats.averageRulesPerField.toFixed(1)}`);
        console.log(`   最多规则字段: ${stats.maxRulesPerField} 个规则`);
        console.log(`   最少规则字段: ${stats.minRulesPerField} 个规则`);
        console.log(`\n📊 规则类型分布:`);
        console.log(`   正则表达式规则: ${stats.regexRules} (${((stats.regexRules / stats.totalRules) * 100).toFixed(1)}%)`);
        console.log(`   复杂正则规则: ${stats.complexRegexRules} (${((stats.complexRegexRules / stats.totalRules) * 100).toFixed(1)}%)`);
        console.log(`   范围验证规则: ${stats.rangeRules} (${((stats.rangeRules / stats.totalRules) * 100).toFixed(1)}%)`);
        console.log(`   长度验证规则: ${stats.lengthRules} (${((stats.lengthRules / stats.totalRules) * 100).toFixed(1)}%)`);
        console.log(`   自定义规则: ${stats.customRules} (${((stats.customRules / stats.totalRules) * 100).toFixed(1)}%)`);

        // 性能预警
        console.log(`\n⚠️  性能预警:`);
        if (stats.complexRegexRules > 0) {
            console.log(`   🔴 发现 ${stats.complexRegexRules} 个复杂正则表达式，可能影响性能`);
        }
        if (stats.maxRulesPerField > 10) {
            console.log(`   🟡 某些字段规则过多 (最多 ${stats.maxRulesPerField} 个)，建议优化`);
        }
        if (stats.totalRules > 100) {
            console.log(`   🟡 规则总数较多 (${stats.totalRules} 个)，建议启用缓存`);
        }

        // 缓存建议
        const cacheEnabled = config.globalSettings?.enableCaching;
        const parallelEnabled = config.globalSettings?.parallelProcessing;

        console.log(`\n💡 性能优化建议:`);
        if (!cacheEnabled) {
            console.log(`   • 启用缓存机制 (enableCaching: true)`);
        }
        if (!parallelEnabled && stats.totalFields > 5) {
            console.log(`   • 启用并行处理 (parallelProcessing: true)`);
        }
        if (stats.complexRegexRules > 0) {
            console.log(`   • 优化复杂正则表达式，考虑使用更简单的验证策略`);
        }
    }

    /**
     * 分析执行性能
     */
    private async analyzeExecutionPerformance(config: RuleConfiguration, sampleData: Record<string, any>[]): Promise<void> {
        console.log(`\n🚀 执行性能分析:`);
        console.log(`   样本数据: ${sampleData.length} 条记录`);

        // 执行性能测试
        const result = await this.validationService.testRulesWithSampleData(config, sampleData);

        console.log(`\n⏱️  整体性能指标:`);
        console.log(`   总耗时: ${result.performanceMetrics.totalTime}ms`);
        console.log(`   平均每条记录: ${result.performanceMetrics.averageTimePerRecord.toFixed(2)}ms`);
        console.log(`   处理速度: ${(sampleData.length / (result.performanceMetrics.totalTime / 1000)).toFixed(0)} 记录/秒`);

        // 字段性能分析
        console.log(`\n📊 字段性能排行:`);
        const fieldPerformance = Object.entries(result.fieldResults)
            .map(([fieldName, fieldResult]: [string, any]) => ({
                fieldName,
                averageTime: fieldResult.averageTime,
                totalTests: fieldResult.totalTests,
                successRate: (fieldResult.passedTests / fieldResult.totalTests) * 100
            }))
            .sort((a, b) => b.averageTime - a.averageTime);

        fieldPerformance.slice(0, 10).forEach((field, index) => {
            const timeIndicator = field.averageTime > 10 ? '🔴' : field.averageTime > 5 ? '🟡' : '🟢';
            console.log(`   ${index + 1}. ${timeIndicator} ${field.fieldName}: ${field.averageTime.toFixed(2)}ms (成功率: ${field.successRate.toFixed(1)}%)`);
        });

        // 性能瓶颈分析
        console.log(`\n🐌 性能瓶颈分析:`);
        const slowFields = fieldPerformance.filter(field => field.averageTime > 10);
        if (slowFields.length > 0) {
            console.log(`   发现 ${slowFields.length} 个慢字段 (>10ms):`);
            slowFields.forEach(field => {
                console.log(`     • ${field.fieldName}: ${field.averageTime.toFixed(2)}ms`);
                this.analyzeSingleFieldPerformance(config.fieldRules[field.fieldName], field.fieldName);
            });
        } else {
            console.log(`   ✅ 未发现明显的性能瓶颈`);
        }

        // 错误率分析
        console.log(`\n❌ 错误率分析:`);
        const errorRate = (result.failedRecords / result.totalRecords) * 100;
        console.log(`   整体错误率: ${errorRate.toFixed(1)}%`);

        const highErrorFields = fieldPerformance.filter(field => field.successRate < 90);
        if (highErrorFields.length > 0) {
            console.log(`   高错误率字段 (<90%):`);
            highErrorFields.forEach(field => {
                console.log(`     • ${field.fieldName}: ${(100 - field.successRate).toFixed(1)}% 错误率`);
            });
        }

        // 性能建议
        this.generatePerformanceRecommendations(result, config);
    }

    /**
     * 分析单个字段性能
     */
    private analyzeSingleFieldPerformance(rules: any[], fieldName: string): void {
        console.log(`       规则分析:`);
        rules.forEach((rule, index) => {
            let complexity = '🟢';
            let reason = '';

            if (rule.strategy === 'regex') {
                const regexParams = rule.params as any;
                if (regexParams?.pattern && this.isComplexRegex(regexParams.pattern)) {
                    complexity = '🔴';
                    reason = '复杂正则表达式';
                } else if (regexParams?.pattern?.length > 50) {
                    complexity = '🟡';
                    reason = '长正则表达式';
                }
            } else if (rule.strategy === 'phone-cleaner' || rule.strategy === 'address-cleaner') {
                complexity = '🟡';
                reason = '自定义清洗逻辑';
            }

            console.log(`         ${index + 1}. ${complexity} ${rule.strategy} - ${rule.name} ${reason ? `(${reason})` : ''}`);
        });
    }

    /**
     * 生成性能建议
     */
    private generatePerformanceRecommendations(result: any, config: RuleConfiguration): void {
        console.log(`\n💡 性能优化建议:`);

        const recommendations: string[] = [];

        // 基于执行时间的建议
        if (result.performanceMetrics.averageTimePerRecord > 50) {
            recommendations.push('整体处理速度较慢，建议启用并行处理和缓存');
        }

        // 基于错误率的建议
        const errorRate = (result.failedRecords / result.totalRecords) * 100;
        if (errorRate > 10) {
            recommendations.push('错误率较高，建议检查规则配置和数据质量');
        }

        // 基于字段性能的建议
        const slowFields = Object.entries(result.fieldResults)
            .filter(([_, fieldResult]: [string, any]) => fieldResult.averageTime > 10);

        if (slowFields.length > 0) {
            recommendations.push(`优化慢字段: ${slowFields.map(([name]) => name).join(', ')}`);
        }

        // 基于配置的建议
        if (!config.globalSettings?.enableCaching) {
            recommendations.push('启用缓存机制以提高重复验证性能');
        }

        if (!config.globalSettings?.parallelProcessing && Object.keys(config.fieldRules).length > 5) {
            recommendations.push('启用并行处理以提高多字段验证性能');
        }

        if (recommendations.length === 0) {
            console.log(`   ✅ 性能表现良好，暂无优化建议`);
        } else {
            recommendations.forEach((rec, index) => {
                console.log(`   ${index + 1}. ${rec}`);
            });
        }
    }

    /**
     * 判断是否为复杂正则表达式
     */
    private isComplexRegex(pattern: string): boolean {
        if (!pattern) return false;

        const complexPatterns = [
            /\(\?\=/,        // 正向前瞻
            /\(\?\!/,        // 负向前瞻
            /\(\?\<=/,       // 正向后瞻
            /\(\?\<!/,       // 负向后瞻
            /\.\*\.\*/,      // 多个贪婪匹配
            /\(\.\*\)\+/,    // 嵌套量词
            /\{.*,.*\}/,     // 复杂量词
        ];

        return complexPatterns.some(p => p.test(pattern)) || pattern.length > 100;
    }

    /**
     * 读取样本数据
     */
    private async readSampleData(dataPath: string): Promise<Record<string, any>[]> {
        const ext = path.extname(dataPath).toLowerCase();

        if (ext === '.json') {
            const content = fs.readFileSync(dataPath, 'utf-8');
            return JSON.parse(content);
        } else if (ext === '.csv') {
            return new Promise((resolve, reject) => {
                const results: Record<string, any>[] = [];
                fs.createReadStream(dataPath)
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', () => resolve(results))
                    .on('error', reject);
            });
        } else {
            throw new Error(`不支持的数据文件格式: ${ext}`);
        }
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        printUsage();
        process.exit(1);
    }

    const configPath = args[0];
    const dataPath = args[1]; // 可选

    const profiler = new RuleProfiler();
    const app = await profiler.initialize();

    try {
        await profiler.profileRules(configPath, dataPath);
    } finally {
        await app.close();
    }
}

function printUsage() {
    console.log(`
🔍 规则性能分析工具使用说明

用法:
  npm run profile-rules <config-file> [data-file]

参数:
  config-file    规则配置文件路径 (必需)
  data-file      样本数据文件路径 (可选，用于实际执行分析)

示例:
  npm run profile-rules ./src/config/rule-engine/default-rules.json
  npm run profile-rules ./src/config/rule-engine/default-rules.json ./test-data/sample.csv

支持的数据文件格式:
  - JSON (.json)
  - CSV (.csv)

分析内容:
  - 配置复杂度分析
  - 规则类型分布
  - 性能瓶颈检测
  - 执行时间分析 (需要数据文件)
  - 优化建议生成
`);
}

// 运行主函数
if (require.main === module) {
    main().catch(error => {
        console.error('❌ 性能分析失败:', error.message);
        process.exit(1);
    });
}

export { RuleProfiler };
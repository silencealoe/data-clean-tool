#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ConfigValidationToolService } from '../services/rule-engine/config-validation-tool.service';
import { RuleConfiguration } from '../common/types/rule-engine.types';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

/**
 * 配置验证命令行工具
 * 用于验证规则配置文件和测试规则执行
 */
class ConfigValidationCLI {
    private validationService: ConfigValidationToolService;

    async initialize() {
        const app = await NestFactory.createApplicationContext(AppModule, {
            logger: false
        });
        this.validationService = app.get(ConfigValidationToolService);
        return app;
    }

    /**
     * 验证配置文件
     */
    async validateConfigFile(configPath: string): Promise<void> {
        try {
            console.log(`🔍 验证配置文件: ${configPath}`);
            console.log('='.repeat(50));

            // 读取配置文件
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const config: RuleConfiguration = JSON.parse(configContent);

            // 执行验证
            const result = await this.validationService.validateConfiguration(config);

            // 输出结果
            this.printValidationResult(result);

            if (!result.isValid) {
                process.exit(1);
            }

        } catch (error) {
            console.error(`❌ 配置文件验证失败: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * 测试规则执行
     */
    async testRulesWithData(configPath: string, dataPath: string): Promise<void> {
        try {
            console.log(`🧪 测试规则执行`);
            console.log(`配置文件: ${configPath}`);
            console.log(`数据文件: ${dataPath}`);
            console.log('='.repeat(50));

            // 读取配置文件
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const config: RuleConfiguration = JSON.parse(configContent);

            // 读取样本数据
            const sampleData = await this.readSampleData(dataPath);
            console.log(`📊 加载了 ${sampleData.length} 条样本数据`);

            // 执行测试
            const result = await this.validationService.testRulesWithSampleData(config, sampleData);

            // 输出结果
            this.printTestResult(result);

            if (!result.success) {
                process.exit(1);
            }

        } catch (error) {
            console.error(`❌ 规则测试失败: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * 生成优化建议
     */
    async generateOptimizationSuggestions(configPath: string): Promise<void> {
        try {
            console.log(`💡 生成优化建议: ${configPath}`);
            console.log('='.repeat(50));

            // 读取配置文件
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const config: RuleConfiguration = JSON.parse(configContent);

            // 生成建议
            const suggestions = this.validationService.generateOptimizationSuggestions(config);

            // 输出建议
            this.printOptimizationSuggestions(suggestions);

        } catch (error) {
            console.error(`❌ 生成优化建议失败: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * 批量验证配置文件
     */
    async validateMultipleConfigs(configDir: string): Promise<void> {
        try {
            console.log(`📁 批量验证配置目录: ${configDir}`);
            console.log('='.repeat(50));

            const files = fs.readdirSync(configDir)
                .filter(file => file.endsWith('.json'))
                .map(file => path.join(configDir, file));

            let totalFiles = 0;
            let validFiles = 0;
            let invalidFiles = 0;

            for (const configPath of files) {
                totalFiles++;
                console.log(`\n📄 验证文件: ${path.basename(configPath)}`);
                console.log('-'.repeat(30));

                try {
                    const configContent = fs.readFileSync(configPath, 'utf-8');
                    const config: RuleConfiguration = JSON.parse(configContent);
                    const result = await this.validationService.validateConfiguration(config);

                    if (result.isValid) {
                        console.log(`✅ 验证通过`);
                        validFiles++;
                    } else {
                        console.log(`❌ 验证失败 (${result.errors.length} 个错误)`);
                        invalidFiles++;

                        // 显示前3个错误
                        result.errors.slice(0, 3).forEach(error => {
                            console.log(`   • ${error.message}`);
                        });

                        if (result.errors.length > 3) {
                            console.log(`   ... 还有 ${result.errors.length - 3} 个错误`);
                        }
                    }
                } catch (error) {
                    console.log(`❌ 文件解析失败: ${error.message}`);
                    invalidFiles++;
                }
            }

            console.log('\n' + '='.repeat(50));
            console.log(`📊 批量验证结果:`);
            console.log(`   总文件数: ${totalFiles}`);
            console.log(`   有效文件: ${validFiles}`);
            console.log(`   无效文件: ${invalidFiles}`);
            console.log(`   成功率: ${((validFiles / totalFiles) * 100).toFixed(1)}%`);

            if (invalidFiles > 0) {
                process.exit(1);
            }

        } catch (error) {
            console.error(`❌ 批量验证失败: ${error.message}`);
            process.exit(1);
        }
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

    /**
     * 打印验证结果
     */
    private printValidationResult(result: any): void {
        console.log(`📋 验证结果:`);
        console.log(`   状态: ${result.isValid ? '✅ 通过' : '❌ 失败'}`);
        console.log(`   总规则数: ${result.summary.totalRules}`);
        console.log(`   有效规则: ${result.summary.validRules}`);
        console.log(`   无效规则: ${result.summary.invalidRules}`);
        console.log(`   性能警告: ${result.summary.performanceWarnings}`);

        if (result.errors.length > 0) {
            console.log(`\n❌ 错误 (${result.errors.length}):`);
            result.errors.forEach((error: any, index: number) => {
                console.log(`   ${index + 1}. [${error.field}] ${error.message}`);
            });
        }

        if (result.warnings.length > 0) {
            console.log(`\n⚠️  警告 (${result.warnings.length}):`);
            result.warnings.forEach((warning: any, index: number) => {
                console.log(`   ${index + 1}. [${warning.field}] ${warning.message}`);
            });
        }

        if (result.performanceIssues.length > 0) {
            console.log(`\n🐌 性能问题 (${result.performanceIssues.length}):`);
            result.performanceIssues.forEach((issue: any, index: number) => {
                const impact = issue.impact === 'high' ? '🔴' : issue.impact === 'medium' ? '🟡' : '🟢';
                console.log(`   ${index + 1}. ${impact} [${issue.field}] ${issue.message}`);
            });
        }

        if (result.suggestions.length > 0) {
            console.log(`\n💡 建议 (${result.suggestions.length}):`);
            result.suggestions.forEach((suggestion: any, index: number) => {
                const priority = suggestion.priority === 'high' ? '🔴' : suggestion.priority === 'medium' ? '🟡' : '🟢';
                console.log(`   ${index + 1}. ${priority} ${suggestion.message}`);
                console.log(`      建议: ${suggestion.recommendation}`);
            });
        }
    }

    /**
     * 打印测试结果
     */
    private printTestResult(result: any): void {
        console.log(`🧪 测试结果:`);
        console.log(`   状态: ${result.success ? '✅ 通过' : '❌ 失败'}`);
        console.log(`   总记录数: ${result.totalRecords}`);
        console.log(`   处理成功: ${result.processedRecords}`);
        console.log(`   处理失败: ${result.failedRecords}`);
        console.log(`   成功率: ${((result.processedRecords / result.totalRecords) * 100).toFixed(1)}%`);

        console.log(`\n⏱️  性能指标:`);
        console.log(`   总耗时: ${result.performanceMetrics.totalTime}ms`);
        console.log(`   平均每条记录: ${result.performanceMetrics.averageTimePerRecord.toFixed(2)}ms`);
        console.log(`   最慢字段: ${result.performanceMetrics.slowestField} (${result.performanceMetrics.slowestFieldTime}ms)`);

        if (Object.keys(result.fieldResults).length > 0) {
            console.log(`\n📊 字段测试结果:`);
            Object.entries(result.fieldResults).forEach(([fieldName, fieldResult]: [string, any]) => {
                const successRate = ((fieldResult.passedTests / fieldResult.totalTests) * 100).toFixed(1);
                console.log(`   ${fieldName}:`);
                console.log(`     测试数: ${fieldResult.totalTests}`);
                console.log(`     通过数: ${fieldResult.passedTests}`);
                console.log(`     失败数: ${fieldResult.failedTests}`);
                console.log(`     成功率: ${successRate}%`);
                console.log(`     平均耗时: ${fieldResult.averageTime.toFixed(2)}ms`);
            });
        }

        if (result.errors.length > 0) {
            console.log(`\n❌ 错误 (${result.errors.length}):`);
            result.errors.slice(0, 10).forEach((error: any, index: number) => {
                console.log(`   ${index + 1}. [${error.field}] ${error.message}`);
            });

            if (result.errors.length > 10) {
                console.log(`   ... 还有 ${result.errors.length - 10} 个错误`);
            }
        }
    }

    /**
     * 打印优化建议
     */
    private printOptimizationSuggestions(suggestions: any[]): void {
        if (suggestions.length === 0) {
            console.log(`✅ 配置已经很好，暂无优化建议`);
            return;
        }

        console.log(`💡 优化建议 (${suggestions.length}):`);
        suggestions.forEach((suggestion, index) => {
            const priority = suggestion.priority === 'high' ? '🔴' : suggestion.priority === 'medium' ? '🟡' : '🟢';
            console.log(`\n   ${index + 1}. ${priority} ${suggestion.type}`);
            console.log(`      问题: ${suggestion.message}`);
            console.log(`      建议: ${suggestion.recommendation}`);
        });
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        printUsage();
        process.exit(1);
    }

    const command = args[0];
    const cli = new ConfigValidationCLI();
    const app = await cli.initialize();

    try {
        switch (command) {
            case 'validate':
                if (args.length < 2) {
                    console.error('❌ 请指定配置文件路径');
                    process.exit(1);
                }
                await cli.validateConfigFile(args[1]);
                break;

            case 'test':
                if (args.length < 3) {
                    console.error('❌ 请指定配置文件和数据文件路径');
                    process.exit(1);
                }
                await cli.testRulesWithData(args[1], args[2]);
                break;

            case 'optimize':
                if (args.length < 2) {
                    console.error('❌ 请指定配置文件路径');
                    process.exit(1);
                }
                await cli.generateOptimizationSuggestions(args[1]);
                break;

            case 'batch':
                if (args.length < 2) {
                    console.error('❌ 请指定配置目录路径');
                    process.exit(1);
                }
                await cli.validateMultipleConfigs(args[1]);
                break;

            default:
                console.error(`❌ 未知命令: ${command}`);
                printUsage();
                process.exit(1);
        }
    } finally {
        await app.close();
    }
}

function printUsage() {
    console.log(`
📋 配置验证工具使用说明

用法:
  npm run validate-config <command> [options]

命令:
  validate <config-file>              验证单个配置文件
  test <config-file> <data-file>      使用样本数据测试规则执行
  optimize <config-file>              生成优化建议
  batch <config-directory>            批量验证配置目录中的所有文件

示例:
  npm run validate-config validate ./src/config/rule-engine/default-rules.json
  npm run validate-config test ./src/config/rule-engine/default-rules.json ./test-data/sample.csv
  npm run validate-config optimize ./src/config/rule-engine/default-rules.json
  npm run validate-config batch ./src/config/rule-engine/

支持的数据文件格式:
  - JSON (.json)
  - CSV (.csv)
`);
}

// 运行主函数
if (require.main === module) {
    main().catch(error => {
        console.error('❌ 工具执行失败:', error.message);
        process.exit(1);
    });
}

export { ConfigValidationCLI };
#!/usr/bin/env node

/**
 * 快速进度检查脚本
 * 验证进度跟踪服务的修复是否生效
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 快速检查进度修复状态');
console.log('='.repeat(40));

// 检查文件
const filesToCheck = [
    'data-cleaning-service/src/services/progress-tracker.service.ts',
    'data-cleaning-service/src/services/data-cleaner.service.ts',
    'data-cleaning-service/src/services/data-cleaner-optimized.service.ts'
];

let allFixed = true;

filesToCheck.forEach(filePath => {
    console.log(`\n📁 检查文件: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.log('❌ 文件不存在');
        allFixed = false;
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // 检查是否还有问题代码
    const hasOldLogic = content.includes('动态调整总行数以避免进度超过100%');
    const hasAggressiveAdjustment = content.includes('updatedProgress.totalRows * 0.9');

    if (hasOldLogic) {
        console.log('❌ 仍包含旧的动态调整注释');
        allFixed = false;
    } else {
        console.log('✅ 已移除动态调整注释');
    }

    if (hasAggressiveAdjustment) {
        console.log('❌ 仍包含激进的调整逻辑');
        allFixed = false;
    } else {
        console.log('✅ 已移除激进调整逻辑');
    }

    // 检查是否有进度倒退保护
    if (filePath.includes('progress-tracker.service.ts')) {
        const hasProtection = content.includes('防止进度倒退');
        if (hasProtection) {
            console.log('✅ 已添加进度倒退保护');
        } else {
            console.log('❌ 缺少进度倒退保护');
            allFixed = false;
        }
    }
});

console.log('\n🎯 检查结果');
console.log('='.repeat(40));

if (allFixed) {
    console.log('✅ 所有修复都已正确应用');
    console.log('🎉 进度倒退问题已解决');
    console.log('\n📋 下一步:');
    console.log('1. 重启后端服务');
    console.log('2. 重启Worker进程');
    console.log('3. 运行测试验证: node test-progress-fix.js');
} else {
    console.log('❌ 部分修复未完成');
    console.log('🔧 请检查上述问题并重新修复');
}

console.log('\n💡 提示:');
console.log('- 确保服务重启后测试');
console.log('- 监控日志中的进度变化');
console.log('- 如有问题，查看 PROGRESS-REGRESSION-FIX.md');
#!/usr/bin/env node

/**
 * 修复进度倒退问题的脚本
 * 移除数据清洗服务中导致进度倒退的注释
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data-cleaning-service/src/services/data-cleaner.service.ts');

console.log('🔧 修复进度倒退问题...');

try {
    // 读取文件内容
    let content = fs.readFileSync(filePath, 'utf8');

    // 移除导致进度倒退的注释和逻辑
    const oldPattern = /\/\/ 动态调整总行数以避免进度超过100%\s*\n\s*\/\/ 检查是否需要更新总行数估算\s*\n/g;
    const newContent = content.replace(oldPattern, '');

    // 写回文件
    fs.writeFileSync(filePath, newContent, 'utf8');

    console.log('✅ 进度倒退问题修复完成');
    console.log('📝 已移除动态调整总行数的注释');

} catch (error) {
    console.error('❌ 修复失败:', error.message);
    process.exit(1);
}
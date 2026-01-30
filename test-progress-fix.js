#!/usr/bin/env node

/**
 * 测试进度修复的脚本
 * 验证进度不再出现倒退现象
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:3101/api';
const TEST_FILE_PATH = path.join(__dirname, 'test-data', 'test-data-simple.csv');

async function testProgressFix() {
    console.log('🧪 测试进度修复');
    console.log('目标：验证进度不会倒退');
    console.log('='.repeat(40));

    try {
        // 检查测试文件
        if (!fs.existsSync(TEST_FILE_PATH)) {
            console.error(`❌ 测试文件不存在: ${TEST_FILE_PATH}`);
            process.exit(1);
        }

        console.log(`📁 使用测试文件: ${TEST_FILE_PATH}`);

        // 上传文件
        console.log('⬆️  上传文件...');
        const uploadResult = await uploadFile();
        console.log(`✅ 文件上传成功，任务ID: ${uploadResult.taskId}`);

        // 监控进度，检查是否有倒退
        console.log('👀 监控进度变化...');
        const progressHistory = await monitorProgressForRegression(uploadResult.taskId);

        // 分析结果
        analyzeProgressHistory(progressHistory);

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
        process.exit(1);
    }
}

async function uploadFile() {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(TEST_FILE_PATH));

    const response = await axios.post(`${API_BASE_URL}/data-cleaning/upload`, formData, {
        headers: {
            ...formData.getHeaders(),
        },
        timeout: 30000,
    });

    return response.data;
}

async function monitorProgressForRegression(taskId) {
    const progressHistory = [];
    let lastProgress = -1;
    let regressionDetected = false;

    console.log('开始监控进度...');

    while (true) {
        try {
            const response = await axios.get(`${API_BASE_URL}/data-cleaning/check-status/${taskId}`);
            const status = response.data;

            const currentProgress = status.progress?.progress || 0;
            const timestamp = new Date().toISOString();

            // 记录进度历史
            progressHistory.push({
                timestamp,
                progress: currentProgress,
                processedRows: status.progress?.processedRows || 0,
                totalRows: status.progress?.totalRows || 0,
                phase: status.progress?.currentPhase || 'unknown'
            });

            // 检查进度倒退
            if (currentProgress < lastProgress && lastProgress < 100) {
                console.log(`⚠️  检测到进度倒退: ${lastProgress}% -> ${currentProgress}%`);
                regressionDetected = true;
            } else if (currentProgress > lastProgress) {
                console.log(`📈 进度正常: ${currentProgress}% (处理: ${status.progress?.processedRows || 0}行)`);
            }

            lastProgress = currentProgress;

            // 检查是否完成
            if (status.status === 'completed') {
                console.log('✅ 处理完成');
                break;
            }

            if (status.status === 'failed') {
                console.log('❌ 处理失败');
                break;
            }

            // 等待1秒后继续检查
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log('⏳ 任务尚未开始，继续等待...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }
            throw error;
        }
    }

    return { progressHistory, regressionDetected };
}

function analyzeProgressHistory(result) {
    const { progressHistory, regressionDetected } = result;

    console.log('\n📊 进度分析结果');
    console.log('='.repeat(40));

    if (progressHistory.length === 0) {
        console.log('⚠️  没有收集到进度数据');
        return;
    }

    // 显示进度历史摘要
    console.log(`📈 总进度记录数: ${progressHistory.length}`);
    console.log(`🏁 最终进度: ${progressHistory[progressHistory.length - 1].progress}%`);

    // 检查进度倒退
    if (regressionDetected) {
        console.log('❌ 检测到进度倒退现象');
        console.log('🔧 需要进一步调试和修复');
    } else {
        console.log('✅ 未检测到进度倒退');
        console.log('🎉 进度修复成功！');
    }

    // 显示详细的进度变化
    console.log('\n📋 详细进度历史:');
    progressHistory.forEach((record, index) => {
        const time = new Date(record.timestamp).toLocaleTimeString();
        console.log(`  ${index + 1}. ${time} - ${record.progress}% (${record.processedRows}/${record.totalRows}) [${record.phase}]`);
    });

    // 计算进度变化统计
    let increases = 0;
    let decreases = 0;
    let stable = 0;

    for (let i = 1; i < progressHistory.length; i++) {
        const prev = progressHistory[i - 1].progress;
        const curr = progressHistory[i].progress;

        if (curr > prev) increases++;
        else if (curr < prev) decreases++;
        else stable++;
    }

    console.log('\n📊 进度变化统计:');
    console.log(`  📈 进度增加: ${increases} 次`);
    console.log(`  📉 进度减少: ${decreases} 次`);
    console.log(`  ➡️  进度稳定: ${stable} 次`);

    if (decreases === 0) {
        console.log('\n🎯 结论: 进度修复完全成功，无倒退现象！');
    } else {
        console.log('\n⚠️  结论: 仍存在进度倒退，需要进一步修复');
    }
}

// 运行测试
if (require.main === module) {
    testProgressFix();
}

module.exports = { testProgressFix };
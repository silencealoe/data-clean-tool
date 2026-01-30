#!/usr/bin/env node

/**
 * 性能优化测试脚本
 * 测试10MB文件的处理性能，目标：20秒内完成
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:3101/api';
const TEST_FILE_PATH = path.join(__dirname, 'test-data', 'test-data-10mb.csv');

// 性能指标
let startTime;
let uploadTime;
let processingTime;
let totalTime;

async function testPerformanceOptimization() {
    console.log('🚀 开始性能优化测试');
    console.log('目标：10MB文件在20秒内完成处理');
    console.log('='.repeat(50));

    try {
        // 检查测试文件是否存在
        if (!fs.existsSync(TEST_FILE_PATH)) {
            console.error(`❌ 测试文件不存在: ${TEST_FILE_PATH}`);
            console.log('请先运行: node test-scripts/generate-10mb-test-file.js');
            process.exit(1);
        }

        const fileStats = fs.statSync(TEST_FILE_PATH);
        console.log(`📁 测试文件: ${TEST_FILE_PATH}`);
        console.log(`📊 文件大小: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log('');

        startTime = Date.now();

        // 1. 上传文件
        console.log('⬆️  开始上传文件...');
        const uploadResult = await uploadFile();
        uploadTime = Date.now() - startTime;
        console.log(`✅ 文件上传完成，耗时: ${uploadTime}ms`);
        console.log(`📋 任务ID: ${uploadResult.taskId}`);
        console.log('');

        // 2. 监控处理进度
        console.log('⚙️  开始监控处理进度...');
        const processingResult = await monitorProcessing(uploadResult.taskId);
        processingTime = processingResult.processingTime;
        totalTime = Date.now() - startTime;

        // 3. 显示性能结果
        displayPerformanceResults(processingResult);

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
        timeout: 60000, // 60秒超时
    });

    return response.data;
}

async function monitorProcessing(taskId) {
    const startProcessingTime = Date.now();
    let lastProgress = 0;
    let lastLogTime = Date.now();
    let maxSpeed = 0;
    let totalRows = 0;
    let processedRows = 0;

    while (true) {
        try {
            const response = await axios.get(`${API_BASE_URL}/data-cleaning/check-status/${taskId}`);
            const status = response.data;

            // 更新统计信息
            if (status.progress) {
                totalRows = status.progress.totalRows || 0;
                processedRows = status.progress.processedRows || 0;
            }

            // 计算处理速度
            const currentTime = Date.now();
            const timeDiff = currentTime - lastLogTime;
            const progressDiff = (status.progress?.progress || 0) - lastProgress;

            if (timeDiff > 2000 && progressDiff > 0) { // 每2秒更新一次
                const speed = Math.round((processedRows - (lastProgress * totalRows / 100)) / (timeDiff / 1000));
                maxSpeed = Math.max(maxSpeed, speed);

                console.log(
                    `📈 进度: ${status.progress?.progress || 0}% | ` +
                    `处理行数: ${processedRows.toLocaleString()}/${totalRows.toLocaleString()} | ` +
                    `速度: ${speed.toLocaleString()} 行/秒 | ` +
                    `阶段: ${status.progress?.currentPhase || 'unknown'}`
                );

                lastProgress = status.progress?.progress || 0;
                lastLogTime = currentTime;
            }

            // 检查是否完成
            if (status.status === 'completed') {
                const processingTime = Date.now() - startProcessingTime;
                console.log('✅ 处理完成!');
                return {
                    processingTime,
                    totalRows,
                    processedRows,
                    maxSpeed,
                    statistics: status.statistics
                };
            }

            if (status.status === 'failed') {
                throw new Error(`处理失败: ${status.error || '未知错误'}`);
            }

            // 等待1秒后继续检查
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log('⏳ 任务尚未开始处理，继续等待...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }
            throw error;
        }
    }
}

function displayPerformanceResults(result) {
    console.log('');
    console.log('🎯 性能测试结果');
    console.log('='.repeat(50));

    // 时间指标
    console.log(`⏱️  上传时间: ${uploadTime}ms (${(uploadTime / 1000).toFixed(1)}秒)`);
    console.log(`⚙️  处理时间: ${result.processingTime}ms (${(result.processingTime / 1000).toFixed(1)}秒)`);
    console.log(`🕐 总时间: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}秒)`);
    console.log('');

    // 处理指标
    console.log(`📊 总行数: ${result.totalRows.toLocaleString()}`);
    console.log(`✅ 处理行数: ${result.processedRows.toLocaleString()}`);
    console.log(`🚀 最大速度: ${result.maxSpeed.toLocaleString()} 行/秒`);
    console.log(`📈 平均速度: ${Math.round(result.processedRows / (result.processingTime / 1000)).toLocaleString()} 行/秒`);
    console.log('');

    // 目标对比
    const targetTime = 20000; // 20秒目标
    const targetSpeed = 8000; // 8000行/秒目标
    const actualSpeed = Math.round(result.processedRows / (result.processingTime / 1000));

    console.log('🎯 目标对比');
    console.log(`时间目标: ${targetTime / 1000}秒 | 实际: ${(result.processingTime / 1000).toFixed(1)}秒 | ${result.processingTime <= targetTime ? '✅ 达标' : '❌ 未达标'}`);
    console.log(`速度目标: ${targetSpeed.toLocaleString()}行/秒 | 实际: ${actualSpeed.toLocaleString()}行/秒 | ${actualSpeed >= targetSpeed ? '✅ 达标' : '❌ 未达标'}`);
    console.log('');

    // 性能评级
    let grade = 'F';
    if (result.processingTime <= targetTime && actualSpeed >= targetSpeed) {
        grade = 'A+';
    } else if (result.processingTime <= targetTime * 1.5 && actualSpeed >= targetSpeed * 0.7) {
        grade = 'A';
    } else if (result.processingTime <= targetTime * 2 && actualSpeed >= targetSpeed * 0.5) {
        grade = 'B';
    } else if (result.processingTime <= targetTime * 3 && actualSpeed >= targetSpeed * 0.3) {
        grade = 'C';
    } else {
        grade = 'D';
    }

    console.log(`🏆 性能评级: ${grade}`);

    if (grade === 'A+') {
        console.log('🎉 恭喜！性能优化目标已达成！');
    } else {
        console.log('💡 还有优化空间，继续努力！');
    }
}

// 运行测试
if (require.main === module) {
    testPerformanceOptimization();
}

module.exports = { testPerformanceOptimization };
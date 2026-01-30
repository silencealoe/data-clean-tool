const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

/**
 * 中等大小文件上传测试脚本
 * 测试100MB文件的上传、处理和状态同步
 */

async function testMediumFileUpload() {
    const mediumFilePath = path.join(__dirname, 'medium-test-data.csv');

    try {
        console.log('=== 中等大小文件上传测试 ===');

        // 1. 检查文件是否存在
        if (!fs.existsSync(mediumFilePath)) {
            console.log('❌ 测试文件不存在，请先运行 generate-medium-test-file.js 生成测试文件');
            return;
        }

        const fileStats = fs.statSync(mediumFilePath);
        const fileSizeMB = fileStats.size / 1024 / 1024;

        console.log(`1. 找到测试文件: ${mediumFilePath}`);
        console.log(`   文件大小: ${fileSizeMB.toFixed(2)} MB (${fileStats.size.toLocaleString()} 字节)`);

        // 2. 开始上传
        console.log('\\n2. 开始上传文件...');

        const uploadStartTime = Date.now();

        try {
            const uploadCmd = `curl -X POST -F "file=@${mediumFilePath}" http://localhost:3101/api/data-cleaning/upload --max-time 120`;
            console.log('   执行命令:', uploadCmd);

            const uploadResult = await execAsync(uploadCmd);
            const uploadEndTime = Date.now();
            const uploadTime = (uploadEndTime - uploadStartTime) / 1000;

            console.log(`   上传耗时: ${uploadTime.toFixed(2)} 秒`);
            console.log(`   上传速度: ${(fileSizeMB / uploadTime).toFixed(2)} MB/秒`);
            console.log('   上传响应:', uploadResult.stdout);

            let uploadData;
            try {
                uploadData = JSON.parse(uploadResult.stdout);
            } catch (e) {
                console.log('❌ 解析上传响应失败:', e.message);
                return;
            }

            if (!uploadData.jobId) {
                console.log('❌ 上传失败，无法获取jobId');
                return;
            }

            const { jobId, fileId } = uploadData;
            console.log(`   任务ID: ${jobId}`);
            console.log(`   文件ID: ${fileId}`);

        } catch (uploadError) {
            console.log('❌ 上传失败:', uploadError.message);
            return;
        }

        // 3. 监控处理进度
        console.log('\\n3. 监控处理进度...');
        const { jobId, fileId } = JSON.parse(uploadResult.stdout);

        let status = 'pending';
        let attempts = 0;
        const maxAttempts = 120; // 2分钟超时
        const processingStartTime = Date.now();
        let lastProgress = -1;

        while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // 每3秒检查一次

            try {
                // 检查Redis状态
                const statusCmd = `curl -s http://localhost:3101/api/data-cleaning/check-status/${jobId}`;
                const statusResult = await execAsync(statusCmd);
                const statusData = JSON.parse(statusResult.stdout);

                status = statusData.status;
                const elapsed = (Date.now() - processingStartTime) / 1000;
                const progress = statusData.progress || 0;

                // 只在进度变化时显示详细信息
                if (progress !== lastProgress || attempts % 10 === 0) {
                    console.log(`   状态: ${status} | 进度: ${progress}% | 已耗时: ${elapsed.toFixed(0)}秒`);

                    if (statusData.statistics) {
                        const stats = statusData.statistics;
                        console.log(`   统计: 总行数=${stats.totalRows?.toLocaleString()}, 处理行数=${stats.processedRows?.toLocaleString()}, 错误行数=${stats.invalidRows?.toLocaleString()}`);

                        // 计算处理速度
                        if (stats.processedRows > 0 && elapsed > 0) {
                            const rowsPerSecond = stats.processedRows / elapsed;
                            console.log(`   处理速度: ${rowsPerSecond.toFixed(0)} 行/秒`);
                        }
                    }

                    lastProgress = progress;
                } else {
                    // 简化显示
                    process.stdout.write(`\\r   状态: ${status} | 进度: ${progress}% | 已耗时: ${elapsed.toFixed(0)}秒`);
                }

            } catch (error) {
                console.log(`\\n   状态查询失败: ${error.message}`);
            }

            attempts++;
        }

        console.log(''); // 换行

        const processingEndTime = Date.now();
        const totalProcessingTime = (processingEndTime - processingStartTime) / 1000;

        // 4. 验证最终状态同步
        console.log('\\n4. 验证最终状态同步...');

        try {
            // 检查Redis状态
            const finalStatusCmd = `curl -s http://localhost:3101/api/data-cleaning/check-status/${jobId}`;
            const finalStatusResult = await execAsync(finalStatusCmd);
            const redisData = JSON.parse(finalStatusResult.stdout);

            // 检查数据库状态
            const fileCmd = `curl -s http://localhost:3101/api/data-cleaning/files/${fileId}`;
            const fileResult = await execAsync(fileCmd);
            const dbData = JSON.parse(fileResult.stdout);

            const redisStatus = redisData.status;
            const dbStatus = dbData.file.status;

            console.log('\\n=== 最终结果 ===');
            console.log(`Redis任务状态: ${redisStatus}`);
            console.log(`数据库文件状态: ${dbStatus}`);
            console.log(`总处理时间: ${totalProcessingTime.toFixed(2)} 秒`);

            if (redisStatus === dbStatus) {
                console.log('✅ 状态同步成功！');

                if (redisStatus === 'completed') {
                    console.log('\\n=== 处理统计 ===');
                    console.log(`- 总行数: ${dbData.file.totalRows?.toLocaleString()}`);
                    console.log(`- 清洁行数: ${dbData.file.cleanedRows?.toLocaleString()}`);
                    console.log(`- 异常行数: ${dbData.file.exceptionRows?.toLocaleString()}`);
                    console.log(`- 处理时间: ${dbData.file.processingTime} ms`);
                    console.log(`- 完成时间: ${dbData.file.completedAt}`);

                    // 计算处理性能
                    const totalRows = dbData.file.totalRows || 0;
                    const processingTimeMs = dbData.file.processingTime || totalProcessingTime * 1000;
                    const rowsPerSecond = totalRows / (processingTimeMs / 1000);
                    const mbPerSecond = (fileStats.size / 1024 / 1024) / (processingTimeMs / 1000);

                    console.log('\\n=== 性能指标 ===');
                    console.log(`- 处理速度: ${rowsPerSecond.toFixed(0)} 行/秒`);
                    console.log(`- 吞吐量: ${mbPerSecond.toFixed(2)} MB/秒`);
                    console.log(`- 文件大小: ${fileSizeMB.toFixed(2)} MB`);

                    // 性能评估
                    if (rowsPerSecond > 10000) {
                        console.log('- 性能评估: 🚀 优秀');
                    } else if (rowsPerSecond > 5000) {
                        console.log('- 性能评估: ✅ 良好');
                    } else if (rowsPerSecond > 1000) {
                        console.log('- 性能评估: ⚠️ 一般');
                    } else {
                        console.log('- 性能评估: ❌ 需要优化');
                    }

                } else if (redisStatus === 'failed') {
                    console.log('❌ 处理失败');
                    console.log(`错误信息: ${dbData.file.errorMessage}`);
                }
            } else {
                console.log('❌ 状态同步失败！');
                console.log(`Redis状态: ${redisStatus}`);
                console.log(`数据库状态: ${dbStatus}`);
            }

        } catch (error) {
            console.log('❌ 状态验证失败:', error.message);
        }

    } catch (error) {
        console.error('❌ 中等文件测试失败:', error.message);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testMediumFileUpload();
}

module.exports = { testMediumFileUpload };
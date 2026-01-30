const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

/**
 * 大文件上传测试脚本
 * 测试1GB文件的上传、处理和状态同步
 */

async function testLargeFileUpload() {
    const largeFilePath = path.join(__dirname, 'large-test-data.csv');

    try {
        console.log('=== 大文件上传测试 ===');

        // 1. 检查大文件是否存在
        if (!fs.existsSync(largeFilePath)) {
            console.log('❌ 大文件不存在，请先运行 generate-large-test-file.js 生成测试文件');
            return;
        }

        const fileStats = fs.statSync(largeFilePath);
        const fileSizeGB = fileStats.size / 1024 / 1024 / 1024;

        console.log(`1. 找到测试文件: ${largeFilePath}`);
        console.log(`   文件大小: ${fileSizeGB.toFixed(2)} GB (${fileStats.size.toLocaleString()} 字节)`);

        // 2. 开始上传
        console.log('\\n2. 开始上传大文件...');
        console.log('   注意: 大文件上传可能需要较长时间，请耐心等待');

        const uploadStartTime = Date.now();

        try {
            const uploadCmd = `curl -X POST -F "file=@${largeFilePath}" http://localhost:3101/api/data-cleaning/upload --max-time 300`;
            console.log('   执行命令:', uploadCmd);

            const uploadResult = await execAsync(uploadCmd);
            const uploadEndTime = Date.now();
            const uploadTime = (uploadEndTime - uploadStartTime) / 1000;

            console.log(`   上传耗时: ${uploadTime.toFixed(2)} 秒`);
            console.log(`   上传速度: ${(fileSizeGB / uploadTime * 1024).toFixed(2)} MB/秒`);
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
        const maxAttempts = 300; // 增加到5分钟超时
        const processingStartTime = Date.now();

        while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // 每5秒检查一次

            try {
                // 检查Redis状态
                const statusCmd = `curl -s http://localhost:3101/api/data-cleaning/check-status/${jobId}`;
                const statusResult = await execAsync(statusCmd);
                const statusData = JSON.parse(statusResult.stdout);

                status = statusData.status;
                const elapsed = (Date.now() - processingStartTime) / 1000;

                console.log(`   状态检查 (${attempts + 1}/${maxAttempts}): ${status} | 已耗时: ${elapsed.toFixed(0)}秒`);

                if (statusData.progress !== undefined) {
                    console.log(`   进度: ${statusData.progress}%`);
                }

                if (statusData.statistics) {
                    console.log(`   统计: 总行数=${statusData.statistics.totalRows}, 处理行数=${statusData.statistics.processedRows}, 错误行数=${statusData.statistics.invalidRows}`);
                }

                // 检查系统资源使用情况
                if (attempts % 6 === 0) { // 每30秒检查一次系统资源
                    try {
                        const metricsCmd = `curl -s http://localhost:3101/api/monitoring/metrics/system`;
                        const metricsResult = await execAsync(metricsCmd);
                        const metricsData = JSON.parse(metricsResult.stdout);

                        console.log(`   系统资源: CPU=${metricsData.cpu?.usage?.toFixed(1)}%, 内存=${(metricsData.memory?.heapUsed / 1024 / 1024).toFixed(0)}MB`);
                    } catch (e) {
                        // 忽略资源监控错误
                    }
                }

            } catch (error) {
                console.log(`   状态查询失败: ${error.message}`);
            }

            attempts++;
        }

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
                    console.log(`- 文件大小: ${fileSizeGB.toFixed(2)} GB`);

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

        // 5. 清理建议
        console.log('\\n=== 清理建议 ===');
        console.log('大文件测试完成后，建议：');
        console.log('1. 检查临时文件目录的磁盘使用情况');
        console.log('2. 清理不需要的测试数据');
        console.log('3. 监控数据库大小增长');
        console.log('4. 检查日志文件大小');

    } catch (error) {
        console.error('❌ 大文件测试失败:', error.message);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testLargeFileUpload();
}

module.exports = { testLargeFileUpload };
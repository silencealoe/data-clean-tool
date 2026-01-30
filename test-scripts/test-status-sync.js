const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Create a simple test CSV file
const csvContent = `name,phone,email,address,date
John Doe,13812345678,john@example.com,北京市朝阳区,2023-01-15
Jane Smith,15987654321,jane@example.com,上海市浦东新区,2023-02-20
Bob Johnson,18765432109,bob@example.com,广州市天河区,2023-03-10`;

async function testStatusSync() {
    try {
        console.log('=== 测试数据库状态同步 ===');

        // 1. 创建测试文件
        fs.writeFileSync('test-sample.csv', csvContent);
        console.log('1. 测试文件已创建: test-sample.csv');

        // 2. 上传文件
        console.log('\\n2. 上传文件...');
        const uploadCmd = 'curl -X POST -F "file=@test-sample.csv" http://localhost:3101/api/data-cleaning/upload';
        const uploadResult = await execAsync(uploadCmd);

        console.log('上传响应:', uploadResult.stdout);

        let uploadData;
        try {
            uploadData = JSON.parse(uploadResult.stdout);
        } catch (e) {
            console.log('解析上传响应失败:', e.message);
            return;
        }

        if (!uploadData.jobId) {
            console.log('上传失败，无法获取jobId');
            return;
        }

        const { jobId, fileId } = uploadData;
        console.log('任务ID:', jobId);
        console.log('文件ID:', fileId);

        // 3. 监控Redis任务状态
        console.log('\\n3. 监控Redis任务状态...');
        let redisStatus = 'pending';
        let attempts = 0;
        const maxAttempts = 30;

        while (redisStatus !== 'completed' && redisStatus !== 'failed' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                const statusCmd = `curl -s http://localhost:3101/api/data-cleaning/check-status/${jobId}`;
                const statusResult = await execAsync(statusCmd);
                const statusData = JSON.parse(statusResult.stdout);

                redisStatus = statusData.status;
                console.log(`Redis状态 (${attempts + 1}/${maxAttempts}):`, redisStatus);

                if (statusData.progress !== undefined) {
                    console.log('进度:', statusData.progress + '%');
                }

                if (statusData.statistics) {
                    console.log('统计:', statusData.statistics);
                }
            } catch (error) {
                console.log('状态查询失败:', error.message);
            }

            attempts++;
        }

        // 4. 检查数据库文件记录状态
        console.log('\\n4. 检查数据库文件记录状态...');
        try {
            const fileCmd = `curl -s http://localhost:3101/api/data-cleaning/files/${fileId}`;
            const fileResult = await execAsync(fileCmd);
            const fileData = JSON.parse(fileResult.stdout);

            const dbStatus = fileData.file.status;

            console.log('\\n=== 状态对比 ===');
            console.log('Redis任务状态:', redisStatus);
            console.log('数据库文件状态:', dbStatus);

            // 5. 验证状态同步
            if (redisStatus === dbStatus) {
                console.log('\\n✅ 状态同步成功！Redis和数据库状态一致');

                if (redisStatus === 'completed') {
                    console.log('\\n=== 处理结果统计 ===');
                    console.log('- 总行数:', fileData.file.totalRows);
                    console.log('- 清洁行数:', fileData.file.cleanedRows);
                    console.log('- 异常行数:', fileData.file.exceptionRows);
                    console.log('- 处理时间:', fileData.file.processingTime + 'ms');
                    console.log('- 完成时间:', fileData.file.completedAt);
                }
            } else {
                console.log('\\n❌ 状态同步失败！');
                console.log('这表明TaskConsumerService没有正确更新数据库状态');
                console.log('Redis状态:', redisStatus);
                console.log('数据库状态:', dbStatus);
            }

        } catch (error) {
            console.log('数据库状态查询失败:', error.message);
        }

    } catch (error) {
        console.error('测试失败:', error.message);
    } finally {
        // 清理测试文件
        try {
            fs.unlinkSync('test-sample.csv');
            console.log('\\n测试文件已清理');
        } catch (e) { }
    }
}

testStatusSync();
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

// 创建测试CSV文件
const testData = `姓名,电话,地址,出生日期
张三,13812345678,北京市朝阳区,1990-01-01
李四,13987654321,上海市浦东新区,1985-05-15
王五,15012345678,广州市天河区,1992-03-20`;

fs.writeFileSync('test-sync-data.csv', testData, 'utf8');

async function testStatusSync() {
    try {
        console.log('=== 测试数据库状态同步 ===');

        // 1. 上传文件
        console.log('1. 上传文件...');
        const form = new FormData();
        form.append('file', fs.createReadStream('test-sync-data.csv'));

        const uploadResponse = await axios.post('http://localhost:3101/api/data-cleaning/upload', form, {
            headers: form.getHeaders(),
            timeout: 30000
        });

        console.log('上传响应:', uploadResponse.data);
        const { jobId, fileId } = uploadResponse.data;

        // 2. 等待处理完成，检查Redis状态
        console.log('\\n2. 监控Redis任务状态...');
        let redisStatus = 'pending';
        let attempts = 0;
        const maxAttempts = 30;

        while (redisStatus !== 'completed' && redisStatus !== 'failed' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                const statusResponse = await axios.get(`http://localhost:3101/api/data-cleaning/check-status/${jobId}`);
                redisStatus = statusResponse.data.status;
                console.log(`Redis状态 (${attempts + 1}/${maxAttempts}):`, redisStatus);

                if (statusResponse.data.progress !== undefined) {
                    console.log('进度:', statusResponse.data.progress + '%');
                }
            } catch (error) {
                console.log('状态查询失败:', error.message);
            }

            attempts++;
        }

        // 3. 检查数据库文件记录状态
        console.log('\\n3. 检查数据库文件记录状态...');
        try {
            const fileResponse = await axios.get(`http://localhost:3101/api/data-cleaning/files/${fileId}`);
            const dbStatus = fileResponse.data.file.status;

            console.log('Redis任务状态:', redisStatus);
            console.log('数据库文件状态:', dbStatus);

            // 4. 验证状态同步
            if (redisStatus === dbStatus) {
                console.log('\\n✅ 状态同步成功！Redis和数据库状态一致');

                if (redisStatus === 'completed') {
                    console.log('统计信息:');
                    console.log('- 总行数:', fileResponse.data.file.totalRows);
                    console.log('- 清洁行数:', fileResponse.data.file.cleanedRows);
                    console.log('- 异常行数:', fileResponse.data.file.exceptionRows);
                    console.log('- 处理时间:', fileResponse.data.file.processingTime + 'ms');
                }
            } else {
                console.log('\\n❌ 状态同步失败！');
                console.log('Redis状态:', redisStatus);
                console.log('数据库状态:', dbStatus);
            }

        } catch (error) {
            console.log('数据库状态查询失败:', error.message);
        }

    } catch (error) {
        console.error('测试失败:', error.message);
        if (error.response) {
            console.error('响应数据:', error.response.data);
        }
    } finally {
        // 清理测试文件
        try {
            fs.unlinkSync('test-sync-data.csv');
        } catch (e) { }
    }
}

testStatusSync();
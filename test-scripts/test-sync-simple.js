const fs = require('fs');
const https = require('https');
const http = require('http');

// 创建测试CSV文件
const testData = `姓名,电话,地址,出生日期
张三,13812345678,北京市朝阳区,1990-01-01
李四,13987654321,上海市浦东新区,1985-05-15
王五,15012345678,广州市天河区,1992-03-20`;

fs.writeFileSync('test-sync-data.csv', testData, 'utf8');

function makeRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve(parsed);
                } catch (e) {
                    resolve(body);
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(data);
        }
        req.end();
    });
}

function createMultipartData(filePath) {
    const boundary = '----formdata-boundary-' + Math.random().toString(36);
    const fileContent = fs.readFileSync(filePath);
    const fileName = 'test-sync-data.csv';

    let data = '';
    data += `--${boundary}\\r\\n`;
    data += `Content-Disposition: form-data; name="file"; filename="${fileName}"\\r\\n`;
    data += `Content-Type: text/csv\\r\\n\\r\\n`;

    const header = Buffer.from(data, 'utf8');
    const footer = Buffer.from(`\\r\\n--${boundary}--\\r\\n`, 'utf8');

    return {
        data: Buffer.concat([header, fileContent, footer]),
        contentType: `multipart/form-data; boundary=${boundary}`
    };
}

async function testStatusSync() {
    try {
        console.log('=== 测试数据库状态同步 ===');

        // 1. 上传文件
        console.log('1. 上传文件...');
        const multipart = createMultipartData('test-sync-data.csv');

        const uploadOptions = {
            hostname: 'localhost',
            port: 3101,
            path: '/api/data-cleaning/upload',
            method: 'POST',
            headers: {
                'Content-Type': multipart.contentType,
                'Content-Length': multipart.data.length
            }
        };

        const uploadResponse = await makeRequest(uploadOptions, multipart.data);
        console.log('上传响应:', uploadResponse);

        if (!uploadResponse.jobId) {
            console.log('上传失败，无法获取jobId');
            return;
        }

        const { jobId, fileId } = uploadResponse;

        // 2. 等待处理完成，检查Redis状态
        console.log('\\n2. 监控Redis任务状态...');
        let redisStatus = 'pending';
        let attempts = 0;
        const maxAttempts = 30;

        while (redisStatus !== 'completed' && redisStatus !== 'failed' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                const statusOptions = {
                    hostname: 'localhost',
                    port: 3101,
                    path: `/api/data-cleaning/check-status/${jobId}`,
                    method: 'GET'
                };

                const statusResponse = await makeRequest(statusOptions);
                redisStatus = statusResponse.status;
                console.log(`Redis状态 (${attempts + 1}/${maxAttempts}):`, redisStatus);

                if (statusResponse.progress !== undefined) {
                    console.log('进度:', statusResponse.progress + '%');
                }
            } catch (error) {
                console.log('状态查询失败:', error.message);
            }

            attempts++;
        }

        // 3. 检查数据库文件记录状态
        console.log('\\n3. 检查数据库文件记录状态...');
        try {
            const fileOptions = {
                hostname: 'localhost',
                port: 3101,
                path: `/api/data-cleaning/files/${fileId}`,
                method: 'GET'
            };

            const fileResponse = await makeRequest(fileOptions);
            const dbStatus = fileResponse.file.status;

            console.log('Redis任务状态:', redisStatus);
            console.log('数据库文件状态:', dbStatus);

            // 4. 验证状态同步
            if (redisStatus === dbStatus) {
                console.log('\\n✅ 状态同步成功！Redis和数据库状态一致');

                if (redisStatus === 'completed') {
                    console.log('统计信息:');
                    console.log('- 总行数:', fileResponse.file.totalRows);
                    console.log('- 清洁行数:', fileResponse.file.cleanedRows);
                    console.log('- 异常行数:', fileResponse.file.exceptionRows);
                    console.log('- 处理时间:', fileResponse.file.processingTime + 'ms');
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
    } finally {
        // 清理测试文件
        try {
            fs.unlinkSync('test-sync-data.csv');
        } catch (e) { }
    }
}

testStatusSync();
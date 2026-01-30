/**
 * 测试API状态查询
 */

const http = require('http');

function makeRequest(taskId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3101,
            path: `/api/data-cleaning/check-status/${taskId}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        statusCode: res.statusCode,
                        data: jsonData
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

async function testApiStatus() {
    const taskId = 'job_1769755918331_tch64pjtz';

    try {
        console.log(`测试API状态查询: ${taskId}`);

        const result = await makeRequest(taskId);

        console.log('HTTP状态码:', result.statusCode);
        console.log('响应数据:', JSON.stringify(result.data, null, 2));

    } catch (error) {
        console.error('请求失败:', error.message);
    }
}

testApiStatus();
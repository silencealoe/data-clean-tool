const fs = require('fs');

async function testAPI() {
    try {
        // 使用fetch API (Node.js 18+)
        const FormData = require('form-data');
        const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

        // 创建测试文件
        const csvContent = `name,phone,email
张三,13800138000,zhangsan@example.com
李四,13900139000,lisi@example.com
王五,invalid_phone,wangwu@example.com`;

        fs.writeFileSync('test-api.csv', csvContent);

        // 上传文件
        const form = new FormData();
        form.append('file', fs.createReadStream('test-api.csv'));

        console.log('上传文件...');
        const uploadResponse = await fetch('http://localhost:3100/api/data-cleaning/upload', {
            method: 'POST',
            body: form
        });

        if (!uploadResponse.ok) {
            throw new Error(`上传失败: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        const uploadResult = await uploadResponse.json();
        console.log('上传结果:', JSON.stringify(uploadResult, null, 2));

        const taskId = uploadResult.taskId;
        console.log(`任务ID: ${taskId}`);

        // 查询状态
        console.log('\n查询任务状态...');
        const statusResponse = await fetch(`http://localhost:3100/api/data-cleaning/check-status/${taskId}`);

        if (!statusResponse.ok) {
            console.error(`状态查询失败: ${statusResponse.status} ${statusResponse.statusText}`);
            const errorText = await statusResponse.text();
            console.error('错误响应:', errorText);
            return;
        }

        const status = await statusResponse.json();
        console.log('状态响应:', JSON.stringify(status, null, 2));

        // 清理
        fs.unlinkSync('test-api.csv');

    } catch (error) {
        console.error('测试失败:', error);
    }
}

testAPI();
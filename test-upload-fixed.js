const fs = require('fs');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testUpload() {
    try {
        // Create a simple test CSV file
        const csvContent = `name,phone,email,address
张三,13800138000,zhangsan@example.com,北京市朝阳区
李四,13900139000,lisi@example.com,上海市浦东新区
王五,invalid_phone,wangwu@example.com,广州市天河区`;

        fs.writeFileSync('test-data-fixed.csv', csvContent);

        // Upload the file
        const form = new FormData();
        form.append('file', fs.createReadStream('test-data-fixed.csv'));

        console.log('Uploading file...');
        const uploadResponse = await fetch('http://localhost:3100/api/data-cleaning/upload', {
            method: 'POST',
            body: form
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        const uploadResult = await uploadResponse.json();
        console.log('Upload result:', uploadResult);

        const taskId = uploadResult.taskId;
        console.log(`Task ID: ${taskId}`);

        // Check status multiple times
        for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

            console.log(`\nChecking status (attempt ${i + 1})...`);
            const statusResponse = await fetch(`http://localhost:3100/api/data-cleaning/check-status/${taskId}`);

            if (!statusResponse.ok) {
                console.error(`Status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
                const errorText = await statusResponse.text();
                console.error('Error response:', errorText);
                continue;
            }

            const status = await statusResponse.json();
            console.log('Status:', JSON.stringify(status, null, 2));

            if (status.status === 'completed' || status.status === 'failed') {
                console.log(`Task ${status.status}!`);
                break;
            }
        }

        // Clean up
        fs.unlinkSync('test-data-fixed.csv');

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testUpload();
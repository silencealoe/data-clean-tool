/**
 * 测试文件上传进度显示
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testUploadProgress() {
    console.log('开始测试文件上传进度...');

    // 使用现有的测试文件
    const filePath = './medium-test-data.csv';

    if (!fs.existsSync(filePath)) {
        console.error('测试文件不存在:', filePath);
        console.log('请先运行 node generate-medium-test-file.js 生成测试文件');
        return;
    }

    const fileStats = fs.statSync(filePath);
    console.log(`文件大小: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    let lastProgress = 0;
    let progressUpdates = 0;

    try {
        const response = await axios.post('http://localhost:3101/api/data-cleaning/upload', formData, {
            headers: {
                ...formData.getHeaders(),
            },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total) {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    if (progress !== lastProgress) {
                        console.log(`上传进度: ${progress}% (${progressEvent.loaded}/${progressEvent.total} bytes)`);
                        lastProgress = progress;
                        progressUpdates++;
                    }
                }
            },
            timeout: 60000, // 60秒超时
        });

        console.log('\n上传完成!');
        console.log('响应数据:', response.data);
        console.log(`总共收到 ${progressUpdates} 次进度更新`);

        if (progressUpdates <= 2) {
            console.log('\n⚠️  警告: 进度更新次数很少，可能是因为文件太小或上传太快');
            console.log('建议测试更大的文件来观察进度条效果');
        }

    } catch (error) {
        console.error('上传失败:', error.message);
        if (error.response) {
            console.error('错误响应:', error.response.data);
        }
    }
}

// 运行测试
testUploadProgress().catch(console.error);
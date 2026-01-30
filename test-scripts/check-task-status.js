/**
 * 检查任务状态的简单脚本
 */

const axios = require('axios');

async function checkTaskStatus(taskId) {
    try {
        console.log(`检查任务状态: ${taskId}`);

        const response = await axios.get(`http://localhost:3101/api/data-cleaning/check-status/${taskId}`);

        console.log('任务状态:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('查询失败:', error.response?.data || error.message);
    }
}

// 从命令行参数获取任务ID
const taskId = process.argv[2];

if (!taskId) {
    console.log('用法: node check-task-status.js <taskId>');
    console.log('例如: node check-task-status.js job_1769755918331_tch64pjtz');
    process.exit(1);
}

checkTaskStatus(taskId);
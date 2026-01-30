/**
 * 检查Redis队列状态
 */

const Redis = require('ioredis');

async function checkRedisQueue() {
    const redis = new Redis({
        host: 'localhost',
        port: 6379,
        db: 0,
        retryDelayOnFailover: 100,
        enableOfflineQueue: true,
        lazyConnect: false,
        maxRetriesPerRequest: 3,
        commandTimeout: 30000,
    });

    try {
        console.log('连接Redis...');

        // 检查连接
        const pong = await redis.ping();
        console.log('Redis连接状态:', pong);

        // 检查队列长度
        const queueLength = await redis.llen('data-cleaning-queue');
        console.log('队列长度:', queueLength);

        // 查看队列中的任务
        if (queueLength > 0) {
            const tasks = await redis.lrange('data-cleaning-queue', 0, -1);
            console.log('队列中的任务:');
            tasks.forEach((task, index) => {
                try {
                    const taskData = JSON.parse(task);
                    console.log(`  ${index + 1}. ${taskData.taskId} - ${taskData.fileName}`);
                } catch (e) {
                    console.log(`  ${index + 1}. ${task}`);
                }
            });
        } else {
            console.log('队列为空');
        }

        // 检查任务状态
        const taskId = 'job_1769755918331_tch64pjtz';
        console.log(`\n检查任务 ${taskId} 的状态:`);

        const statusKey = `task:status:${taskId}`;
        const statusData = await redis.hgetall(statusKey);

        if (Object.keys(statusData).length > 0) {
            console.log('任务状态:', statusData);
        } else {
            console.log('任务状态不存在');
        }

        const progressKey = `task:progress:${taskId}`;
        const progressData = await redis.hgetall(progressKey);

        if (Object.keys(progressData).length > 0) {
            console.log('任务进度:', progressData);
        } else {
            console.log('任务进度不存在');
        }

    } catch (error) {
        console.error('检查失败:', error.message);
    } finally {
        await redis.quit();
    }
}

checkRedisQueue();
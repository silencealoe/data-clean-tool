const Redis = require('ioredis');

async function checkRedis() {
    const redis = new Redis({
        host: 'localhost',
        port: 6379,
        db: 0,
    });

    try {
        console.log('Checking Redis...');

        // Check all possible queues
        const allKeys = await redis.keys('*');
        console.log('All Redis keys:');
        allKeys.forEach(key => console.log(`  - ${key}`));

        // Check specific queues
        const queues = ['file-processing', 'data-cleaning-queue', 'processing-queue'];
        for (const queueName of queues) {
            const length = await redis.llen(queueName);
            console.log(`Queue '${queueName}' length: ${length}`);
        }

        // Show task-related keys
        const taskKeys = allKeys.filter(key => key.includes('task'));
        console.log(`Task keys: ${taskKeys.length}`);
        taskKeys.forEach(key => console.log(`  - ${key}`));

        // Check recent task status
        const recentTaskId = 'job_1769748283050_3ai1pehu5';
        const taskStatus = await redis.hgetall(`task:status:${recentTaskId}`);
        const taskProgress = await redis.hgetall(`task:progress:${recentTaskId}`);

        console.log(`\nRecent task status (${recentTaskId}):`, taskStatus);
        console.log(`Recent task progress (${recentTaskId}):`, taskProgress);

    } catch (error) {
        console.error('Redis check failed:', error.message);
    } finally {
        redis.disconnect();
    }
}

checkRedis();
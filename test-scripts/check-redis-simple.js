const Redis = require('ioredis');

async function checkRedis() {
    const redis = new Redis({
        host: 'localhost',
        port: 6379,
        db: 0,
    });

    try {
        console.log('Checking Redis...');

        // Check queue
        const queueLength = await redis.llen('data-cleaning-queue');
        console.log(`Queue length: ${queueLength}`);

        // List all keys
        const allKeys = await redis.keys('*');
        console.log(`Total keys: ${allKeys.length}`);

        // Show task-related keys
        const taskKeys = allKeys.filter(key => key.includes('task'));
        console.log(`Task keys: ${taskKeys.length}`);
        taskKeys.forEach(key => console.log(`  - ${key}`));

        // Check recent task status
        if (taskKeys.length > 0) {
            const latestTaskKey = taskKeys[taskKeys.length - 1];
            const taskData = await redis.hgetall(latestTaskKey);
            console.log(`Latest task (${latestTaskKey}):`, taskData);
        }

    } catch (error) {
        console.error('Redis check failed:', error.message);
    } finally {
        redis.disconnect();
    }
}

checkRedis();
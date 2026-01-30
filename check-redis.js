const Redis = require('ioredis');

async function checkRedis() {
    const redis = new Redis({
        host: 'localhost',
        port: 6379,
        db: 0,
    });

    try {
        console.log('Checking Redis connection...');
        await redis.ping();
        console.log('✓ Redis connection successful');

        // Check queue
        console.log('\nChecking queue...');
        const queueLength = await redis.llen('data-cleaning-queue');
        console.log(`Queue length: ${queueLength}`);

        if (queueLength > 0) {
            const tasks = await redis.lrange('data-cleaning-queue', 0, -1);
            console.log('Tasks in queue:');
            tasks.forEach((task, index) => {
                console.log(`${index + 1}. ${task}`);
            });
        }

        // Check task statuses
        console.log('\nChecking task statuses...');
        const keys = await redis.keys('task:status:*');
        console.log(`Found ${keys.length} task status keys`);

        for (const key of keys) {
            const status = await redis.hgetall(key);
            console.log(`${key}:`, status);
        }

        // Check progress
        console.log('\nChecking progress...');
        const progressKeys = await redis.keys('task:progress:*');
        console.log(`Found ${progressKeys.length} progress keys`);

        for (const key of progressKeys) {
            const progress = await redis.hgetall(key);
            console.log(`${key}:`, progress);
        }

    } catch (error) {
        console.error('Redis check failed:', error.message);
    } finally {
        redis.disconnect();
    }
}

checkRedis();
const Redis = require('ioredis');

async function testQueue() {
    const redis = new Redis({
        host: 'localhost',
        port: 6379,
        db: 0,
        enableOfflineQueue: true,
        lazyConnect: false,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
    });

    try {
        console.log('Testing queue operations...');

        // Test basic connection
        const pong = await redis.ping();
        console.log('✓ Redis ping response:', pong);

        const queueName = 'file-processing';

        // Clear queue first
        await redis.del(queueName);
        console.log('✓ Queue cleared');

        const testTask = {
            taskId: 'test-task-' + Date.now(),
            message: 'test message'
        };

        // Test enqueue
        console.log('Testing enqueue...');
        const pushResult = await redis.lpush(queueName, JSON.stringify(testTask));
        console.log('✓ Task enqueued, result:', pushResult);

        // Check queue length immediately
        const length = await redis.llen(queueName);
        console.log(`Queue length after push: ${length}`);

        // List all items in queue
        const items = await redis.lrange(queueName, 0, -1);
        console.log('Queue items:', items);

        // Test dequeue with longer timeout
        console.log('Testing dequeue with 5 second timeout...');
        const result = await redis.brpop(queueName, 5);
        if (result) {
            console.log('✓ Task dequeued:', JSON.parse(result[1]));
        } else {
            console.log('✗ No task dequeued (timeout)');
        }

        // Final queue length
        const finalLength = await redis.llen(queueName);
        console.log(`Final queue length: ${finalLength}`);

    } catch (error) {
        console.error('Queue test failed:', error);
    } finally {
        redis.disconnect();
    }
}

testQueue();
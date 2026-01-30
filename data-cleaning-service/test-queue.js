const Redis = require('ioredis');

async function testQueue() {
    const redis = new Redis({
        host: 'localhost',
        port: 6379,
        db: 0,
    });

    try {
        console.log('Testing queue operations...');

        // Test basic connection
        await redis.ping();
        console.log('✓ Redis connection successful');

        const queueName = 'file-processing';
        const testTask = {
            taskId: 'test-task-' + Date.now(),
            message: 'test message'
        };

        // Test enqueue
        console.log('Testing enqueue...');
        await redis.lpush(queueName, JSON.stringify(testTask));
        console.log('✓ Task enqueued');

        // Check queue length
        const length = await redis.llen(queueName);
        console.log(`Queue length: ${length}`);

        // Test dequeue
        console.log('Testing dequeue...');
        const result = await redis.brpop(queueName, 1);
        if (result) {
            console.log('✓ Task dequeued:', JSON.parse(result[1]));
        } else {
            console.log('✗ No task dequeued (timeout)');
        }

        // Final queue length
        const finalLength = await redis.llen(queueName);
        console.log(`Final queue length: ${finalLength}`);

    } catch (error) {
        console.error('Queue test failed:', error.message);
    } finally {
        redis.disconnect();
    }
}

testQueue();
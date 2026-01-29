/**
 * Queue Demo Script
 * 
 * This script demonstrates the basic queue operations:
 * - Enqueue tasks
 * - Dequeue tasks
 * - Status management
 * - Progress tracking
 * 
 * Run with: ts-node -r tsconfig-paths/register src/demo/queue-demo.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QueueManagerService } from '../services/queue';
import { ProcessingTask, TaskStatus } from '../common/types/queue.types';

async function runQueueDemo() {
    console.log('🚀 Starting Queue Demo...\n');

    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    const queueManager = app.get(QueueManagerService);

    try {
        // Test Redis connection
        console.log('1. Testing Redis connection...');
        const isHealthy = await queueManager.isHealthy();
        console.log(`   Redis status: ${isHealthy ? '✅ Connected' : '❌ Disconnected'}\n`);

        if (!isHealthy) {
            console.log('⚠️  Redis is not available. Please start Redis server to run the full demo.');
            console.log('   You can start Redis with: redis-server\n');
            return;
        }

        // Clear queue for clean demo
        console.log('2. Clearing queue for clean demo...');
        await queueManager.clearQueue();
        console.log('   ✅ Queue cleared\n');

        // Create sample tasks
        console.log('3. Creating sample tasks...');
        const tasks: ProcessingTask[] = [
            {
                taskId: 'demo-task-1',
                fileId: 'file-1',
                filePath: '/tmp/sample1.csv',
                originalFileName: 'sample1.csv',
                fileSize: 1024,
                createdAt: new Date(),
                retryCount: 0,
            },
            {
                taskId: 'demo-task-2',
                fileId: 'file-2',
                filePath: '/tmp/sample2.csv',
                originalFileName: 'sample2.csv',
                fileSize: 2048,
                createdAt: new Date(),
                retryCount: 0,
            },
            {
                taskId: 'demo-task-3',
                fileId: 'file-3',
                filePath: '/tmp/sample3.csv',
                originalFileName: 'sample3.csv',
                fileSize: 4096,
                createdAt: new Date(),
                retryCount: 0,
            },
        ];

        // Enqueue tasks
        console.log('4. Enqueuing tasks...');
        for (const task of tasks) {
            await queueManager.enqueueTask(task);
            console.log(`   ✅ Enqueued: ${task.taskId} (${task.originalFileName})`);
        }

        // Check queue stats
        console.log('\n5. Checking queue statistics...');
        const stats = await queueManager.getQueueStats();
        console.log(`   Queue length: ${stats.queueLength}`);
        console.log(`   Total enqueued: ${stats.totalEnqueued}`);
        console.log(`   Total processed: ${stats.totalProcessed}`);
        console.log(`   Total failed: ${stats.totalFailed}\n`);

        // Dequeue and process tasks
        console.log('6. Dequeuing and simulating task processing...');
        for (let i = 0; i < tasks.length; i++) {
            const task = await queueManager.dequeueTask(5); // 5 second timeout

            if (task) {
                console.log(`   📤 Dequeued: ${task.taskId}`);

                // Simulate processing with status updates
                await queueManager.setTaskStatus(task.taskId, TaskStatus.PROCESSING, {
                    startedAt: new Date(),
                });
                console.log(`   🔄 Status updated to PROCESSING`);

                // Simulate progress updates
                for (let progress = 0; progress <= 100; progress += 25) {
                    await queueManager.updateProgress(task.taskId, {
                        taskId: task.taskId,
                        progress,
                        processedRows: progress * 10,
                        totalRows: 1000,
                        currentPhase: progress === 100 ? 'completed' : 'processing',
                    });
                    console.log(`   📊 Progress: ${progress}%`);

                    // Small delay to simulate processing time
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Mark as completed
                await queueManager.setTaskStatus(task.taskId, TaskStatus.COMPLETED, {
                    completedAt: new Date(),
                    statistics: {
                        totalRows: 1000,
                        processedRows: 1000,
                        validRows: 950,
                        invalidRows: 50,
                        duplicateRows: 0,
                        processingTimeMs: 500,
                    },
                });
                console.log(`   ✅ Task completed: ${task.taskId}\n`);
            } else {
                console.log(`   ⏰ Timeout waiting for task\n`);
            }
        }

        // Final queue stats
        console.log('7. Final queue statistics...');
        const finalStats = await queueManager.getQueueStats();
        console.log(`   Queue length: ${finalStats.queueLength}`);
        console.log(`   Total enqueued: ${finalStats.totalEnqueued}`);
        console.log(`   Total processed: ${finalStats.totalProcessed}`);
        console.log(`   Total failed: ${finalStats.totalFailed}\n`);

        // Test status retrieval
        console.log('8. Testing status retrieval...');
        for (const task of tasks) {
            try {
                const status = await queueManager.getTaskStatus(task.taskId);
                const progress = await queueManager.getProgress(task.taskId);
                console.log(`   📋 ${task.taskId}: ${status.status} (${progress.progress}%)`);
            } catch (error) {
                console.log(`   ❌ ${task.taskId}: Error retrieving status`);
            }
        }

        console.log('\n🎉 Queue demo completed successfully!');

    } catch (error) {
        console.error('❌ Demo failed:', error.message);
    } finally {
        await app.close();
    }
}

// Run the demo
if (require.main === module) {
    runQueueDemo().catch(console.error);
}
import { registerAs } from '@nestjs/config';

export default registerAs('queue', () => ({
    queueName: process.env.QUEUE_NAME || 'file-processing',
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
    taskTimeoutMs: parseInt(process.env.TASK_TIMEOUT_MS || '1800000', 10), // 30 minutes
    taskTtlSeconds: parseInt(process.env.TASK_TTL_SECONDS || '604800', 10), // 7 days
    progressUpdateIntervalMs: parseInt(process.env.PROGRESS_UPDATE_INTERVAL_MS || '2000', 10),
}));
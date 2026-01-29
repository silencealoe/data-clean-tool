import { registerAs } from '@nestjs/config';

export default registerAs('queue', () => ({
    queueName: process.env.QUEUE_NAME || 'file-processing',
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
    taskTimeoutMs: parseInt(process.env.TASK_TIMEOUT_MS || '1800000', 10), // 30 minutes
    taskTtlSeconds: parseInt(process.env.TASK_TTL_SECONDS || '604800', 10), // 7 days
    progressUpdateIntervalMs: parseInt(process.env.PROGRESS_UPDATE_INTERVAL_MS || '2000', 10),
    maxProcessingTimeMs: parseInt(process.env.MAX_PROCESSING_TIME_MS || '1800000', 10), // 30 minutes
    timeoutCheckIntervalMs: parseInt(process.env.TIMEOUT_CHECK_INTERVAL_MS || '60000', 10), // 1 minute
    baseRetryDelay: parseInt(process.env.BASE_RETRY_DELAY_MS || '1000', 10), // 1 second
    // Recovery configuration
    recovery: {
        abandonedTaskThresholdMs: parseInt(process.env.ABANDONED_TASK_THRESHOLD_MS || '3600000', 10), // 1 hour
        maxRecoveryAttempts: parseInt(process.env.MAX_RECOVERY_ATTEMPTS || '3', 10),
        batchSize: parseInt(process.env.RECOVERY_BATCH_SIZE || '50', 10),
        enableAutoRecovery: process.env.ENABLE_AUTO_RECOVERY !== 'false', // Default true
        checkIntervalMs: parseInt(process.env.RECOVERY_CHECK_INTERVAL_MS || '600000', 10), // 10 minutes
    }
}));
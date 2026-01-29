export interface ProcessingTask {
    taskId: string;
    fileId: string;
    filePath: string;
    originalFileName: string;
    fileSize: number;
    createdAt: Date;
    retryCount: number;
}

export interface TaskStatusInfo {
    taskId: string;
    status: TaskStatus;
    progress: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    errorMessage?: string;
    statistics?: ProcessingStatistics;
}

export interface ProgressInfo {
    taskId: string;
    progress: number;
    processedRows: number;
    totalRows: number;
    currentPhase: string;
    estimatedTimeRemaining?: number;
    lastUpdated?: Date;
}

export interface ProcessingStatistics {
    totalRows: number;
    processedRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    processingTimeMs: number;
}

export interface QueueStats {
    queueLength: number;
    totalEnqueued: number;
    totalProcessed: number;
    totalFailed: number;
    activeWorkers: number;
}

export enum TaskStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    TIMEOUT = 'timeout'
}

export interface QueueManagerInterface {
    // Queue operations
    enqueueTask(task: ProcessingTask): Promise<string>;
    dequeueTask(timeout?: number): Promise<ProcessingTask | null>;

    // Status management
    setTaskStatus(taskId: string, status: TaskStatus, data?: any): Promise<void>;
    getTaskStatus(taskId: string): Promise<TaskStatusInfo>;

    // Progress management
    updateProgress(taskId: string, progress: ProgressInfo): Promise<void>;
    getProgress(taskId: string): Promise<ProgressInfo>;

    // Health check
    isHealthy(): Promise<boolean>;
    getQueueStats(): Promise<QueueStats>;
}
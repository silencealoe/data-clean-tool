/**
 * Parallel Processor Service
 * 
 * Implements parallel processing support for independent field validations
 * to optimize large dataset processing performance.
 * 
 * Requirements: 需求 7.4
 */

import { Injectable, Logger } from '@nestjs/common';
import {
    FieldProcessingResult,
    ParallelProcessingConfig,
    PerformanceMetrics,
    ValidationError,
    ValidationErrorType
} from '../../common/types/rule-engine.types';
import { FieldProcessorService } from './field-processor.service';

/**
 * Field processing task for parallel execution
 */
interface FieldProcessingTask {
    fieldName: string;
    value: any;
    columnType: string;
    rowData?: Record<string, any>;
    taskId: string;
}

/**
 * Parallel processing result with task metadata
 */
interface ParallelProcessingResult {
    taskId: string;
    result: FieldProcessingResult;
    processingTime: number;
    error?: Error;
}

/**
 * Worker pool for managing concurrent field processing
 */
class FieldProcessingWorkerPool {
    private readonly logger = new Logger('FieldProcessingWorkerPool');
    private activeTasks = new Map<string, Promise<ParallelProcessingResult>>();
    private readonly maxConcurrency: number;

    constructor(maxConcurrency: number) {
        this.maxConcurrency = maxConcurrency;
    }

    /**
     * Execute field processing task with concurrency control
     * @param task Field processing task
     * @param processor Field processor instance
     * @returns Promise resolving to processing result
     */
    async executeTask(
        task: FieldProcessingTask,
        processor: FieldProcessorService
    ): Promise<ParallelProcessingResult> {
        // Wait for available slot if at max concurrency
        while (this.activeTasks.size >= this.maxConcurrency) {
            await this.waitForAnyTaskCompletion();
        }

        const taskPromise = this.processFieldTask(task, processor);
        this.activeTasks.set(task.taskId, taskPromise);

        try {
            const result = await taskPromise;
            return result;
        } finally {
            this.activeTasks.delete(task.taskId);
        }
    }

    /**
     * Execute multiple tasks in parallel with concurrency control
     * @param tasks Array of field processing tasks
     * @param processor Field processor instance
     * @returns Promise resolving to array of processing results
     */
    async executeTasks(
        tasks: FieldProcessingTask[],
        processor: FieldProcessorService
    ): Promise<ParallelProcessingResult[]> {
        const results: ParallelProcessingResult[] = [];
        const taskPromises: Promise<ParallelProcessingResult>[] = [];

        // Start all tasks with concurrency control
        for (const task of tasks) {
            const taskPromise = this.executeTask(task, processor);
            taskPromises.push(taskPromise);
        }

        // Wait for all tasks to complete
        const allResults = await Promise.allSettled(taskPromises);

        // Process results
        for (let i = 0; i < allResults.length; i++) {
            const result = allResults[i];
            if (result.status === 'fulfilled') {
                results.push(result.value);
            } else {
                // Handle rejected task
                const task = tasks[i];
                results.push({
                    taskId: task.taskId,
                    result: {
                        fieldName: task.fieldName,
                        originalValue: task.value,
                        processedValue: task.value,
                        success: false,
                        errors: [
                            new ValidationError(
                                ValidationErrorType.PROCESSING_ERROR,
                                task.fieldName,
                                task.value,
                                `Parallel processing failed: ${result.reason}`,
                                { error: result.reason }
                            )
                        ],
                        appliedRules: []
                    },
                    processingTime: 0,
                    error: result.reason
                });
            }
        }

        return results;
    }

    /**
     * Get current pool statistics
     * @returns Pool statistics
     */
    getStats() {
        return {
            maxConcurrency: this.maxConcurrency,
            activeTasks: this.activeTasks.size,
            availableSlots: this.maxConcurrency - this.activeTasks.size
        };
    }

    /**
     * Shutdown worker pool and wait for active tasks
     */
    async shutdown(): Promise<void> {
        this.logger.log(`Shutting down worker pool with ${this.activeTasks.size} active tasks`);

        if (this.activeTasks.size > 0) {
            await Promise.allSettled(Array.from(this.activeTasks.values()));
        }

        this.activeTasks.clear();
        this.logger.log('Worker pool shutdown complete');
    }

    /**
     * Process individual field task
     * @param task Field processing task
     * @param processor Field processor instance
     * @returns Promise resolving to processing result
     */
    private async processFieldTask(
        task: FieldProcessingTask,
        processor: FieldProcessorService
    ): Promise<ParallelProcessingResult> {
        const startTime = Date.now();

        try {
            const result = await processor.processField(
                task.fieldName,
                task.value,
                task.columnType,
                task.rowData
            );

            const processingTime = Date.now() - startTime;

            return {
                taskId: task.taskId,
                result,
                processingTime
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.logger.error(`Field processing task failed: ${task.taskId}`, error);

            return {
                taskId: task.taskId,
                result: {
                    fieldName: task.fieldName,
                    originalValue: task.value,
                    processedValue: task.value,
                    success: false,
                    errors: [
                        new ValidationError(
                            ValidationErrorType.PROCESSING_ERROR,
                            task.fieldName,
                            task.value,
                            `Field processing failed: ${error.message}`,
                            { error: error.message }
                        )
                    ],
                    appliedRules: []
                },
                processingTime,
                error
            };
        }
    }

    /**
     * Wait for any active task to complete
     */
    private async waitForAnyTaskCompletion(): Promise<void> {
        if (this.activeTasks.size === 0) {
            return;
        }

        await Promise.race(Array.from(this.activeTasks.values()));
    }
}

/**
 * Parallel processor service implementation
 */
@Injectable()
export class ParallelProcessorService {
    private readonly logger = new Logger(ParallelProcessorService.name);
    private readonly config: ParallelProcessingConfig;
    private workerPool: FieldProcessingWorkerPool;

    constructor(
        private readonly fieldProcessor: FieldProcessorService
    ) {
        this.config = {
            maxConcurrency: 4,
            batchSize: 100,
            fieldTimeoutMs: 5000,
            enabled: true
        };

        this.workerPool = new FieldProcessingWorkerPool(this.config.maxConcurrency);
        this.logger.log(`Parallel processor initialized with concurrency: ${this.config.maxConcurrency}`);
    }

    /**
     * Process row data with parallel field validation
     * @param rowData Row data to process
     * @param columnTypes Column type mapping
     * @returns Promise resolving to field processing results
     */
    async processRowParallel(
        rowData: Record<string, any>,
        columnTypes: Record<string, string>
    ): Promise<{
        fieldResults: FieldProcessingResult[];
        metrics: PerformanceMetrics;
    }> {
        const startTime = Date.now();
        const memoryBefore = process.memoryUsage();

        if (!this.config.enabled) {
            // Fallback to sequential processing
            return this.processRowSequential(rowData, columnTypes);
        }

        this.logger.debug(`Processing row with ${Object.keys(rowData).length} fields in parallel`);

        try {
            // Create processing tasks for each field
            const tasks: FieldProcessingTask[] = Object.entries(rowData).map(([fieldName, value], index) => ({
                fieldName,
                value,
                columnType: columnTypes[fieldName] || 'TEXT',
                rowData,
                taskId: `${fieldName}_${index}_${Date.now()}`
            }));

            // Process tasks in parallel
            const parallelResults = await this.workerPool.executeTasks(tasks, this.fieldProcessor);

            // Extract field results and sort by original field order
            const fieldResults = parallelResults
                .sort((a, b) => {
                    const aIndex = tasks.findIndex(t => t.taskId === a.taskId);
                    const bIndex = tasks.findIndex(t => t.taskId === b.taskId);
                    return aIndex - bIndex;
                })
                .map(pr => pr.result);

            // Calculate performance metrics
            const totalTime = Date.now() - startTime;
            const memoryAfter = process.memoryUsage();
            const avgFieldTime = parallelResults.length > 0
                ? parallelResults.reduce((sum, pr) => sum + pr.processingTime, 0) / parallelResults.length
                : 0;

            const metrics: PerformanceMetrics = {
                totalTime,
                avgFieldTime,
                parallelFields: parallelResults.length,
                cacheHitRate: 0, // Will be updated by strategy factory if available
                memoryUsage: {
                    heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
                    heapTotal: memoryAfter.heapTotal,
                    external: memoryAfter.external - memoryBefore.external
                }
            };

            this.logger.debug(
                `Parallel processing completed: ${fieldResults.length} fields, ` +
                `${totalTime}ms total, ${avgFieldTime.toFixed(2)}ms avg per field`
            );

            return { fieldResults, metrics };

        } catch (error) {
            this.logger.error('Parallel processing failed, falling back to sequential:', error);
            return this.processRowSequential(rowData, columnTypes);
        }
    }

    /**
     * Process multiple rows with parallel field validation
     * @param rows Array of row data to process
     * @param columnTypes Column type mapping
     * @returns Promise resolving to array of processing results
     */
    async processRowsParallel(
        rows: Record<string, any>[],
        columnTypes: Record<string, string>
    ): Promise<Array<{
        fieldResults: FieldProcessingResult[];
        metrics: PerformanceMetrics;
    }>> {
        const startTime = Date.now();
        this.logger.log(`Processing ${rows.length} rows with parallel field validation`);

        const results: Array<{
            fieldResults: FieldProcessingResult[];
            metrics: PerformanceMetrics;
        }> = [];

        // Process rows in batches to manage memory
        for (let i = 0; i < rows.length; i += this.config.batchSize) {
            const batchEnd = Math.min(i + this.config.batchSize, rows.length);
            const batch = rows.slice(i, batchEnd);

            this.logger.debug(`Processing batch ${Math.floor(i / this.config.batchSize) + 1}: rows ${i + 1}-${batchEnd}`);

            // Process batch rows in parallel
            const batchPromises = batch.map(rowData =>
                this.processRowParallel(rowData, columnTypes)
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Log progress for large datasets
            if (i > 0 && i % (this.config.batchSize * 10) === 0) {
                const elapsed = Date.now() - startTime;
                const rate = (i / elapsed) * 1000;
                this.logger.log(`Batch progress: ${i}/${rows.length} rows (${rate.toFixed(0)} rows/sec)`);
            }
        }

        const totalTime = Date.now() - startTime;
        this.logger.log(
            `Parallel batch processing completed: ${rows.length} rows, ` +
            `${totalTime}ms total (${(rows.length / totalTime * 1000).toFixed(0)} rows/sec)`
        );

        return results;
    }

    /**
     * Check if parallel processing should be used for given data size
     * @param fieldCount Number of fields to process
     * @param rowCount Number of rows to process
     * @returns True if parallel processing is beneficial
     */
    shouldUseParallelProcessing(fieldCount: number, rowCount: number = 1): boolean {
        if (!this.config.enabled) {
            return false;
        }

        // Use parallel processing for:
        // - Rows with many fields (>= 5)
        // - Multiple rows with moderate field count (>= 3)
        // - Large datasets
        const totalFields = fieldCount * rowCount;

        return (fieldCount >= 5) ||
            (rowCount > 1 && fieldCount >= 3) ||
            (totalFields >= 20);
    }

    /**
     * Update parallel processing configuration
     * @param newConfig New configuration options
     */
    updateConfig(newConfig: Partial<ParallelProcessingConfig>): void {
        const oldConcurrency = this.config.maxConcurrency;
        Object.assign(this.config, newConfig);

        // Recreate worker pool if concurrency changed
        if (this.config.maxConcurrency !== oldConcurrency) {
            this.workerPool.shutdown();
            this.workerPool = new FieldProcessingWorkerPool(this.config.maxConcurrency);
            this.logger.log(`Worker pool recreated with concurrency: ${this.config.maxConcurrency}`);
        }

        this.logger.log('Parallel processing configuration updated');
    }

    /**
     * Get current configuration
     * @returns Current parallel processing configuration
     */
    getConfig(): ParallelProcessingConfig {
        return { ...this.config };
    }

    /**
     * Get worker pool statistics
     * @returns Worker pool statistics
     */
    getWorkerPoolStats() {
        return this.workerPool.getStats();
    }

    /**
     * Shutdown parallel processor and cleanup resources
     */
    async shutdown(): Promise<void> {
        this.logger.log('Shutting down parallel processor...');
        await this.workerPool.shutdown();
        this.logger.log('Parallel processor shutdown complete');
    }

    /**
     * Fallback to sequential processing
     * @param rowData Row data to process
     * @param columnTypes Column type mapping
     * @returns Promise resolving to processing results
     */
    private async processRowSequential(
        rowData: Record<string, any>,
        columnTypes: Record<string, string>
    ): Promise<{
        fieldResults: FieldProcessingResult[];
        metrics: PerformanceMetrics;
    }> {
        const startTime = Date.now();
        const memoryBefore = process.memoryUsage();
        const fieldResults: FieldProcessingResult[] = [];

        for (const [fieldName, value] of Object.entries(rowData)) {
            const columnType = columnTypes[fieldName] || 'TEXT';
            const result = await this.fieldProcessor.processField(fieldName, value, columnType, rowData);
            fieldResults.push(result);
        }

        const totalTime = Date.now() - startTime;
        const memoryAfter = process.memoryUsage();
        const avgFieldTime = fieldResults.length > 0 ? totalTime / fieldResults.length : 0;

        const metrics: PerformanceMetrics = {
            totalTime,
            avgFieldTime,
            parallelFields: 0, // Sequential processing
            cacheHitRate: 0,
            memoryUsage: {
                heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
                heapTotal: memoryAfter.heapTotal,
                external: memoryAfter.external - memoryBefore.external
            }
        };

        return { fieldResults, metrics };
    }
}
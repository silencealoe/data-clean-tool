/**
 * Rule Engine Core Service
 * 
 * Main engine class that integrates all rule engine components and provides
 * the primary interface for data cleaning with configurable rules.
 * Maintains backward compatibility with existing DataCleanerService API.
 * 
 * Requirements: 需求 5.3, 5.4
 */

import { Injectable, Logger } from '@nestjs/common';
import {
    RuleEngine as IRuleEngine,
    RuleEngineResult,
    RuleConfiguration,
    ValidationResult,
    ValidationError,
    ValidationErrorType,
    FieldProcessingResult,
    PerformanceMetrics,
    ParallelProcessingConfig
} from '../../common/types/rule-engine.types';
import {
    CleaningResult,
    CleanedRow,
    ExceptionRow,
    FieldError,
    Statistics,
    ColumnTypeMap,
    ColumnType,
    RowData,
    CleanResult
} from '../../common/types';
import { FieldProcessorService } from './field-processor.service';
import { RuleLoaderService } from './rule-loader.service';
import { ConfigValidatorService } from './config-validator.service';
import { ParallelProcessorService } from './parallel-processor.service';

/**
 * Batch processing configuration
 */
interface BatchConfig {
    batchSize: number;
    maxConcurrency: number;
    timeoutMs: number;
}

/**
 * Processing context for rule engine operations
 */
interface ProcessingContext {
    jobId?: string;
    startTime: number;
    processedRows: number;
    totalRows: number;
    errors: ValidationError[];
    metadata: Record<string, any>;
}

/**
 * Rule engine core service implementation
 */
@Injectable()
export class RuleEngineService implements IRuleEngine {
    private readonly logger = new Logger(RuleEngineService.name);

    // Default batch configuration
    private readonly defaultBatchConfig: BatchConfig = {
        batchSize: 1000,
        maxConcurrency: 4,
        timeoutMs: 30000
    };

    constructor(
        private readonly fieldProcessor: FieldProcessorService,
        private readonly ruleLoader: RuleLoaderService,
        private readonly configValidator: ConfigValidatorService,
        private readonly parallelProcessor: ParallelProcessorService
    ) {
        this.logger.log('RuleEngineService initialized with parallel processing support');
    }

    /**
     * Clean a single row of data using configured rules
     * @param rowData Row data to clean
     * @param columnTypes Column type mapping
     * @returns Rule engine processing result
     */
    async cleanRow(
        rowData: Record<string, any>,
        columnTypes: Record<string, string>
    ): Promise<RuleEngineResult> {
        const startTime = Date.now();
        const context: ProcessingContext = {
            startTime,
            processedRows: 0,
            totalRows: 1,
            errors: [],
            metadata: {}
        };

        this.logger.debug(`Processing single row with ${Object.keys(rowData).length} fields`);

        try {
            const fieldCount = Object.keys(rowData).length;
            let fieldResults: FieldProcessingResult[];
            let processingMetrics: PerformanceMetrics | undefined;

            // Determine if parallel processing should be used
            if (this.parallelProcessor.shouldUseParallelProcessing(fieldCount)) {
                this.logger.debug('Using parallel processing for row');
                const parallelResult = await this.parallelProcessor.processRowParallel(rowData, columnTypes);
                fieldResults = parallelResult.fieldResults;
                processingMetrics = parallelResult.metrics;
            } else {
                this.logger.debug('Using sequential processing for row');
                fieldResults = [];
                const processedData: Record<string, any> = {};

                // Process each field sequentially
                for (const [fieldName, originalValue] of Object.entries(rowData)) {
                    const columnType = columnTypes[fieldName] || ColumnType.TEXT;

                    try {
                        const fieldResult = await this.fieldProcessor.processField(
                            fieldName,
                            originalValue,
                            columnType,
                            rowData
                        );

                        fieldResults.push(fieldResult);

                    } catch (error) {
                        this.logger.error(`Error processing field ${fieldName}:`, error);

                        const fieldError = new ValidationError(
                            ValidationErrorType.PROCESSING_ERROR,
                            fieldName,
                            originalValue,
                            `Field processing failed: ${error.message}`,
                            { error: error.message }
                        );

                        fieldResults.push({
                            fieldName,
                            originalValue,
                            processedValue: originalValue,
                            success: false,
                            errors: [fieldError],
                            appliedRules: []
                        });
                    }
                }
            }

            // Build processed data and collect errors
            const processedData: Record<string, any> = {};
            const allErrors: ValidationError[] = [];

            fieldResults.forEach(fieldResult => {
                if (fieldResult.success) {
                    processedData[fieldResult.fieldName] = fieldResult.processedValue;
                } else {
                    processedData[fieldResult.fieldName] = fieldResult.originalValue;
                    allErrors.push(...fieldResult.errors);
                }
            });

            const processingTime = Date.now() - startTime;
            const success = allErrors.length === 0;

            const result: RuleEngineResult = {
                success,
                fieldResults,
                processedData,
                errors: allErrors,
                metadata: {
                    processingTime,
                    rulesApplied: fieldResults.reduce((sum, fr) => sum + fr.appliedRules.length, 0),
                    fieldsProcessed: fieldResults.length,
                    parallelProcessing: processingMetrics !== undefined,
                    performanceMetrics: processingMetrics
                }
            };

            this.logger.debug(`Row processing completed: success=${success}, time=${processingTime}ms`);
            return result;

        } catch (error) {
            this.logger.error('Row processing failed:', error);

            const processingTime = Date.now() - startTime;
            return {
                success: false,
                fieldResults: [],
                processedData: rowData,
                errors: [
                    new ValidationError(
                        ValidationErrorType.PROCESSING_ERROR,
                        'row',
                        rowData,
                        `Row processing failed: ${error.message}`,
                        { error: error.message }
                    )
                ],
                metadata: {
                    processingTime,
                    rulesApplied: 0,
                    fieldsProcessed: 0,
                    parallelProcessing: false
                }
            };
        }
    }

    /**
     * Clean multiple rows of data in batches with parallel processing
     * @param rows Array of row data to clean
     * @param columnTypes Column type mapping
     * @returns Array of rule engine processing results
     */
    async cleanBatch(
        rows: Record<string, any>[],
        columnTypes: Record<string, string>
    ): Promise<RuleEngineResult[]> {
        const startTime = Date.now();
        const totalRows = rows.length;

        this.logger.log(`Starting batch processing: ${totalRows} rows`);

        if (totalRows === 0) {
            return [];
        }

        const results: RuleEngineResult[] = [];
        const batchConfig = this.defaultBatchConfig;

        try {
            const fieldCount = rows.length > 0 ? Object.keys(rows[0]).length : 0;

            // Determine if parallel processing should be used for the batch
            if (this.parallelProcessor.shouldUseParallelProcessing(fieldCount, totalRows)) {
                this.logger.log('Using parallel processing for batch');

                // Process rows in batches with parallel field processing
                for (let i = 0; i < totalRows; i += batchConfig.batchSize) {
                    const batchEnd = Math.min(i + batchConfig.batchSize, totalRows);
                    const batch = rows.slice(i, batchEnd);

                    this.logger.debug(`Processing parallel batch ${Math.floor(i / batchConfig.batchSize) + 1}: rows ${i + 1}-${batchEnd}`);

                    // Use parallel processor for the batch
                    const batchProcessingResults = await this.parallelProcessor.processRowsParallel(batch, columnTypes);

                    // Convert parallel processing results to rule engine results
                    const batchResults = batchProcessingResults.map((processingResult, index) => {
                        const rowData = batch[index];
                        const { fieldResults, metrics } = processingResult;

                        const processedData: Record<string, any> = {};
                        const allErrors: ValidationError[] = [];

                        fieldResults.forEach(fieldResult => {
                            if (fieldResult.success) {
                                processedData[fieldResult.fieldName] = fieldResult.processedValue;
                            } else {
                                processedData[fieldResult.fieldName] = fieldResult.originalValue;
                                allErrors.push(...fieldResult.errors);
                            }
                        });

                        const success = allErrors.length === 0;

                        return {
                            success,
                            fieldResults,
                            processedData,
                            errors: allErrors,
                            metadata: {
                                processingTime: metrics.totalTime,
                                rulesApplied: fieldResults.reduce((sum, fr) => sum + fr.appliedRules.length, 0),
                                fieldsProcessed: fieldResults.length,
                                parallelProcessing: true,
                                performanceMetrics: metrics
                            }
                        } as RuleEngineResult;
                    });

                    results.push(...batchResults);

                    // Log progress
                    if (i > 0 && i % (batchConfig.batchSize * 10) === 0) {
                        const elapsed = Date.now() - startTime;
                        const rate = (i / elapsed) * 1000;
                        this.logger.log(`Parallel batch progress: ${i}/${totalRows} rows (${rate.toFixed(0)} rows/sec)`);
                    }
                }
            } else {
                this.logger.log('Using sequential processing for batch');

                // Process rows in batches sequentially
                for (let i = 0; i < totalRows; i += batchConfig.batchSize) {
                    const batchEnd = Math.min(i + batchConfig.batchSize, totalRows);
                    const batch = rows.slice(i, batchEnd);

                    this.logger.debug(`Processing sequential batch ${Math.floor(i / batchConfig.batchSize) + 1}: rows ${i + 1}-${batchEnd}`);

                    // Process batch with concurrency control
                    const batchResults = await this.processBatchConcurrently(batch, columnTypes, batchConfig);
                    results.push(...batchResults);

                    // Log progress
                    if (i > 0 && i % (batchConfig.batchSize * 10) === 0) {
                        const elapsed = Date.now() - startTime;
                        const rate = (i / elapsed) * 1000;
                        this.logger.log(`Sequential batch progress: ${i}/${totalRows} rows (${rate.toFixed(0)} rows/sec)`);
                    }
                }
            }

            const totalTime = Date.now() - startTime;
            const successCount = results.filter(r => r.success).length;
            const errorCount = results.length - successCount;

            this.logger.log(
                `Batch processing completed: ${totalRows} rows, ` +
                `${successCount} successful, ${errorCount} errors, ` +
                `${totalTime}ms total (${(totalRows / totalTime * 1000).toFixed(0)} rows/sec)`
            );

            return results;

        } catch (error) {
            this.logger.error('Batch processing failed:', error);
            throw error;
        }
    }

    /**
     * Get current rule engine configuration
     * @returns Current rule configuration
     */
    getConfiguration(): RuleConfiguration {
        const config = this.ruleLoader.getCurrentConfiguration();
        if (!config) {
            throw new Error('No rule configuration loaded');
        }
        return config;
    }

    /**
     * Update rule engine configuration with validation
     * @param config New rule configuration
     * @returns Validation result
     */
    async updateConfiguration(config: RuleConfiguration): Promise<ValidationResult> {
        this.logger.log(`Updating rule engine configuration: ${config.metadata.name}`);

        try {
            // Validate the new configuration
            const validationResult = await this.configValidator.validateConfiguration(config);

            if (!validationResult.success) {
                this.logger.warn(`Configuration validation failed: ${validationResult.error}`);
                return {
                    success: false,
                    error: validationResult.error,
                    errorCode: ValidationErrorType.CONFIGURATION_ERROR,
                    metadata: {
                        validationErrors: validationResult.errors,
                        validationWarnings: validationResult.warnings,
                        conflicts: validationResult.conflicts
                    }
                };
            }

            // Update the configuration
            await this.ruleLoader.updateConfiguration(config);

            this.logger.log(`Rule engine configuration updated successfully`);
            return {
                success: true,
                value: config,
                metadata: {
                    validationSummary: validationResult.summary,
                    updateTimestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            this.logger.error('Configuration update failed:', error);
            return {
                success: false,
                error: `Configuration update failed: ${error.message}`,
                errorCode: ValidationErrorType.CONFIGURATION_ERROR,
                metadata: { error: error.message }
            };
        }
    }

    /**
     * Convert rule engine result to legacy CleaningResult format for backward compatibility
     * @param ruleResults Array of rule engine results
     * @param jobId Job identifier
     * @returns Legacy cleaning result format
     */
    convertToLegacyFormat(ruleResults: RuleEngineResult[], jobId: string): CleaningResult {
        const cleanData: CleanedRow[] = [];
        const exceptionData: ExceptionRow[] = [];
        let totalProcessingTime = 0;

        ruleResults.forEach((result, index) => {
            const rowNumber = index + 1;
            totalProcessingTime += result.metadata.processingTime;

            if (result.success) {
                cleanData.push({
                    rowNumber,
                    originalData: this.extractOriginalData(result.fieldResults),
                    cleanedData: result.processedData
                });
            } else {
                exceptionData.push({
                    rowNumber,
                    originalData: this.extractOriginalData(result.fieldResults),
                    errors: this.convertToLegacyErrors(result.errors)
                });
            }
        });

        const statistics: Statistics = {
            totalRows: ruleResults.length,
            cleanedRows: cleanData.length,
            exceptionRows: exceptionData.length,
            processingTime: totalProcessingTime
        };

        return {
            jobId,
            cleanData,
            exceptionData,
            statistics
        };
    }

    /**
     * Convert single rule engine result to legacy CleanResult format
     * @param ruleResult Rule engine result
     * @param fieldName Field name for single field results
     * @returns Legacy clean result format
     */
    convertFieldResultToLegacy<T>(ruleResult: RuleEngineResult, fieldName: string): CleanResult<T> {
        const fieldResult = ruleResult.fieldResults.find(fr => fr.fieldName === fieldName);

        if (!fieldResult) {
            return {
                success: false,
                error: `Field ${fieldName} not found in results`
            };
        }

        if (fieldResult.success) {
            return {
                success: true,
                value: fieldResult.processedValue as T
            };
        } else {
            const error = fieldResult.errors[0];
            return {
                success: false,
                error: error?.message || 'Field processing failed'
            };
        }
    }

    /**
     * Process a batch of rows with concurrency control
     * @param batch Batch of rows to process
     * @param columnTypes Column type mapping
     * @param config Batch configuration
     * @returns Array of processing results
     */
    private async processBatchConcurrently(
        batch: Record<string, any>[],
        columnTypes: Record<string, string>,
        config: BatchConfig
    ): Promise<RuleEngineResult[]> {
        const results: RuleEngineResult[] = [];

        // Process rows with controlled concurrency
        for (let i = 0; i < batch.length; i += config.maxConcurrency) {
            const concurrentBatch = batch.slice(i, i + config.maxConcurrency);

            const promises = concurrentBatch.map(async (rowData) => {
                try {
                    return await Promise.race([
                        this.cleanRow(rowData, columnTypes),
                        this.createTimeoutPromise(config.timeoutMs)
                    ]);
                } catch (error) {
                    this.logger.error('Row processing error:', error);
                    return this.createErrorResult(rowData, error);
                }
            });

            const batchResults = await Promise.all(promises);
            results.push(...batchResults);
        }

        return results;
    }

    /**
     * Create a timeout promise for row processing
     * @param timeoutMs Timeout in milliseconds
     * @returns Promise that rejects after timeout
     */
    private createTimeoutPromise(timeoutMs: number): Promise<RuleEngineResult> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Row processing timeout after ${timeoutMs}ms`));
            }, timeoutMs);
        });
    }

    /**
     * Create an error result for failed row processing
     * @param rowData Original row data
     * @param error Processing error
     * @returns Error rule engine result
     */
    private createErrorResult(rowData: Record<string, any>, error: Error): RuleEngineResult {
        return {
            success: false,
            fieldResults: [],
            processedData: rowData,
            errors: [
                new ValidationError(
                    ValidationErrorType.PROCESSING_ERROR,
                    'row',
                    rowData,
                    `Row processing failed: ${error.message}`,
                    { error: error.message }
                )
            ],
            metadata: {
                processingTime: 0,
                rulesApplied: 0,
                fieldsProcessed: 0
            }
        };
    }

    /**
     * Extract original data from field results for legacy format
     * @param fieldResults Array of field processing results
     * @returns Original data record
     */
    private extractOriginalData(fieldResults: FieldProcessingResult[]): Record<string, any> {
        const originalData: Record<string, any> = {};
        fieldResults.forEach(result => {
            originalData[result.fieldName] = result.originalValue;
        });
        return originalData;
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        this.logger.log('Cleaning up rule engine resources...');
        await this.parallelProcessor.shutdown();
        this.logger.log('Rule engine cleanup complete');
    }

    /**
     * Get parallel processing statistics
     * @returns Parallel processing statistics
     */
    getParallelProcessingStats() {
        return {
            config: this.parallelProcessor.getConfig(),
            workerPool: this.parallelProcessor.getWorkerPoolStats()
        };
    }

    /**
     * Update parallel processing configuration
     * @param config New parallel processing configuration
     */
    updateParallelProcessingConfig(config: Partial<ParallelProcessingConfig>): void {
        this.parallelProcessor.updateConfig(config);
        this.logger.log('Parallel processing configuration updated');
    }

    /**
     * Convert validation errors to legacy field errors with enhanced details
     * @param errors Array of validation errors
     * @returns Array of legacy field errors with detailed information
     */
    private convertToLegacyErrors(errors: ValidationError[]): FieldError[] {
        return errors.map(error => ({
            field: error.field,
            originalValue: error.originalValue,
            errorType: error.type,
            errorMessage: error.message,
            // 添加增强的错误详情
            rule: error.rule || '未知规则',
            expectedFormat: error.expectedFormat || '未指定格式',
            validationContext: {
                ruleName: error.rule,
                strategy: error.strategy || '未知策略',
                parameters: error.parameters || {},
                timestamp: new Date().toISOString(),
                errorCode: error.errorCode || error.type
            }
        }));
    }
}
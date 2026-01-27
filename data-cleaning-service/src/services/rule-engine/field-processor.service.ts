/**
 * Field Processor Service
 * 
 * Responsible for processing individual fields with their validation rules.
 * Supports multi-rule combination with logical operators (AND/OR) and provides
 * comprehensive error handling and recovery mechanisms.
 * 
 * Requirements: 需求 3.2, 1.5, 3.5, 6.4
 */

import { Injectable, Logger } from '@nestjs/common';
import {
    FieldProcessor as IFieldProcessor,
    FieldProcessingResult,
    FieldRule,
    ValidationResult,
    ValidationError,
    ValidationErrorType,
    RuleCondition,
    ConditionOperator
} from '../../common/types/rule-engine.types';
import { StrategyFactoryService } from './strategy-factory.service';
import { RuleLoaderService } from './rule-loader.service';
import { DEFAULT_ERROR_MESSAGES, VALIDATION_LIMITS } from '../../common/constants/rule-engine.constants';

/**
 * Logical operator for combining multiple rule results
 */
export enum LogicalOperator {
    AND = 'AND',
    OR = 'OR'
}

/**
 * Rule combination configuration
 */
export interface RuleCombination {
    operator: LogicalOperator;
    rules: FieldRule[];
    shortCircuit?: boolean; // Whether to stop on first success (OR) or first failure (AND)
}

/**
 * Field processing context
 */
export interface ProcessingContext {
    fieldName: string;
    originalValue: any;
    columnType: string;
    rowData?: Record<string, any>; // Full row data for conditional rules
    metadata?: Record<string, any>;
}

/**
 * Field processor service implementation
 */
@Injectable()
export class FieldProcessorService implements IFieldProcessor {
    private readonly logger = new Logger(FieldProcessorService.name);

    constructor(
        private readonly strategyFactory: StrategyFactoryService,
        private readonly ruleLoader: RuleLoaderService
    ) {
        this.logger.log('FieldProcessorService initialized');
    }

    /**
     * Process a single field with its validation rules
     * @param fieldName Name of the field to process
     * @param value Original field value
     * @param columnType Type of the column
     * @param rowData Optional full row data for conditional rules
     * @returns Field processing result
     */
    async processField(
        fieldName: string,
        value: any,
        columnType: string,
        rowData?: Record<string, any>
    ): Promise<FieldProcessingResult> {
        const startTime = Date.now();
        const context: ProcessingContext = {
            fieldName,
            originalValue: value,
            columnType,
            rowData,
            metadata: { processingStartTime: startTime }
        };

        this.logger.debug(`Processing field: ${fieldName}, type: ${columnType}, value: ${value}`);

        try {
            // Get applicable rules for this field
            const fieldRules = this.getFieldRules(fieldName, columnType);

            if (fieldRules.length === 0) {
                this.logger.debug(`No rules found for field: ${fieldName}, returning original value`);
                return {
                    fieldName,
                    originalValue: value,
                    processedValue: value,
                    success: true,
                    errors: [],
                    appliedRules: []
                };
            }

            // Filter rules based on conditions
            const applicableRules = this.filterRulesByConditions(fieldRules, context);

            if (applicableRules.length === 0) {
                this.logger.debug(`No applicable rules after condition filtering for field: ${fieldName}`);
                return {
                    fieldName,
                    originalValue: value,
                    processedValue: value,
                    success: true,
                    errors: [],
                    appliedRules: []
                };
            }

            // Process rules with logical combination
            const processingResult = await this.processRulesWithLogic(applicableRules, value, context);

            const processingTime = Date.now() - startTime;
            this.logger.debug(`Field processing completed: ${fieldName}, time: ${processingTime}ms`);

            return {
                ...processingResult,
                fieldName,
                originalValue: value,
                appliedRules: applicableRules.map(rule => rule.name)
            };

        } catch (error) {
            this.logger.error(`Error processing field ${fieldName}:`, error);
            return {
                fieldName,
                originalValue: value,
                processedValue: value,
                success: false,
                errors: [
                    new ValidationError(
                        ValidationErrorType.PROCESSING_ERROR,
                        fieldName,
                        value,
                        `Field processing failed: ${error.message}`,
                        { error: error.message, stack: error.stack }
                    )
                ],
                appliedRules: []
            };
        }
    }

    /**
     * Get applicable rules for a field based on field name and column type
     * @param fieldName Name of the field
     * @param columnType Type of the column
     * @returns Array of applicable field rules
     */
    getFieldRules(fieldName: string, columnType: string): FieldRule[] {
        try {
            // Load current configuration
            const config = this.ruleLoader.getCurrentConfiguration();
            if (!config) {
                this.logger.warn('No rule configuration available');
                return [];
            }

            // Get rules for specific field name
            const fieldSpecificRules = config.fieldRules[fieldName] || [];

            // Get rules for column type (fallback)
            const typeSpecificRules = config.fieldRules[columnType] || [];

            // Get global rules (apply to all fields)
            const globalRules = config.fieldRules['*'] || [];

            // Combine and deduplicate rules by name
            const allRules = [...fieldSpecificRules, ...typeSpecificRules, ...globalRules];
            const uniqueRules = this.deduplicateRules(allRules);

            // Sort by priority (higher priority first)
            uniqueRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

            // Limit number of rules per field
            if (uniqueRules.length > VALIDATION_LIMITS.MAX_FIELD_RULES) {
                this.logger.warn(
                    `Too many rules for field ${fieldName} (${uniqueRules.length}), ` +
                    `limiting to ${VALIDATION_LIMITS.MAX_FIELD_RULES}`
                );
                return uniqueRules.slice(0, VALIDATION_LIMITS.MAX_FIELD_RULES);
            }

            this.logger.debug(`Found ${uniqueRules.length} rules for field: ${fieldName}`);
            return uniqueRules;

        } catch (error) {
            this.logger.error(`Error getting field rules for ${fieldName}:`, error);
            return [];
        }
    }

    /**
     * Process multiple rules with logical combination
     * @param rules Array of rules to process
     * @param value Original value
     * @param context Processing context
     * @returns Processing result
     */
    private async processRulesWithLogic(
        rules: FieldRule[],
        value: any,
        context: ProcessingContext
    ): Promise<Omit<FieldProcessingResult, 'fieldName' | 'originalValue' | 'appliedRules'>> {
        if (rules.length === 0) {
            return {
                processedValue: value,
                success: true,
                errors: []
            };
        }

        if (rules.length === 1) {
            // Single rule - process directly
            return await this.processSingleRule(rules[0], value, context);
        }

        // Multiple rules - determine logical combination
        const combination = this.determineRuleCombination(rules);
        return await this.processRuleCombination(combination, value, context);
    }

    /**
     * Process a single validation rule
     * @param rule Rule to process
     * @param value Value to validate
     * @param context Processing context
     * @returns Processing result
     */
    private async processSingleRule(
        rule: FieldRule,
        value: any,
        context: ProcessingContext
    ): Promise<Omit<FieldProcessingResult, 'fieldName' | 'originalValue' | 'appliedRules'>> {
        try {
            this.logger.debug(`Processing rule: ${rule.name} with strategy: ${rule.strategy}`);

            // Get validation strategy with caching
            const strategy = this.strategyFactory.createStrategy(rule.strategy, rule.params);
            if (!strategy) {
                const error = new ValidationError(
                    ValidationErrorType.STRATEGY_NOT_FOUND,
                    context.fieldName,
                    value,
                    `Strategy '${rule.strategy}' not found for rule '${rule.name}'`,
                    { rule: rule.name, strategy: rule.strategy }
                );
                return {
                    processedValue: value,
                    success: false,
                    errors: [error]
                };
            }

            // Validate rule parameters
            if (!strategy.validateParams(rule.params)) {
                const error = new ValidationError(
                    ValidationErrorType.CONFIGURATION_ERROR,
                    context.fieldName,
                    value,
                    `Invalid parameters for rule '${rule.name}' with strategy '${rule.strategy}'`,
                    { rule: rule.name, strategy: rule.strategy, params: rule.params }
                );
                return {
                    processedValue: value,
                    success: false,
                    errors: [error]
                };
            }

            // Execute validation
            const validationResult = strategy.validate(value, rule.params);

            if (validationResult.success) {
                return {
                    processedValue: validationResult.value,
                    success: true,
                    errors: []
                };
            } else {
                // Create validation error with custom message if provided
                const errorMessage = rule.errorMessage || validationResult.error || DEFAULT_ERROR_MESSAGES.PROCESSING_ERROR;
                const error = new ValidationError(
                    validationResult.errorCode as ValidationErrorType || ValidationErrorType.PROCESSING_ERROR,
                    context.fieldName,
                    value,
                    errorMessage,
                    {
                        rule: rule.name,
                        strategy: rule.strategy,
                        validationMetadata: validationResult.metadata
                    }
                );

                // Check if rule is required
                if (rule.required) {
                    return {
                        processedValue: value,
                        success: false,
                        errors: [error]
                    };
                } else {
                    // Optional rule failed - log warning but continue with original value
                    this.logger.warn(`Optional rule '${rule.name}' failed for field '${context.fieldName}': ${errorMessage}`);
                    return {
                        processedValue: value,
                        success: true,
                        errors: [error] // Warning stored as error
                    };
                }
            }

        } catch (error) {
            this.logger.error(`Error processing rule '${rule.name}':`, error);
            const validationError = new ValidationError(
                ValidationErrorType.PROCESSING_ERROR,
                context.fieldName,
                value,
                `Rule processing failed: ${error.message}`,
                { rule: rule.name, error: error.message }
            );
            return {
                processedValue: value,
                success: false,
                errors: [validationError]
            };
        }
    }

    /**
     * Process a combination of rules with logical operators
     * @param combination Rule combination configuration
     * @param value Value to validate
     * @param context Processing context
     * @returns Processing result
     */
    private async processRuleCombination(
        combination: RuleCombination,
        value: any,
        context: ProcessingContext
    ): Promise<Omit<FieldProcessingResult, 'fieldName' | 'originalValue' | 'appliedRules'>> {
        const results: ValidationResult[] = [];
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        let processedValue = value;

        this.logger.debug(`Processing rule combination with ${combination.operator} operator, ${combination.rules.length} rules`);

        for (const rule of combination.rules) {
            const ruleResult = await this.processSingleRule(rule, processedValue, context);

            if (ruleResult.success) {
                // Rule succeeded
                processedValue = ruleResult.processedValue;
                results.push({ success: true, value: processedValue });

                // Add any warnings from optional rules
                warnings.push(...(ruleResult.errors || []));

                // Short-circuit for OR operator on first success
                if (combination.operator === LogicalOperator.OR && combination.shortCircuit) {
                    this.logger.debug(`Short-circuiting OR combination on successful rule: ${rule.name}`);
                    break;
                }
            } else {
                // Rule failed
                errors.push(...ruleResult.errors);
                results.push({ success: false, error: ruleResult.errors[0]?.message });

                // Short-circuit for AND operator on first failure
                if (combination.operator === LogicalOperator.AND && combination.shortCircuit) {
                    this.logger.debug(`Short-circuiting AND combination on failed rule: ${rule.name}`);
                    break;
                }
            }
        }

        // Evaluate combination result
        const combinationResult = this.evaluateCombinationResult(combination.operator, results);

        if (combinationResult.success) {
            return {
                processedValue,
                success: true,
                errors: warnings
            };
        } else {
            return {
                processedValue: context.originalValue,
                success: false,
                errors
            };
        }
    }

    /**
     * Evaluate the result of a rule combination
     * @param operator Logical operator
     * @param results Array of individual rule results
     * @returns Combined result
     */
    private evaluateCombinationResult(operator: LogicalOperator, results: ValidationResult[]): ValidationResult {
        if (results.length === 0) {
            return { success: true };
        }

        switch (operator) {
            case LogicalOperator.AND:
                // All rules must succeed
                const allSucceeded = results.every(result => result.success);
                return {
                    success: allSucceeded,
                    error: allSucceeded ? undefined : 'One or more AND rules failed'
                };

            case LogicalOperator.OR:
                // At least one rule must succeed
                const anySucceeded = results.some(result => result.success);
                return {
                    success: anySucceeded,
                    error: anySucceeded ? undefined : 'All OR rules failed'
                };

            default:
                return {
                    success: false,
                    error: `Unknown logical operator: ${operator}`
                };
        }
    }

    /**
     * Determine rule combination strategy based on rule configuration
     * @param rules Array of rules
     * @returns Rule combination configuration
     */
    private determineRuleCombination(rules: FieldRule[]): RuleCombination {
        // Check if rules have explicit combination configuration
        // For now, use simple heuristics:
        // - If any rule is required, use AND (all must pass)
        // - If all rules are optional, use OR (any can pass)

        const hasRequiredRules = rules.some(rule => rule.required);
        const operator = hasRequiredRules ? LogicalOperator.AND : LogicalOperator.OR;

        return {
            operator,
            rules,
            shortCircuit: true // Enable short-circuiting for performance
        };
    }

    /**
     * Filter rules based on their conditions
     * @param rules Array of rules to filter
     * @param context Processing context
     * @returns Filtered rules that meet their conditions
     */
    private filterRulesByConditions(rules: FieldRule[], context: ProcessingContext): FieldRule[] {
        return rules.filter(rule => {
            if (!rule.condition) {
                return true; // No condition means rule always applies
            }

            return this.evaluateRuleCondition(rule.condition, context);
        });
    }

    /**
     * Evaluate a rule condition
     * @param condition Rule condition to evaluate
     * @param context Processing context
     * @returns True if condition is met, false otherwise
     */
    private evaluateRuleCondition(condition: RuleCondition, context: ProcessingContext): boolean {
        if (!context.rowData) {
            this.logger.warn(`Cannot evaluate condition for field ${context.fieldName}: no row data available`);
            return true; // Default to applying the rule
        }

        const fieldValue = context.rowData[condition.field];

        try {
            switch (condition.operator) {
                case ConditionOperator.EQUALS:
                    return fieldValue === condition.value;

                case ConditionOperator.NOT_EQUALS:
                    return fieldValue !== condition.value;

                case ConditionOperator.GREATER_THAN:
                    return Number(fieldValue) > Number(condition.value);

                case ConditionOperator.LESS_THAN:
                    return Number(fieldValue) < Number(condition.value);

                case ConditionOperator.CONTAINS:
                    return String(fieldValue).includes(String(condition.value));

                case ConditionOperator.NOT_CONTAINS:
                    return !String(fieldValue).includes(String(condition.value));

                case ConditionOperator.IS_EMPTY:
                    return !fieldValue || fieldValue === '' || fieldValue === null || fieldValue === undefined;

                case ConditionOperator.IS_NOT_EMPTY:
                    return fieldValue && fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;

                default:
                    this.logger.warn(`Unknown condition operator: ${condition.operator}`);
                    return true;
            }
        } catch (error) {
            this.logger.error(`Error evaluating condition for field ${context.fieldName}:`, error);
            return true; // Default to applying the rule on error
        }
    }

    /**
     * Remove duplicate rules based on rule name
     * @param rules Array of rules to deduplicate
     * @returns Deduplicated rules array
     */
    private deduplicateRules(rules: FieldRule[]): FieldRule[] {
        const seen = new Set<string>();
        return rules.filter(rule => {
            if (seen.has(rule.name)) {
                this.logger.debug(`Duplicate rule found and removed: ${rule.name}`);
                return false;
            }
            seen.add(rule.name);
            return true;
        });
    }
}
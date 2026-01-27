/**
 * Rule Configuration Data Management Hooks
 * React Query hooks for managing rule configuration data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';
import { queryKeys } from '../lib/query-client';
import type {
    RuleConfiguration,
    RuleConfigResponse
} from '../types/rule-config';

export interface UseRuleConfigOptions {
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
}

/**
 * Hook for fetching current rule configuration
 */
export function useRuleConfig(options: UseRuleConfigOptions = {}) {
    const { enabled = true, staleTime = 5 * 60 * 1000, gcTime = 10 * 60 * 1000 } = options;

    return useQuery({
        queryKey: queryKeys.ruleConfig.current(),
        queryFn: () => apiClient.getCurrentRuleConfig(),
        enabled,
        staleTime,
        gcTime,
        retry: (failureCount, error) => {
            // Don't retry on 404 or other client errors
            if (error && typeof error === 'object' && 'statusCode' in error) {
                const statusCode = (error as { statusCode: number }).statusCode;
                if (statusCode >= 400 && statusCode < 500) {
                    return false;
                }
            }
            return failureCount < 3;
        },
    });
}

/**
 * Hook for updating rule configuration
 */
export function useUpdateRuleConfig() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ config, description }: { config: RuleConfiguration; description?: string }) =>
            apiClient.updateRuleConfig(config, description),
        onSuccess: (data: RuleConfigResponse) => {
            // Invalidate and refetch rule config queries
            queryClient.invalidateQueries({ queryKey: queryKeys.ruleConfig.all });

            // Update the current config cache with the new data
            if (data.success && data.configuration) {
                queryClient.setQueryData(
                    queryKeys.ruleConfig.current(),
                    data
                );
            }
        },
        onError: (error) => {
            console.error('Failed to update rule configuration:', error);
        },
    });
}

/**
 * Hook for reloading rule configuration
 */
export function useReloadRuleConfig() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => apiClient.reloadRuleConfig(),
        onSuccess: (data: RuleConfigResponse) => {
            // Invalidate and refetch rule config queries
            queryClient.invalidateQueries({ queryKey: queryKeys.ruleConfig.all });

            // Update the current config cache with the reloaded data
            if (data.success && data.configuration) {
                queryClient.setQueryData(
                    queryKeys.ruleConfig.current(),
                    data
                );
            }
        },
        onError: (error) => {
            console.error('Failed to reload rule configuration:', error);
        },
    });
}

/**
 * Hook for fetching rule configuration history
 */
export function useRuleConfigHistory(limit?: number, options: UseRuleConfigOptions = {}) {
    const { enabled = true, staleTime = 2 * 60 * 1000, gcTime = 5 * 60 * 1000 } = options;

    return useQuery({
        queryKey: queryKeys.ruleConfig.history(limit),
        queryFn: () => apiClient.getRuleConfigHistory(limit),
        enabled,
        staleTime,
        gcTime,
    });
}

/**
 * Hook for fetching rule configuration statistics
 */
export function useRuleConfigStats(options: UseRuleConfigOptions = {}) {
    const { enabled = true, staleTime = 1 * 60 * 1000, gcTime = 3 * 60 * 1000 } = options;

    return useQuery({
        queryKey: queryKeys.ruleConfig.stats(),
        queryFn: () => apiClient.getRuleConfigStats(),
        enabled,
        staleTime,
        gcTime,
    });
}

/**
 * Hook for managing rule configuration state and operations
 * Provides a unified interface for all rule config operations
 */
export function useRuleConfigManager() {
    const queryClient = useQueryClient();

    // Queries
    const configQuery = useRuleConfig();
    const statsQuery = useRuleConfigStats();

    // Mutations
    const updateMutation = useUpdateRuleConfig();
    const reloadMutation = useReloadRuleConfig();

    // Helper functions
    const refetchConfig = () => {
        return configQuery.refetch();
    };

    const invalidateConfig = () => {
        return queryClient.invalidateQueries({ queryKey: queryKeys.ruleConfig.all });
    };

    const resetConfigCache = () => {
        queryClient.removeQueries({ queryKey: queryKeys.ruleConfig.all });
    };

    // Check if any operation is in progress
    const isLoading = configQuery.isLoading || updateMutation.isPending || reloadMutation.isPending;
    const isError = configQuery.isError || updateMutation.isError || reloadMutation.isError;

    return {
        // Data
        config: configQuery.data?.configuration,
        configResponse: configQuery.data,
        stats: statsQuery.data,

        // Query states
        isLoading,
        isError,
        error: configQuery.error || updateMutation.error || reloadMutation.error,

        // Individual query states
        configQuery: {
            isLoading: configQuery.isLoading,
            isError: configQuery.isError,
            error: configQuery.error,
            refetch: configQuery.refetch,
        },
        statsQuery: {
            isLoading: statsQuery.isLoading,
            isError: statsQuery.isError,
            error: statsQuery.error,
            refetch: statsQuery.refetch,
        },

        // Mutations
        updateConfig: updateMutation.mutate,
        updateConfigAsync: updateMutation.mutateAsync,
        reloadConfig: reloadMutation.mutate,
        reloadConfigAsync: reloadMutation.mutateAsync,

        // Mutation states
        updateMutation: {
            isPending: updateMutation.isPending,
            isError: updateMutation.isError,
            error: updateMutation.error,
            isSuccess: updateMutation.isSuccess,
            reset: updateMutation.reset,
        },
        reloadMutation: {
            isPending: reloadMutation.isPending,
            isError: reloadMutation.isError,
            error: reloadMutation.error,
            isSuccess: reloadMutation.isSuccess,
            reset: reloadMutation.reset,
        },

        // Helper functions
        refetchConfig,
        invalidateConfig,
        resetConfigCache,
    };
}
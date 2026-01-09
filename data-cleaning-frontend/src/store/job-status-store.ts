/**
 * 任务状态监控状态管理
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { JobStatusState } from './types';
import type { ProcessingStatistics } from '../types';

interface JobStatusStore extends JobStatusState {
    // Actions
    addJob: (jobId: string, status: 'processing' | 'completed' | 'failed', progress: number) => void;
    updateJobStatus: (jobId: string, status: 'processing' | 'completed' | 'failed', progress: number, statistics?: ProcessingStatistics) => void;
    removeJob: (jobId: string) => void;
    startPolling: (jobId: string, interval: number) => void;
    stopPolling: (jobId: string) => void;
    stopAllPolling: () => void;
    getJob: (jobId: string) => JobStatusState['activeJobs'] extends Map<string, infer T> ? T | undefined : undefined;
    resetJobStatus: () => void;
}

const initialState: JobStatusState = {
    activeJobs: new Map(),
    pollingIntervals: new Map(),
};

export const useJobStatusStore = create<JobStatusStore>()(
    devtools(
        (set, get) => ({
            ...initialState,

            addJob: (jobId, status, progress) =>
                set(
                    (state) => {
                        const newActiveJobs = new Map(state.activeJobs);
                        newActiveJobs.set(jobId, { jobId, status, progress });
                        return { activeJobs: newActiveJobs };
                    },
                    false,
                    'addJob'
                ),

            updateJobStatus: (jobId, status, progress, statistics) =>
                set(
                    (state) => {
                        const newActiveJobs = new Map(state.activeJobs);
                        const existingJob = newActiveJobs.get(jobId);
                        if (existingJob) {
                            newActiveJobs.set(jobId, {
                                ...existingJob,
                                status,
                                progress,
                                statistics,
                            });
                        }
                        return { activeJobs: newActiveJobs };
                    },
                    false,
                    'updateJobStatus'
                ),

            removeJob: (jobId) =>
                set(
                    (state) => {
                        const newActiveJobs = new Map(state.activeJobs);
                        newActiveJobs.delete(jobId);

                        // Also stop polling for this job
                        const newPollingIntervals = new Map(state.pollingIntervals);
                        const interval = newPollingIntervals.get(jobId);
                        if (interval) {
                            window.clearInterval(interval);
                            newPollingIntervals.delete(jobId);
                        }

                        return {
                            activeJobs: newActiveJobs,
                            pollingIntervals: newPollingIntervals,
                        };
                    },
                    false,
                    'removeJob'
                ),

            startPolling: (jobId, interval) =>
                set(
                    (state) => {
                        const newPollingIntervals = new Map(state.pollingIntervals);
                        // Clear existing interval if any
                        const existingInterval = newPollingIntervals.get(jobId);
                        if (existingInterval) {
                            window.clearInterval(existingInterval);
                        }
                        newPollingIntervals.set(jobId, interval);
                        return { pollingIntervals: newPollingIntervals };
                    },
                    false,
                    'startPolling'
                ),

            stopPolling: (jobId) =>
                set(
                    (state) => {
                        const newPollingIntervals = new Map(state.pollingIntervals);
                        const interval = newPollingIntervals.get(jobId);
                        if (interval) {
                            window.clearInterval(interval);
                            newPollingIntervals.delete(jobId);
                        }
                        return { pollingIntervals: newPollingIntervals };
                    },
                    false,
                    'stopPolling'
                ),

            stopAllPolling: () =>
                set(
                    (state) => {
                        // Clear all intervals
                        state.pollingIntervals.forEach((interval) => {
                            window.clearInterval(interval);
                        });
                        return { pollingIntervals: new Map() };
                    },
                    false,
                    'stopAllPolling'
                ),

            getJob: (jobId) => {
                const state = get();
                return state.activeJobs.get(jobId);
            },

            resetJobStatus: () => {
                const state = get();
                // Clear all intervals before resetting
                state.pollingIntervals.forEach((interval) => {
                    window.clearInterval(interval);
                });
                set(initialState, false, 'resetJobStatus');
            },
        }),
        {
            name: 'job-status-store',
        }
    )
);
/**
 * 文件详情状态管理
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { FileDetailState } from './types';
import type { FileRecord, ProcessingStatistics } from '../types';

interface FileDetailStore extends FileDetailState {
    // Actions
    setFile: (file: FileRecord | null) => void;
    setStatistics: (statistics: ProcessingStatistics | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    updateFileStatus: (status: FileRecord['status']) => void;
    resetFileDetail: () => void;
}

const initialState: FileDetailState = {
    file: null,
    statistics: null,
    loading: false,
    error: null,
};

export const useFileDetailStore = create<FileDetailStore>()(
    devtools(
        (set) => ({
            ...initialState,

            setFile: (file) =>
                set({ file }, false, 'setFile'),

            setStatistics: (statistics) =>
                set({ statistics }, false, 'setStatistics'),

            setLoading: (loading) =>
                set({ loading }, false, 'setLoading'),

            setError: (error) =>
                set({ error }, false, 'setError'),

            updateFileStatus: (status) =>
                set(
                    (state) => ({
                        file: state.file ? { ...state.file, status } : null,
                    }),
                    false,
                    'updateFileStatus'
                ),

            resetFileDetail: () =>
                set(initialState, false, 'resetFileDetail'),
        }),
        {
            name: 'file-detail-store',
        }
    )
);
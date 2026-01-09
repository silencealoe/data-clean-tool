/**
 * 文件列表状态管理
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { FileListState } from './types';
import type { FileRecord, FileFilters, PaginationInfo } from '../types';

interface FileListStore extends FileListState {
    // Actions
    setFiles: (files: FileRecord[]) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setPagination: (pagination: PaginationInfo) => void;
    setFilters: (filters: FileFilters) => void;
    updateFilter: (key: keyof FileFilters, value: unknown) => void;
    resetFilters: () => void;
    addFile: (file: FileRecord) => void;
    updateFile: (fileId: string, updates: Partial<FileRecord>) => void;
    removeFile: (fileId: string) => void;
    resetFileList: () => void;
}

const initialState: FileListState = {
    files: [],
    loading: false,
    error: null,
    pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
    },
    filters: {},
};

export const useFileListStore = create<FileListStore>()(
    devtools(
        (set) => ({
            ...initialState,

            setFiles: (files) =>
                set({ files }, false, 'setFiles'),

            setLoading: (loading) =>
                set({ loading }, false, 'setLoading'),

            setError: (error) =>
                set({ error }, false, 'setError'),

            setPagination: (pagination) =>
                set({ pagination }, false, 'setPagination'),

            setFilters: (filters) =>
                set({ filters }, false, 'setFilters'),

            updateFilter: (key, value) =>
                set(
                    (state) => ({
                        filters: { ...state.filters, [key]: value },
                    }),
                    false,
                    'updateFilter'
                ),

            resetFilters: () =>
                set({ filters: {} }, false, 'resetFilters'),

            addFile: (file) =>
                set(
                    (state) => ({
                        files: [file, ...state.files],
                        pagination: {
                            ...state.pagination,
                            total: state.pagination.total + 1,
                        },
                    }),
                    false,
                    'addFile'
                ),

            updateFile: (fileId, updates) =>
                set(
                    (state) => ({
                        files: state.files.map((file) =>
                            file.id === fileId ? { ...file, ...updates } : file
                        ),
                    }),
                    false,
                    'updateFile'
                ),

            removeFile: (fileId) =>
                set(
                    (state) => ({
                        files: state.files.filter((file) => file.id !== fileId),
                        pagination: {
                            ...state.pagination,
                            total: Math.max(0, state.pagination.total - 1),
                        },
                    }),
                    false,
                    'removeFile'
                ),

            resetFileList: () =>
                set(initialState, false, 'resetFileList'),
        }),
        {
            name: 'file-list-store',
        }
    )
);
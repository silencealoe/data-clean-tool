/**
 * 文件上传状态管理
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { UploadState } from './types';

interface UploadStore extends UploadState {
    // Actions
    setUploading: (isUploading: boolean) => void;
    setProgress: (progress: number) => void;
    setError: (error: string | null) => void;
    setUploadedFile: (file: UploadState['uploadedFile']) => void;
    resetUploadState: () => void;
}

const initialState: UploadState = {
    isUploading: false,
    progress: 0,
    error: null,
    uploadedFile: null,
};

export const useUploadStore = create<UploadStore>()(
    devtools(
        (set) => ({
            ...initialState,

            setUploading: (isUploading) =>
                set({ isUploading }, false, 'setUploading'),

            setProgress: (progress) =>
                set({ progress }, false, 'setProgress'),

            setError: (error) =>
                set({ error }, false, 'setError'),

            setUploadedFile: (uploadedFile) =>
                set({ uploadedFile }, false, 'setUploadedFile'),

            resetUploadState: () =>
                set(initialState, false, 'resetUploadState'),
        }),
        {
            name: 'upload-store',
        }
    )
);
/**
 * 应用主题状态管理
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AppThemeState } from './types';

interface AppThemeStore extends AppThemeState {
    // Actions
    setMode: (mode: 'light' | 'dark') => void;
    setPrimaryColor: (color: string) => void;
    toggleMode: () => void;
    resetTheme: () => void;
}

const initialState: AppThemeState = {
    mode: 'light',
    primaryColor: '#3b82f6', // blue-500
};

export const useAppThemeStore = create<AppThemeStore>()(
    devtools(
        persist(
            (set) => ({
                ...initialState,

                setMode: (mode) =>
                    set({ mode }, false, 'setMode'),

                setPrimaryColor: (primaryColor) =>
                    set({ primaryColor }, false, 'setPrimaryColor'),

                toggleMode: () =>
                    set(
                        (state) => ({
                            mode: state.mode === 'light' ? 'dark' : 'light',
                        }),
                        false,
                        'toggleMode'
                    ),

                resetTheme: () =>
                    set(initialState, false, 'resetTheme'),
            }),
            {
                name: 'app-theme-store',
                partialize: (state) => ({
                    mode: state.mode,
                    primaryColor: state.primaryColor,
                }),
            }
        ),
        {
            name: 'app-theme-store',
        }
    )
);
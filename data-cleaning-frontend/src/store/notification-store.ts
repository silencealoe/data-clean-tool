/**
 * 通知状态管理
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { NotificationState } from './types';

interface NotificationStore extends NotificationState {
    // Actions
    addNotification: (type: 'success' | 'error' | 'info' | 'warning', message: string) => string;
    removeNotification: (id: string) => void;
    clearAllNotifications: () => void;
    showSuccess: (message: string) => string;
    showError: (message: string) => string;
    showInfo: (message: string) => string;
    showWarning: (message: string) => string;
}

const initialState: NotificationState = {
    notifications: [],
};

export const useNotificationStore = create<NotificationStore>()(
    devtools(
        (set, get) => ({
            ...initialState,

            addNotification: (type, message) => {
                const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const notification = {
                    id,
                    type,
                    message,
                    timestamp: Date.now(),
                };

                set(
                    (state) => ({
                        notifications: [...state.notifications, notification],
                    }),
                    false,
                    'addNotification'
                );

                // Auto-remove notification after 5 seconds
                setTimeout(() => {
                    get().removeNotification(id);
                }, 5000);

                return id;
            },

            removeNotification: (id) =>
                set(
                    (state) => ({
                        notifications: state.notifications.filter((n) => n.id !== id),
                    }),
                    false,
                    'removeNotification'
                ),

            clearAllNotifications: () =>
                set({ notifications: [] }, false, 'clearAllNotifications'),

            showSuccess: (message) => get().addNotification('success', message),
            showError: (message) => get().addNotification('error', message),
            showInfo: (message) => get().addNotification('info', message),
            showWarning: (message) => get().addNotification('warning', message),
        }),
        {
            name: 'notification-store',
        }
    )
);
import {create} from "zustand";
import {NotificationService, ServerNotificationItem} from "@/services/NotificationService";
import {REQUEST_STATE} from "@/services/HttpService";

interface NotificationStore {
    notifications: ServerNotificationItem[];
    unreadCount: number;
    loading: boolean;
    hasFetched: boolean;
    fetchNotifications: () => Promise<void>;
    fetchUnreadCount: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    hasFetched: false,

    fetchNotifications: async () => {
        set({loading: true});
        const res = await NotificationService.list(30, 0);
        if (res.state === REQUEST_STATE.SUCCESS) {
            const list = res.data.notifications || [];
            const unread = list.filter((n) => !n.readAt).length;
            set({
                notifications: list,
                unreadCount: unread,
                loading: false,
                hasFetched: true,
            });
        } else {
            set({loading: false, hasFetched: true});
        }
    },

    fetchUnreadCount: async () => {
        const res = await NotificationService.unreadCount();
        if (res.state === REQUEST_STATE.SUCCESS) {
            set({unreadCount: Number(res.data.count) || 0});
        }
    },

    markAsRead: async (id: number) => {
        const {notifications, unreadCount} = get();
        const target = notifications.find((n) => n.id === id);
        if (!target || target.readAt) return;

        const updated = notifications.map((n) =>
            n.id === id ? {...n, readAt: new Date().toISOString()} : n
        );
        const newUnread = Math.max(0, unreadCount - 1);

        set({notifications: updated, unreadCount: newUnread});

        try {
            await NotificationService.markRead(id);
        } catch {
            // rollback if needed
        }
    },

    markAllAsRead: async () => {
        const {notifications} = get();
        const unreadItems = notifications.filter((n) => !n.readAt);
        if (unreadItems.length === 0) return;

        const now = new Date().toISOString();
        const updated = notifications.map((n) => ({...n, readAt: n.readAt || now}));
        set({notifications: updated, unreadCount: 0});

        for (const item of unreadItems) {
            try {
                await NotificationService.markRead(item.id);
            } catch {
                // Continue marking other rows
            }
        }
    },
}));

import {create} from "zustand";
import {NotificationService, ServerNotificationItem} from "@/services/NotificationService";
import {REQUEST_STATE} from "@/services/HttpService";

interface NotificationStore {
    notifications: ServerNotificationItem[];
    unreadCount: number;
    loading: boolean;
    hasFetched: boolean;
    /**
     * The last list fetch came back FAILED.
     *
     * NotificationService never throws -- a 401, a 500 and a dead network all
     * resolve to `{state: FAILED}` (NotificationService.ts:82-86, :100-109) --
     * so without this flag an empty `notifications` array is the store's only
     * report of a failure, and it is the same array a genuinely empty inbox
     * produces. That is what made the dropdown answer every outage with "no
     * notifications yet" (#140).
     */
    loadFailed: boolean;
    /**
     * The last unread-count refresh came back FAILED, so `unreadCount` is
     * whatever the previous successful poll said.
     *
     * The count is deliberately NOT reset on failure: zeroing it would hide
     * rows that really are unread, and this poll runs every 45 seconds, so one
     * flake would blank a badge that was telling the truth. Freezing the number
     * is the least wrong answer -- but a frozen number that looks live is still
     * a claim the app cannot support, so the badge renders it differently and
     * says so (#142).
     */
    unreadCountStale: boolean;
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
    loadFailed: false,
    unreadCountStale: false,

    fetchNotifications: async () => {
        set({loading: true});
        const res = await NotificationService.list(30, 0);
        if (res.state === REQUEST_STATE.SUCCESS) {
            const list = res.data.notifications || [];
            const unread = list.filter((n) => !n.readAt).length;
            // The list is authoritative for the count -- it was just counted
            // from the rows themselves -- so a successful list clears the
            // staleness the count poll may have set.
            set({
                notifications: list,
                unreadCount: unread,
                loading: false,
                hasFetched: true,
                loadFailed: false,
                unreadCountStale: false,
            });
        } else {
            // Deliberately keeps whatever `notifications` already held: a
            // failed refresh is no reason to throw away rows that did arrive.
            // `loadFailed` is what the dropdown branches on, so the failure is
            // reported instead of being mistaken for an empty inbox.
            set({loading: false, hasFetched: true, loadFailed: true});
        }
    },

    fetchUnreadCount: async () => {
        const res = await NotificationService.unreadCount();
        if (res.state === REQUEST_STATE.SUCCESS) {
            set({unreadCount: Number(res.data.count) || 0, unreadCountStale: false});
        } else {
            // Keep the number, flag it. `NotificationService` never throws, so
            // without this the failure was simply dropped and a badge could sit
            // for hours asserting a count nobody had confirmed since (#142).
            set({unreadCountStale: true});
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

import {getApiBase} from "@/utils/env";
import {getAuthJWTCookie} from "@/utils/browser";
import {ApiError, FailedRequestState, REQUEST_STATE, SuccessRequestState} from "./HttpService";

export interface NotificationDecisionIssue {
    document?: string | null;
    reason: string;
}

export interface NotificationDecision {
    outcome: "Verified" | "Rejected" | string;
    issues?: NotificationDecisionIssue[];
}

export interface ServerNotificationItem {
    id: number;
    sourceEventId: string;
    kind:
        | "RiderApplicationSubmitted"
        | "RiderApplicationResubmitted"
        | "RiderApplicationApproved"
        | "RiderApplicationRejected"
        | "RiderResubmissionReceived"
        | string;
    recipientLocalUserId?: number;
    recipientRole?: string;
    riderId?: number;
    riderDecisionId?: number;
    createdAt: string;
    readAt?: string | null;
    resolvedAt?: string | null;
    resolvedByLocalUserId?: number;
    decision?: NotificationDecision | null;
}

export interface NotificationListResponse {
    notifications: ServerNotificationItem[];
}

export interface NotificationCountResponse {
    count: number;
}

type Settled<T> = SuccessRequestState<T> | FailedRequestState;

async function requestNotificationApi<T>(path: string, options: RequestInit = {}): Promise<Settled<T>> {
    const base = getApiBase();
    if (!base) {
        return {
            state: REQUEST_STATE.FAILED,
            err: {message: "API base URL not configured", error: "missingApiBase"},
        };
    }

    const token = getAuthJWTCookie();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {
        const url = `${base.replace(/\/$/, "")}/api/v4${path.startsWith("/") ? path : `/${path}`}`;
        const res = await fetch(url, {
            ...options,
            headers,
        });

        if (!res.ok) {
            let errorBody: ApiError = {status: res.status};
            try {
                const json = await res.json();
                errorBody = {
                    ...errorBody,
                    error: json.error || json.message,
                    message: json.message,
                };
            } catch {
                errorBody.message = res.statusText;
            }
            return {
                state: REQUEST_STATE.FAILED,
                err: errorBody,
            };
        }

        if (res.status === 204) {
            return {
                state: REQUEST_STATE.SUCCESS,
                data: undefined as T,
            };
        }

        const data = (await res.json()) as T;
        return {
            state: REQUEST_STATE.SUCCESS,
            data,
        };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Network request failed";
        return {
            state: REQUEST_STATE.FAILED,
            err: {
                message,
                error: "networkError",
            },
        };
    }
}

export class NotificationService {
    /**
     * Lists notifications for the current user (newest first).
     */
    static async list(limit = 30, offset = 0): Promise<Settled<NotificationListResponse>> {
        const boundedLimit = Math.max(1, Math.min(limit, 30));
        const boundedOffset = Math.max(0, offset);
        return requestNotificationApi<NotificationListResponse>(
            `/notifications?limit=${boundedLimit}&offset=${boundedOffset}`,
            {method: "GET"}
        );
    }

    /**
     * Retrieves the unread notification count.
     */
    static async unreadCount(): Promise<Settled<NotificationCountResponse>> {
        return requestNotificationApi<NotificationCountResponse>("/notifications/unread-count", {
            method: "GET",
        });
    }

    /**
     * Marks a specific notification as read.
     */
    static async markRead(id: number): Promise<Settled<void>> {
        return requestNotificationApi<void>(`/notifications/${id}/read`, {
            method: "POST",
        });
    }
}

"use client";

import React, {useCallback, useMemo} from "react";
import {useRouter} from "next/navigation";
import {useTranslation} from "react-i18next";
import {Bell, FileText, RefreshCw} from "lucide-react";
import type {NotificationWithDecision} from "108jobs-client";
import {Button} from "@/components/ui/Button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {useAdminNotifications} from "@/modules/admin/hooks/useAdminNotifications";
import {useUnresolvedRiderCount} from "@/modules/admin/hooks/useUnresolvedRiderCount";
import {useAdminQueueRefresh} from "@/modules/admin/hooks/useAdminQueueRefresh";

/**
 * Where clicking a notification lands. `manage-riders` reads `rider` from the
 * query string and opens that application's review modal, so the admin arrives
 * on the thing the notification is about rather than on a list to search.
 */
export const riderReviewHref = (riderId: number) =>
    `/admin/manage-riders?rider=${riderId}`;

/**
 * Both kinds that reach the admin queue, and they are not interchangeable:
 * a resubmission means this application has already been round once, which is
 * exactly what the count on its own cannot say.
 */
const KIND_COPY: Record<string, {titleKey: string; icon: typeof FileText}> = {
    RiderApplicationSubmitted: {
        titleKey: "admin.notifications.kindSubmitted",
        icon: FileText,
    },
    RiderApplicationResubmitted: {
        titleKey: "admin.notifications.kindResubmitted",
        icon: RefreshCw,
    },
};

function formatWhen(iso: string, locale: string) {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return "";
    return at.toLocaleString(locale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function AdminNotificationBell() {
    const {t, i18n} = useTranslation();
    const router = useRouter();
    const {notifications, isLoading} = useAdminNotifications();
    const {count} = useUnresolvedRiderCount();
    const refreshQueue = useAdminQueueRefresh();

    // The badge reads the count endpoint rather than `notifications.length`,
    // which is capped at the panel's page size -- a queue of fifty would
    // otherwise read as ten.
    const waiting = count ?? 0;

    const open = useCallback(
        (riderId: number | null) => {
            if (riderId === null) return;
            router.push(riderReviewHref(riderId));
            // Another admin may have dealt with these while the panel sat open.
            refreshQueue();
        },
        [router, refreshQueue],
    );

    const rows = useMemo(
        () => notifications.filter((n) => n.riderId !== null),
        [notifications],
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="relative h-10 w-10 p-0 text-white/90 hover:text-white"
                    aria-label={
                        waiting > 0
                            ? t("admin.notifications.bellLabelWithCount", {count: waiting})
                            : t("admin.notifications.bellLabel")
                    }
                >
                    <Bell className="h-5 w-5"/>
                    {waiting > 0 && (
                        <span
                            data-testid="admin-notification-dot"
                            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white"
                        >
                            {waiting > 99 ? "99+" : waiting}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-88 max-w-[calc(100vw-2rem)] p-0" align="end">
                <DropdownMenuLabel className="px-4 py-3 text-base font-semibold">
                    {t("admin.notifications.panelTitle")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="m-0"/>

                <div className="max-h-96 overflow-y-auto">
                    {isLoading && rows.length === 0 && (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                            {t("admin.notifications.loading")}
                        </p>
                    )}

                    {!isLoading && rows.length === 0 && (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                            {t("admin.notifications.empty")}
                        </p>
                    )}

                    {rows.map((n: NotificationWithDecision) => {
                        const copy = KIND_COPY[n.kind];
                        const Icon = copy?.icon ?? FileText;
                        return (
                            <DropdownMenuItem
                                key={n.id}
                                // A plain button inside the panel navigates but
                                // leaves the menu open on top of the application
                                // it just opened. `onSelect` closes it, and the
                                // primitive brings arrow-key navigation and the
                                // right ARIA roles with it.
                                onSelect={() => open(n.riderId)}
                                className="flex w-full items-start gap-3 rounded-none border-b border-border px-4 py-3 text-left last:border-b-0 focus:bg-muted"
                            >
                                <span className="mt-0.5 shrink-0 rounded-full bg-primary/10 p-1.5 text-primary">
                                    <Icon className="h-4 w-4"/>
                                </span>
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span className="text-sm font-medium">
                                        {copy
                                            ? t(copy.titleKey)
                                            : t("admin.notifications.kindUnknown")}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {t("admin.notifications.riderRef", {id: n.riderId})}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatWhen(n.createdAt, i18n.language)}
                                    </span>
                                </span>
                            </DropdownMenuItem>
                        );
                    })}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

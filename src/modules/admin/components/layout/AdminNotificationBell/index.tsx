"use client";

import React, {useCallback, useMemo} from "react";
import {useRouter} from "next/navigation";
import {useTranslation} from "react-i18next";
import {ArrowRight, Bell, CheckCircle2, ChevronRight, FileText, ListChecks, RefreshCw} from "lucide-react";
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
const KIND_COPY: Record<string, {
    titleKey: string;
    badgeKey: string;
    icon: typeof FileText;
    badgeClassName: string;
    iconClassName: string;
}> = {
    RiderApplicationSubmitted: {
        titleKey: "admin.notifications.kindSubmitted",
        badgeKey: "admin.notifications.badgeSubmitted",
        icon: FileText,
        badgeClassName: "bg-primary/10 text-primary",
        iconClassName: "bg-primary/10 text-primary",
    },
    RiderApplicationResubmitted: {
        titleKey: "admin.notifications.kindResubmitted",
        badgeKey: "admin.notifications.badgeResubmitted",
        icon: RefreshCw,
        badgeClassName: "bg-amber-50 text-amber-700",
        iconClassName: "bg-amber-50 text-amber-700",
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

    const openQueue = useCallback(() => {
        router.push("/admin/manage-riders");
        refreshQueue();
    }, [router, refreshQueue]);

    const rows = useMemo(
        () => notifications.filter((n) => n.riderId !== null),
        [notifications],
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full p-0 text-white/90 !transition-none hover:bg-white/10 hover:text-white"
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
                            className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-primary bg-rose-500 px-1 text-[9px] font-bold leading-none text-white"
                        >
                            {waiting > 99 ? "99+" : waiting}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                className="w-[23.5rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border-slate-200 bg-white p-0 text-slate-700 shadow-[0_18px_48px_rgba(15,23,42,0.18)] !animate-none !transition-none"
                align="end"
                sideOffset={8}
            >
                <DropdownMenuLabel className="flex items-center justify-between gap-3 bg-slate-50/80 px-4 py-4">
                    <span className="flex min-w-0 flex-col">
                        <span className="text-base font-semibold text-slate-900">
                            {t("admin.notifications.panelTitle")}
                        </span>
                        <span className="mt-0.5 text-xs font-normal leading-5 text-slate-500">
                            {t("admin.notifications.panelDescription")}
                        </span>
                    </span>
                    {count !== null && (
                        <span className="shrink-0 rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            {t("admin.notifications.pendingCount", {count: waiting})}
                        </span>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="m-0"/>

                <div className="max-h-[26rem] overflow-y-auto p-2">
                    {isLoading && rows.length === 0 && (
                        <div role="status" className="space-y-3 px-2 py-4">
                            <p className="text-center text-sm text-muted-foreground">
                                {t("admin.notifications.loading")}
                            </p>
                            <div aria-hidden="true" className="space-y-2.5">
                                {[0, 1, 2].map((item) => (
                                    <div key={item} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                        <span className="h-8 w-8 shrink-0 rounded-full bg-slate-200"/>
                                        <span className="flex flex-1 flex-col gap-2">
                                            <span className="h-2.5 w-2/3 rounded bg-slate-200"/>
                                            <span className="h-2 w-1/3 rounded bg-slate-100"/>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isLoading && rows.length === 0 && (
                        <div className="flex flex-col items-center px-6 py-9 text-center">
                            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                <CheckCircle2 className="h-5 w-5"/>
                            </span>
                            <p className="text-sm font-semibold text-foreground">
                                {t("admin.notifications.emptyTitle")}
                            </p>
                            <p className="mt-1 max-w-64 text-xs leading-5 text-muted-foreground">
                                {t("admin.notifications.empty")}
                            </p>
                        </div>
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
                                className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-left !transition-none hover:bg-primary/[0.04] focus:bg-primary/[0.06] focus:text-slate-900"
                            >
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${copy?.iconClassName ?? "bg-slate-100 text-slate-600"}`}>
                                    <Icon className="h-4 w-4"/>
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col gap-1">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold leading-5 text-slate-900">
                                            {copy
                                                ? t(copy.titleKey)
                                                : t("admin.notifications.kindUnknown")}
                                        </span>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${copy?.badgeClassName ?? "bg-slate-100 text-slate-600"}`}>
                                            {t(copy?.badgeKey ?? "admin.notifications.badgeUpdate")}
                                        </span>
                                    </span>
                                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                                        <span className="truncate">
                                            {t("admin.notifications.riderRef", {id: n.riderId})}
                                        </span>
                                        <span aria-hidden="true" className="text-slate-300">•</span>
                                        <span className="shrink-0">
                                            {formatWhen(n.createdAt, i18n.language)}
                                        </span>
                                    </span>
                                </span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-focus:text-primary"/>
                            </DropdownMenuItem>
                        );
                    })}
                </div>
                <DropdownMenuSeparator className="m-0"/>
                <div className="bg-slate-50/60 p-2">
                    <DropdownMenuItem
                        onSelect={openQueue}
                        className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 font-semibold text-primary !transition-none hover:bg-primary/5 focus:bg-primary/5 focus:text-primary"
                    >
                        <span className="flex items-center gap-2">
                            <ListChecks className="h-4 w-4"/>
                            {t("admin.notifications.viewQueue")}
                        </span>
                        <ArrowRight className="h-4 w-4"/>
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

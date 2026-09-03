"use client";

import React, {useCallback, useEffect, useState} from "react";
import {useClickOutside} from "@/hooks/ui/useClickOutside";
import {useTranslation} from "react-i18next";
import {useNotificationStore} from "@/store/useNotificationStore";
import {ServerNotificationItem} from "@/services/NotificationService";
import {useRouter} from "next/navigation";
import {getRideAppUrl} from "@/utils/env";
import {withLocalePrefix} from "@/utils/localeHref";
import {navigateToExternal} from "@/utils/browser";
import {
    Bell,
    CheckCheck,
    CheckCircle2,
    AlertCircle,
    FileText,
    MailCheck,
    Loader2,
} from "lucide-react";
import {formatDistanceToNow} from "date-fns";
import {th} from "date-fns/locale/th";
import {enUS} from "date-fns/locale/en-US";
import {vi} from "date-fns/locale/vi";

interface NotificationDropdownProps {
    className?: string;
}

const getLocaleObject = (lang: string) => {
    switch (lang) {
        case "th":
            return th;
        case "vi":
            return vi;
        default:
            return enUS;
    }
};

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({className = ""}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useClickOutside<HTMLDivElement>(() => setIsOpen(false));
    const {t, i18n} = useTranslation();
    const router = useRouter();

    const {
        notifications,
        unreadCount,
        loading,
        hasFetched,
        loadFailed,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
    } = useNotificationStore();

    // Initial unread count check and polling
    useEffect(() => {
        fetchUnreadCount();
        const timer = setInterval(() => {
            fetchUnreadCount();
        }, 45000);
        return () => clearInterval(timer);
    }, [fetchUnreadCount]);

    const toggleDropdown = useCallback(() => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState) {
            fetchNotifications();
        }
    }, [isOpen, fetchNotifications]);

    const handleItemClick = async (item: ServerNotificationItem) => {
        if (!item.readAt) {
            await markAsRead(item.id);
        }
        setIsOpen(false);

        // Navigate based on notification kind
        if (
            item.kind === "RiderApplicationApproved" ||
            item.kind === "RiderApplicationRejected" ||
            item.kind === "RiderApplicationSubmitted" ||
            item.kind === "RiderApplicationResubmitted" ||
            item.kind === "RiderResubmissionReceived"
        ) {
            const rideUrl = `${getRideAppUrl()}${withLocalePrefix("/rider/apply", i18n.language)}`;
            navigateToExternal(rideUrl);
        }
    };

    const formatNotificationTime = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return formatDistanceToNow(date, {
                addSuffix: true,
                locale: getLocaleObject(i18n.language),
            });
        } catch {
            return dateString;
        }
    };

    const renderIcon = (kind: string) => {
        switch (kind) {
            case "RiderApplicationApproved":
                return (
                    <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                );
            case "RiderApplicationRejected":
                return (
                    <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                );
            case "RiderApplicationSubmitted":
            case "RiderApplicationResubmitted":
                return (
                    <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                    </div>
                );
            case "RiderResubmissionReceived":
                return (
                    <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <MailCheck className="w-5 h-5" />
                    </div>
                );
            default:
                return (
                    <div className="w-9 h-9 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5" />
                    </div>
                );
        }
    };

    const getTitle = (item: ServerNotificationItem) => {
        switch (item.kind) {
            case "RiderApplicationApproved":
                return t("notifications.riderApprovedTitle");
            case "RiderApplicationRejected":
                return t("notifications.riderRejectedTitle");
            case "RiderApplicationSubmitted":
                return t("notifications.riderSubmittedTitle");
            case "RiderApplicationResubmitted":
                return t("notifications.riderResubmittedTitle");
            case "RiderResubmissionReceived":
                return t("notifications.riderResubmissionReceivedTitle");
            default:
                return t("global.labelNotification");
        }
    };

    const getBody = (item: ServerNotificationItem) => {
        switch (item.kind) {
            case "RiderApplicationApproved":
                return t("notifications.riderApprovedBody");
            case "RiderApplicationRejected":
                return t("notifications.riderRejectedBody");
            case "RiderResubmissionReceived":
                return t("notifications.riderResubmissionReceivedBody");
            default:
                return null;
        }
    };

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            {/* Notification Bell Button */}
            <button
                type="button"
                onClick={toggleDropdown}
                className="relative text-white hover:text-white/90 px-2 py-1 flex items-center justify-center cursor-pointer transition-transform active:scale-95 focus:outline-none"
                aria-label={t("global.labelNotification")}
            >
                <Bell className="w-[22px] h-[22px] text-white" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-0.5 min-w-[18px] h-[18px] px-1 text-[11px] font-bold leading-[18px] text-white bg-red-500 rounded-full flex items-center justify-center shadow-sm">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Popover */}
            <div
                className={`absolute right-0 mt-3 w-[340px] sm:w-[380px] bg-white rounded-2xl shadow-2xl z-50 border border-gray-100 overflow-hidden transition-all duration-200 origin-top-right ${
                    isOpen
                        ? "opacity-100 scale-100 translate-y-0"
                        : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                }`}
            >
                {/* Header */}
                <div className="py-3.5 px-5 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-gray-900 font-bold text-base tracking-tight">
                        {t("global.labelNotification")}
                    </h3>
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={() => markAllAsRead()}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline transition-colors cursor-pointer"
                        >
                            <CheckCheck className="w-3.5 h-3.5" />
                            {t("notifications.markAllRead")}
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="min-h-[220px] max-h-[420px] overflow-y-auto">
                    {loading && !hasFetched ? (
                        <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-2">
                            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                            <p className="text-xs">{t("notifications.loading")}</p>
                        </div>
                    ) : loadFailed && notifications.length === 0 ? (
                        /* `data-testid` ไม่ใช่ของประดับ: เทสต์ของ #140 ยืนยันว่าแถบนี้
                           หายไปในกรณีกล่องว่างจริง ถ้าไม่มี attribute นี้ assertion นั้น
                           จะผ่านเสมอไม่ว่าจะเรนเดอร์อะไรออกมา (#144) */
                        <div
                            data-testid="notification-load-error"
                            className="py-12 px-6 flex flex-col items-center justify-center text-center"
                        >
                            <div className="w-12 h-12 mb-3 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <p className="text-xs text-gray-600 max-w-[260px] mb-3 leading-relaxed">
                                {t("notifications.loadErrorTitle")}
                            </p>
                            <button
                                type="button"
                                onClick={() => fetchNotifications()}
                                disabled={loading}
                                className="mt-1 px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                {loading
                                    ? t("notifications.loadErrorRetrying")
                                    : t("notifications.loadErrorRetry")}
                            </button>
                        </div>
                    ) : notifications.length === 0 ? (
                        /* Empty state matching user's image exactly */
                        <div className="py-14 px-6 flex flex-col items-center justify-center text-center">
                            <div className="w-24 h-24 mb-4 relative flex items-center justify-center">
                                <svg
                                    viewBox="0 0 100 100"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-24 h-24 text-gray-300"
                                >
                                    {/* Speech Bubble */}
                                    <path
                                        d="M16 26C16 20.4772 20.4772 16 26 16H66C71.5228 16 76 20.4772 76 26V54C76 59.5228 71.5228 64 66 64H32L16 76V26Z"
                                        stroke="currentColor"
                                        strokeWidth="3.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    {/* Bubble Lines */}
                                    <line
                                        x1="26"
                                        y1="34"
                                        x2="54"
                                        y2="34"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                    />
                                    <line
                                        x1="26"
                                        y1="44"
                                        x2="44"
                                        y2="44"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                    />
                                    {/* Heart shape overlapping bottom-right with white fill */}
                                    <path
                                        d="M50 54C46.5 48.5 38.5 47.5 33 53C26.5 59.5 26.5 70 33 77L50 92L67 77C73.5 70 73.5 59.5 67 53C61.5 47.5 53.5 48.5 50 54Z"
                                        transform="translate(28, 8) scale(0.68)"
                                        fill="#FFFFFF"
                                        stroke="currentColor"
                                        strokeWidth="4.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>
                            <p className="text-sm font-medium text-gray-400">
                                {t("notifications.emptyState")}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {notifications.map((item) => {
                                const isUnread = !item.readAt;
                                const title = getTitle(item);
                                const body = getBody(item);
                                const issues = item.decision?.issues || [];

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => handleItemClick(item)}
                                        className={`px-4 py-3.5 cursor-pointer flex gap-3.5 items-start transition-colors hover:bg-gray-50/80 ${
                                            isUnread ? "bg-blue-50/40" : "bg-white"
                                        }`}
                                    >
                                        {renderIcon(item.kind)}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                                <h4
                                                    className={`text-xs leading-snug line-clamp-2 ${
                                                        isUnread
                                                            ? "font-bold text-gray-900"
                                                            : "font-medium text-gray-700"
                                                    }`}
                                                >
                                                    {title}
                                                </h4>
                                                {isUnread && (
                                                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                                )}
                                            </div>

                                            {body && (
                                                <p className="text-[11px] text-gray-500 mb-1 line-clamp-2">
                                                    {body}
                                                </p>
                                            )}

                                            {issues.length > 0 && (
                                                <div className="space-y-0.5 mb-1.5 bg-rose-50/60 p-2 rounded-md border border-rose-100/60">
                                                    {issues.map((iss, idx) => (
                                                        <p
                                                            key={idx}
                                                            className="text-[11px] text-rose-700 leading-tight flex items-start gap-1"
                                                        >
                                                            <span className="text-rose-500 font-bold">•</span>
                                                            <span>
                                                                {iss.document ? `${iss.document}: ` : ""}
                                                                {iss.reason}
                                                            </span>
                                                        </p>
                                                    ))}
                                                </div>
                                            )}

                                            <span className="text-[10px] text-gray-400 font-medium">
                                                {formatNotificationTime(item.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationDropdown;

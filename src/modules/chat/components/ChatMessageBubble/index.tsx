"use client";

import Image, {StaticImageData} from "next/image";
import type {ChatMessage, LocalUserId} from "108jobs-client";
import {MessageImage} from "@/constants/images";
import {useTranslation} from "react-i18next";
import {useChatStore} from "@/modules/chat/store/chatStore";
import React, {useMemo, useEffect} from "react";
import {toLocalTime} from "@/utils/date";
import MessageStatusIndicator from "@/modules/chat/components/MessageStatusIndicator";
import {dbg} from "@/modules/chat/utils";
import {isSameOrAfter, isApproxSame} from "@/modules/chat/utils/helpers";
import {useReadLastIdStore} from "@/modules/chat/store/readStore";
import {usePeerOnline} from "@/modules/chat/store/presenceStore";
import {Stars} from "@/components/RatingDisplay";
import {useChatServices} from "@/modules/chat/contexts/ChatBridgeProvider";

interface ChatMessageItemProps {
    message: ChatMessage;
    partnerAvatar?: string | StaticImageData;
    partnerId: LocalUserId;
}

interface ProposedQuoteMessage {
    type: string;
    quote?: {
        employerId: number;
        postId: number;
        proposalId: number;
        amount: number;
        proposal: string;
        projectName: string;
        projectDetails: string;
        workSteps?: Array<{
            seq: number;
            description: string;
            amount: number;
            workingDays: number;
            status: string;
            startingDay: string;
            deliveryDay: string;
        }>;
        workingDays: number;
        deliverables?: string[];
        note?: string;
        startingDay: string;
        deliveryDay: string;
    };
    rating?: number;
    comment?: string;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
                                                             message,
                                                             partnerAvatar,
                                                             partnerId
                                                         }) => {
    const {t, i18n} = useTranslation();
    const {resend} = useChatServices();
    const liveMessage = useChatStore((s) => {
        const mid = message?.id;
        if (!mid) return undefined;
        return (
            s.listMessages || []).find((m: any) => String(m.id) === String(mid)
        );
    });
    const viewMsg = liveMessage || message;
    const createdAt = (viewMsg as any)?.createdAt as any;
    const roomIdStr = String((viewMsg as any)?.roomId ?? "");
    const selectPeerLastReadAt = useMemo(
        () => (s: any) => s?.getPeerLastReadAt?.(roomIdStr, partnerId) ?? null,
        [roomIdStr, partnerId]
    );
    const lastReadAt = useReadLastIdStore(selectPeerLastReadAt);
    useEffect(() => {
        dbg('lastReadAt', lastReadAt);
    }, [lastReadAt]);
    const isIncoming = !viewMsg.isOwner;

    const time = toLocalTime(createdAt, i18n?.language || "th-TH");
    const isOwner = !!viewMsg.isOwner;

    const peerOnline = usePeerOnline(Number(partnerId));

    const isRead = useMemo(() => {
        // Only consider as "read" when the peer is currently online and the read timestamp covers this message
        return (
            isOwner &&
            lastReadAt != null &&
            isSameOrAfter(lastReadAt as any, createdAt)
        );
    }, [isOwner, lastReadAt, createdAt]);

    const isLastRead = useMemo(() => {
        return (
            isOwner &&
            lastReadAt != null &&
            isApproxSame(lastReadAt as any, createdAt)
        );
    }, [isOwner, lastReadAt, createdAt]);

    const readTime = useMemo(() => {
        return isLastRead && lastReadAt
            ? toLocalTime(lastReadAt as any, i18n?.language || "th-TH")
            : null;
    }, [isLastRead, lastReadAt, i18n?.language]);

    const parsed = useMemo<ProposedQuoteMessage | null>(() => {
        const c = viewMsg?.content;
        if (c && c.trim().startsWith("{")) {
            try {
                return JSON.parse(c) as ProposedQuoteMessage;
            } catch {
                return null;
            }
        }
        return null;
    }, [viewMsg?.content]);

    const isEmployerStarted = parsed && parsed.type === "employer-started";
    const isProposedQuote = parsed && parsed.type === "proposed-quote" && parsed.quote;
    const isEmployerAssigned = parsed && parsed.type === "employer-assigned";
    const isStartWork = parsed && parsed.type === "start-work";
    const isCancelJob = parsed && parsed.type === "cancel-job";
    const isSubmitDelivery = parsed && parsed.type === "submit-delivery";
    const isRequestRevision = parsed && parsed.type === "request-revision";
    const isDeliveryAccepted = parsed && parsed.type === "delivery-accepted";
    const isFileMsg = parsed && parsed.type === "file";
    const isReviewSubmitted = parsed && parsed.type === "review-submitted" && parsed.rating;

    return (
        <div
            data-testid="chat-message"
            data-status={viewMsg.status}
            className={`flex ${isIncoming ? "justify-start" : "justify-end"}`}
        >
            {isIncoming && (
                <Image
                    src={partnerAvatar || MessageImage.chatAvt}
                    alt="avatar"
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full mr-3 self-end"
                />
            )}
            <div
                className={`flex flex-col gap-1.5 ${isIncoming ? "items-start" : "items-end"} max-w-[90%]`}
            >
                {/* Keep MessageStatusIndicator outside the message card */}
                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <MessageStatusIndicator
                        isOwner={viewMsg.isOwner}
                        unread={(viewMsg as any).unread}
                        msgStatus={viewMsg.status}
                        isRead={isRead}
                        readTime={readTime}
                        t={t}
                        onRetry={
                            viewMsg.isOwner
                                ? () => {
                                    const rid = String((viewMsg as any)?.roomId ?? "");
                                    if (rid) {
                                        try {
                                            resend?.flushActive(rid);
                                        } catch {
                                        }
                                    }
                                }
                                : undefined
                        }
                    />
                </div>

                {isReviewSubmitted ? (
                    <div
                        className={`max-w-[90vw] sm:max-w-md w-full rounded-xl shadow-sm ring-1 ${
                            isIncoming ? "ring-yellow-200 bg-yellow-50 mt-2" : "ring-yellow-200 bg-yellow-50"
                        } px-4 py-3`}
                    >
                        <div className="flex items-start gap-3 flex-wrap">
                            <svg
                                className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.97a1 1 0 00.95.69h4.178c.969 0 1.371 1.24.588 1.81l-3.39 2.467a1 1 0 00-.364 1.118l1.287 3.97c.3.921-.755 1.688-1.538 1.118l-3.39-2.467a1 1 0 00-1.175 0l-3.39 2.467c-.783.57-1.838-.197-1.538-1.118l1.287-3.97a1 1 0 00-.364-1.118L2.236 9.397c-.783-.57-.381-1.81.588-1.81h4.178a1 1 0 00.95-.69l1.286-3.97z"/>
                            </svg>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="text-sm font-medium text-yellow-800">
                                        {t("profileChat.reviewSubmitted") || "Review Submitted"}
                                    </div>
                                    <span className="text-xs text-gray-500 ml-auto min-w-fit">{time}</span>
                                </div>
                                <div className="mt-1 flex items-center gap-1">
                                    <Stars rating={parsed!.rating!} />
                                </div>
                                <div className="mt-1 text-xs text-gray-700 whitespace-pre-line break-words">
                                    {parsed!.comment}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : isProposedQuote ? (
                    <div
                        className={`max-w-[90vw] sm:max-w-lg w-full rounded-2xl shadow-lg ring-1 transition-all duration-200 hover:shadow-xl ${
                            isIncoming ? "bg-white ring-gray-200" : "bg-blue-50 ring-blue-200"
                        } overflow-hidden`}
                    >
                        <div
                            className={`px-5 py-4 ${isIncoming ? "bg-gray-100" : "bg-blue-100"} flex items-center justify-between gap-4 flex-wrap`}
                        >
                            <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                                    <path
                                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14h-2v6H6v2h4v4h2v-4h4v-2h-4V6z"
                                    />
                                </svg>
                                <h4 className="block basis-full text-base font-semibold text-gray-900 break-words">
                                    {parsed!.quote!.projectName}
                                </h4>
                            </div>

                        </div>

                        <div className="px-5 py-4 space-y-4 bg-white">
                            <div className="text-lg font-bold text-blue-700">
                                {t('profileChat.price')}:  {parsed!.quote!.amount.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </div>
                            <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                                {parsed!.quote!.proposal}
                            </div>
                            <div
                                className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3"
                            >
                                <div className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                                        <path
                                            d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 16H5V5h14v14z"
                                        />
                                    </svg>
                                    <span>Start: {parsed!.quote!.startingDay}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                                        <path
                                            d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 16H5V5h14v14z"
                                        />
                                    </svg>
                                    <span>Due: {parsed!.quote!.deliveryDay}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                                        <path
                                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zM11 7h2v6h-2zm0 8h2v2h-2z"
                                        />
                                    </svg>
                                    <span>Days: {parsed!.quote!.workingDays}</span>
                                </div>
                            </div>
                            {parsed!.quote!.projectDetails && (
                                <details className="text-sm text-gray-700">
                                    <summary
                                        className="cursor-pointer select-none font-medium text-gray-800 hover:text-blue-600 transition-colors"
                                    >
                                        {t('profileChat.projectDetails')}
                                    </summary>
                                    <div
                                        className="mt-2 text-sm text-gray-600 whitespace-pre-line bg-gray-50 rounded-lg p-3"
                                    >
                                        {parsed!.quote!.projectDetails}
                                    </div>
                                </details>
                            )}
                            {parsed!.quote!.deliverables && parsed!.quote!.deliverables.length > 0 && (
                                <div>
                                    <div className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                                            <path
                                                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 12H8v-2h3v2zm0-4H8V9h3v2zm5 4h-3v-2h3v2zm0-4h-3V9h3v2z"
                                            />
                                        </svg>
                                        Deliverables
                                    </div>
                                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1.5">
                                        {parsed!.quote!.deliverables.map((d, i) => (
                                            <li key={i} className="break-words">{d}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {parsed!.quote!.workSteps && parsed!.quote!.workSteps.length > 0 && (
                                <div className="border-t pt-3">
                                    <div className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                                            <path
                                                d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z"
                                            />
                                        </svg>
                                        {t('profileChat.workSteps')}
                                    </div>
                                    <div className="space-y-2">
                                        {parsed!.quote!.workSteps.map((ws, i) => (
                                            <div
                                                key={i}
                                                className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 transition-all duration-200 hover:bg-gray-100"
                                            >
                                                <div className="font-medium text-gray-800">
                                                    #{ws.seq} {ws.description}
                                                </div>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                                                    <span>{ws.amount.toLocaleString()}</span>
                                                    <span>{ws.workingDays} days</span>
                                                    <span
                                                        className={`px-1.5 py-0.5 rounded ${
                                                            ws.status === "completed"
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-yellow-100 text-yellow-700"
                                                        }`}
                                                    >
                    {ws.status}
                  </span>
                                                    <span>
                    {ws.startingDay} → {ws.deliveryDay}
                  </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {parsed!.quote!.note && (
                                <div className="border-t pt-3 text-sm text-gray-600">
                                    <span className="font-semibold text-gray-800">Note: </span>
                                    {parsed!.quote!.note}
                                </div>
                            )}
                            <div className="flex justify-end">
                                <span className="text-xs text-gray-500 min-w-fit">{time}</span>
                            </div>
                        </div>
                    </div>
                ) : isEmployerStarted ? (
                    <div
                        className="max-w-[90vw] sm:max-w-md w-full rounded-xl shadow-sm ring-1 px-4 py-3 transition-all duration-200 mt-2 bg-green-50"
                    >
                        <div className="flex items-start gap-3 flex-wrap text-primary">
                            <svg
                                className="w-5 h-5 flex-shrink-0 mt-0.5"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    d="M9.83 3.42A2 2 0 0112 2h2a2 2 0 011.17.38l.12.1 4.92 4.92a2 2 0 01.58 1.42V19a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h4.83zM12 4H5v15h14V9h-5V4h-2zm1 2v3h3l-3-3zm-3 5h4v2h-4v-2zm0 4h6v2h-6v-2z"
                                />
                            </svg>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="text-sm font-semibold">
                                        {t("profileChat.startHiring") || "Employer started hiring."}
                                    </div>
                                    <span className="text-xs text-gray-500 ml-auto min-w-fit">{time}</span>
                                </div>
                                <div className="mt-1 text-xs text-teal-700">
                                    {t("profileChat.startHiringHint") ||
                                        "The hiring process has been initiated. Awaiting freelancer response."}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : isStartWork ? (
                    <div
                        className="max-w-[90vw] sm:max-w-md w-full rounded-xl shadow-sm ring-2 ring-blue-300 bg-blue-50 px-4 py-3 relative overflow-hidden"
                    >
                        <div className="absolute inset-y-0 left-0 w-1 bg-blue-500 animate-pulse"></div>
                        <div className="flex items-start gap-3 flex-wrap">
                            <svg
                                className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    d="M8 5v2.5l4 4 4-4V5H8zm-2-2h12v6l-6 6-6-6V3zm-2 8h16v10H4V11zm2 2v6h12v-6H6z"
                                />
                            </svg>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="text-sm font-semibold text-blue-800">
                                        {t("profileChat.startWorkMsg") || "Freelancer started work."}
                                    </div>
                                    <span className="text-xs text-gray-500 ml-auto min-w-fit">{time}</span>
                                </div>
                                <div className="mt-1 text-xs text-blue-700">
                                    {t("profileChat.startWorkHint") ||
                                        "The freelancer has begun working on the project."}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : isEmployerAssigned ? (
                    <div
                        className="max-w-[90vw] sm:max-w-md w-full rounded-xl shadow-sm ring-1 ring-green-200 bg-green-50 px-4 py-3"
                    >
                        <div className="flex items-start gap-3 flex-wrap">
                            <svg
                                className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293A1 1 0 106.293 10.707l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="text-sm font-medium text-green-800">
                                        {t("profileChat.confirmAssignMsg") ||
                                            "Assignment confirmed. Waiting for freelancer to accept."}
                                    </div>
                                    <span className="text-xs text-gray-500 ml-auto min-w-fit">{time}</span>
                                </div>
                                <div className="mt-0.5 text-xs text-primary">
                                    {t("profileChat.orderApprovedMessage")}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : isCancelJob ? (
                    <div
                        className="max-w-[90vw] sm:max-w-md w-full rounded-xl text-primary shadow-sm ring-1 ring-red-200 bg-red-50 px-4 py-3 mt-2"
                    >
                        <div className="flex items-start gap-3 flex-wrap">
                            <svg
                                className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3-9a1 1 0 00-1-1H8a1 1 0 100 2h4a1 1 0 001-1z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="text-sm font-medium text-red-800">
                                        {t("profileChat.cancelledJobMsg") || "The job has been cancelled."}
                                    </div>
                                    <span className="text-xs text-gray-500 ml-auto min-w-fit">{time}</span>
                                </div>
                                <div className="mt-0.5 text-xs text-red-700">
                                    {t("profileChat.cancelledJobHint") ||
                                        "All ongoing actions are stopped. You can start a new chat to discuss again."}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : isRequestRevision ? (
                    <div
                        className={`max-w-[90vw] sm:max-w-md w-full rounded-xl shadow-sm ring-1 ${
                            isIncoming ? "ring-amber-200 bg-amber-50 mt-2" : "ring-amber-200 bg-amber-50"
                        } px-4 py-3`}
                    >
                        <div className="flex items-start gap-3 flex-wrap">
                            <svg
                                className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 5a1 1 0 10-2 0v6a1 1 0 001 1h4a1 1 0 100-2h-3V7z"
                                />
                            </svg>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="text-sm text-primary font-semibold text-amber-800">
                                        {t("profileChat.requestRevision") || "Request revision"}
                                    </div>
                                    <span className="text-xs text-gray-500 ml-auto min-w-fit">{time}</span>
                                </div>
                                <div className="mt-1 text-xs text-primary whitespace-pre-line break-words">
                                    {(parsed as any)?.reason && String((parsed as any).reason) ||
                                        t("profileChat.requestRevisionMsg") || "Please revise and resubmit."}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : isSubmitDelivery ? (
                    <div
                        className={`max-w-[90vw] sm:max-w-md w-full rounded-xl shadow-sm ring-1 ${
                            isIncoming ? "ring-amber-200 bg-amber-50 mt-2" : "ring-blue-200 bg-blue-50"
                        } px-4 py-3`}
                    >
                        <div className="flex items-start gap-3 flex-wrap">
                            <svg
                                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                    isIncoming ? "text-primary" : "text-blue-600"
                                }`}
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    d="M3 7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                                />
                            </svg>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div
                                        className={`text-sm font-medium ${
                                            isIncoming ? "text-primary" : "text-blue-800"
                                        }`}
                                    >
                                        {t("profileChat.submitDeliveryMsg") || "Freelancer submitted a delivery."}
                                    </div>
                                    <span className="text-xs text-gray-500 ml-auto min-w-fit">{time}</span>
                                </div>
                                <div className="mt-1 text-xs text-primary break-words">
                                    {(parsed as any)?.name || (parsed as any)?.url || ""}
                                </div>
                                {(parsed as any)?.url && (
                                    <div className="mt-2">
                                        <a
                                            href={(parsed as any).url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${
                                                isIncoming
                                                    ? "bg-primary hover:bg-amber-700 text-white"
                                                    : "bg-primary hover:bg-[#063a68] text-white"
                                            }`}
                                        >
                                            <svg
                                                className="w-4 h-4"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    d="M12.293 2.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414L9.414 16H5v-4.414l8.293-8.293z"
                                                />
                                            </svg>
                                            <span>{t("global.open")}</span>
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : isDeliveryAccepted ? (
                    <div
                        className={`max-w-[90vw] sm:max-w-md w-full rounded-xl shadow-sm ring-1 ring-emerald-200 bg-green-500 px-4 py-3 ${
                            isIncoming ? "mt-2" : ""}`}
                    >
                        <div className="flex items-start gap-3 flex-wrap">
                            <svg
                                className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293A1 1 0 106.293 10.707l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="text-sm font-medium text-emerald-800">
                                        {t("profileChat.deliveryAccepted") || "Delivery accepted. Proceed to payment."}
                                    </div>
                                    <span className="text-xs text-gray-500 ml-auto min-w-fit">{time}</span>
                                </div>
                                <div className="mt-0.5 text-xs text-emerald-700">
                                    {t("profileChat.deliveryAcceptedHint") ||
                                        "Payment will be released to the freelancer."}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : isFileMsg ? (
                    <div
                        className={`max-w-[90vw] sm:max-w-md w-full rounded-xl shadow-sm ring-1 overflow-hidden ${
                            isIncoming ? "bg-white ring-gray-200" : "bg-blue-50 ring-blue-200"
                        }`}
                    >
                        <div className={`px-4 py-3 ${isIncoming ? "bg-gray-50" : "bg-blue-100"}`}>
                            <div className="flex items-start gap-3 flex-wrap">
                                {String((parsed as any)?.mime || "").startsWith("image/") &&
                                (parsed as any)?.url ? (
                                    <a
                                        href={(parsed as any).url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block flex-shrink-0"
                                    >
                                        <img
                                            src={(parsed as any).url}
                                            alt={(parsed as any)?.name || "image"}
                                            className="w-16 h-16 object-cover rounded-md ring-1 ring-black/5"
                                        />
                                    </a>
                                ) : (
                                    <div
                                        className={`w-12 h-12 rounded-md flex items-center justify-center ${
                                            isIncoming ? "bg-white" : "bg-white"
                                        } ring-1 ring-black/5 text-gray-600`}
                                        aria-hidden
                                    >
                                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                            <path
                                                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM8 18h8v2H8v-2zm0-4h8v2H8v-2zm6-7v5h5"
                                            />
                                        </svg>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <a
                                            href={(parsed as any).url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm font-medium text-gray-900 truncate max-w-[220px] sm:max-w-[280px]"
                                        >
                                            {(parsed as any)?.name || (parsed as any)?.url || "file"}
                                        </a>
                                        {(parsed as any)?.mime && (
                                            <span
                                                className="text-[10px] px-1.5 py-0.5 rounded bg-white text-gray-700 ring-1 ring-black/5"
                                            >
                        {String((parsed as any).mime).split("/").pop()}
                      </span>
                                        )}
                                        <span className="text-xs text-gray-500 ml-auto min-w-fit">{time}</span>
                                    </div>
                                    {(parsed as any)?.caption && (
                                        <div
                                            className="mt-1 text-xs text-gray-700 whitespace-pre-line break-words"
                                        >
                                            {String((parsed as any).caption)}
                                        </div>
                                    )}
                                    {(parsed as any)?.url && (
                                        <div className="mt-2">
                                            <a
                                                href={(parsed as any).url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${
                                                    isIncoming
                                                        ? "bg-gray-900 hover:bg-black text-white"
                                                        : "bg-primary hover:bg-[#063a68] text-white"
                                                }`}
                                            >
                                                <svg
                                                    className="w-4 h-4"
                                                    viewBox="0 0 20 20"
                                                    fill="currentColor"
                                                    aria-hidden="true"
                                                >
                                                    <path
                                                        d="M12.293 2.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414L9.414 16H5v-4.414l8.293-8.293z"
                                                    />
                                                </svg>
                                                <span>{t("global.open")}</span>
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div
                        className={`max-w-[80vw] sm:max-w-xs px-3 py-2 rounded-2xl text-[15px] leading-relaxed font-sans break-words whitespace-pre-line shadow-sm ${
                            isIncoming
                                ? "bg-[#E5E5E5] text-gray-800 rounded-bl-sm ring-1 ring-gray-200"
                                : "bg-primary text-white rounded-br-sm"
                        }`}
                    >
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex-1">{viewMsg.content}</span>
                            <span
                                className="text-xs min-w-fit"
                                style={{color: isIncoming ? "gray" : "rgba(255, 255, 255, 0.7)"}}
                            >
                                {time}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessageItem;
"use client";

/**
 * ChatRoomView
 * -------------
 * Purpose:
 *   High-level container for a freelancer/employer chat room. Renders header, message list,
 *   input area, and the job workflow side panel. Coordinates history fetching, read receipts,
 *   and workflow state synchronization.
 *
 * Key data flow:
 *   - Messages: read from `useChatStore(selectRoomMessages(roomId))`. History pages are appended
 *     via `useChatHistory({...}).actions.fetchHistory()` and written back using `upsertHistory`.
 *   - Sending: user input -> `onSubmit` -> adapter (`useChatRoom().actions.sendMessage`).
 *   - Read/Seen: when user reaches bottom or window regains focus -> `sendReadReceipt` and
 *     `roomsStore.markRoomRead/markSeen`.
 *   - Workflow: `useWorkflowStatus` + `useWorkflowActions` sync API/workflow state to UI/side panel.
 *
 * UX principles:
 *   - Minimal, predictable scrolling: keep viewport stable after loading older pages.
 *   - Clean state: no optimistic emit duplication — adapter is the single source of truth for emits.
 *   - Mobile-first layout: workflow panel collapses on small screens.
 */

import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {useParams} from "next/navigation";
import {v4 as uuidv4} from "uuid";
import {ProfileImage} from "@/constants/images";
import type {
    ChatMessage, ChatParticipantView, ChatRoomId,
    ChatRoomView,
    LocalUser,
    Post,
    PostPreview,
    SubmitUserReviewForm
} from "108jobs-client";
import ChatHeader from "../ChatHeader";
import ChatInput from "../ChatInput";
import ChatRoomMessages from "../ChatRoomMessages";
import ChatSearchPanel from "@/modules/chat/components/ChatSearchPanel";
import ChatRoomTabs from "@/modules/chat/components/ChatRoomTabs";
import {useChatPanelStore} from "@/modules/chat/store/chatPanelStore";
import {useRoomsStore} from '@/modules/chat/store/roomsStore';
import FreelanceChatFlow, {FlowActions, StatusKey} from "@/modules/chat/components/FreelanceChatFlow";
import {createFlowActions} from "@/modules/chat/utils/flowActions";
import QuotationModal from "@/modules/chat/components/Modal/QuotationModal";
import {useWorkflowStepper} from "@/hooks/utils/useWorkflowMachine";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {apiToUiStatus, useStateMachineStore} from "@/modules/chat/store/stateMachineStore";
import {Trash2} from "lucide-react";
import {ReviewDeliveryModal} from "@/modules/chat/components/Modal/ReviewDeliveryModal";
import {JobFlowContent} from "@/modules/chat/components/JobFlowContent";
import ChatSidebarTabs from "@/modules/chat/components/ChatSidebarTabs";
import {useWorkflowStatus} from '@/modules/chat/hooks/useWorkflowStatus';
import {useFileUpload} from '@/modules/chat/hooks/useFileUpload';
import {useWorkflowActions} from '@/modules/chat/hooks/useWorkflowActions';
import {useHistoryBackfill} from "@/modules/chat/hooks/useHistoryBackfill";
import {buildAttachmentEnvelope} from "@/modules/chat/attachments";
import {useChatRoom} from '@/modules/chat/hooks/useChatRoom';
import {useChatHistory} from '@/modules/chat/hooks/useChatHistory';
import {useChatStore} from "@/modules/chat/store/chatStore";
import {useLoadLastRead} from "@/modules/chat/hooks/useLoadLastRead";
import {useChatReadReceipts} from "@/modules/chat/hooks/useChatReadReceipts";
import {REQUEST_STATE} from "@/services/HttpService";
import {useUserStore} from "@/store/useUserStore";
import {useJobFlowSidebar} from "@/modules/chat/contexts/JobFlowSidebarContext";
import {SubmitReviewModal} from "@/modules/chat/components/Modal/SubmitReviewModal";

/** Shape of the form submitted by ChatInput. */
type MessageForm = { message: string };


/**
 * Props for ChatRoomView
 * @property post               (Optional) Post record tied to this room; used for employer/freelancer role checks.
 * @property partner            Display data for the chat partner.
 * @property roomData           Full room data object (server-sourced). Used to seed currentRoom and workflow.
 * @property localUser          Current logged-in user record.
 * @property peerPublicKeyHex   Public key used for peer activity/typing via channel hook.
 */
interface ChatRoomViewProps {
    post?: Post | PostPreview;
    partner: ChatParticipantView;
    roomId: ChatRoomId;
    localUser: LocalUser;
}


const ChatRoomView: React.FC<ChatRoomViewProps> = ({
                                                       post,
                                                       partner,
                                                       roomId,
                                                       localUser
                                                   }) => {
    const {t} = useTranslation();
    const params = useParams<{lang?: string}>();
    const lang = params?.lang || "th";
    const {person, userInfo} = useUserStore();
    const {wasUnread, clearWasUnread, getRoom} = useRoomsStore();
    const roomData = getRoom(roomId);
    const wallet = userInfo?.wallet;
    // --- Availability & basic send gating ---
    // Treat undefined availability as "available". Block sending if either side is unavailable.
    const isSubmittingRef = useRef(false);
    const myAvailable = person!.available;
    const canBeUsed = myAvailable && partner.available;
    // Set of message IDs received during this session, used by history hook to deduplicate pages.
    const receivedIds = useMemo(() => new Set<string>(), []);
    // Partner here
    const partnerId = partner.id;
    const partnerPersonId = partner.personId;
    const partnerName = partner.name;
    const partnerAvatar = partner.avatar;
    // Hydrate UI from the local store (messages + pending) so leftover local data shows immediately
    const {send, canGo, ORDER} = useWorkflowStepper();
    const [showReviewDeliveryModal, setShowReviewDeliveryModal] = useState<boolean>(false);
    const [showSubmitReviewModal, setShowSubmitReviewModal] = useState<boolean>(false);
    const [showQuotationModal, setShowQuotationModal] = useState<boolean>(false);
    const [hasStarted, setHasStarted] = useState<boolean>(false);
    // Flow sidebar is now managed globally via JobFlowSidebarProvider
    const {isOpen: isFlowOpen, setOpen: setIsFlowOpen, setContent} = useJobFlowSidebar();
    const [currentRoom, setCurrentRoom] = useState<ChatRoomView>(roomData as ChatRoomView);
    const {getByRoom} = useChatStore();
    const messages = getByRoom(roomId);
    const isSearchOpen = useChatPanelStore((s) => s.isSearchOpen);
    const openSearch = useChatPanelStore((s) => s.openSearch);
    const closeSearch = useChatPanelStore((s) => s.closeSearch);
    const initialFetchRef = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const roomPostId = post?.id ?? currentRoom.room.postId;
    const roomProposalId = currentRoom.room.currentProposalId;
    const postCreatorId = post?.creatorId;
    const isEmployer = postCreatorId != null && person?.id != null ? String(postCreatorId) === String(person?.id) : undefined;
    const lastClientUpdateRef = useRef<{ status: StatusKey | null; timestamp: number }>({status: null, timestamp: 0});
    const currentStatus = useStateMachineStore((s) => s.state);
    const statusBeforeCancel = useStateMachineStore((s) => s.statusBeforeCancel);
    // Determine latest quotation amount and whether employer has enough balance to approve
    const latestQuoteAmount = currentRoom?.post?.budget ?? 0;

    // --- Quotation & balance helpers ---
    const availableBalance: number = useMemo(() => {
        const total = Number((wallet as any)?.balanceAvailable ?? (wallet as any)?.balanceTotal ?? 0);
        return Number.isFinite(total) ? total : 0;
    }, [wallet]);

    const insufficientForApprove = useMemo(() => {
        return Boolean(isEmployer && latestQuoteAmount != null && availableBalance < (latestQuoteAmount as number));
    }, [isEmployer, latestQuoteAmount, availableBalance]);

    const isEmployerKnown = typeof isEmployer === 'boolean';
    const {execute: createInvoice} = useHttpPost("createInvoice");
    const {execute: startWorkflow} = useHttpPost("startWorkflow");
    const {execute: approveQuotationApi} = useHttpPost("approveQuotation");
    const {execute: submitStartWorkApi} = useHttpPost("submitStartWork");
    const {execute: approveWorkApi} = useHttpPost("approveWork");
    const {execute: submitReviewApi} = useHttpPost("submitUserReview");

    const inputContainerRef = useRef<HTMLDivElement>(null);

    const {
        selectedFile,
        setSelectedFile,
        isDeletingFile,
        handleFileUpload,
        handleRemoveSelectedFile,
        isUploading,
        uploadProgress,
        attachmentPreview,
    } = useFileUpload({setError, t: (k: string) => t(k)});
    // Rounded once here rather than at each of the progress indicator's two
    // render sites (thumbnail overlay, file-chip bar) below, so they can
    // never disagree by a rounding edge case. Null while indeterminate --
    // see `useFileUpload`'s own doc comment on `uploadProgress` for when.
    const uploadPercent = uploadProgress != null ? Math.round(uploadProgress * 100) : null;
    // Belt-and-suspenders for the composer thumbnail's own <img>/<video>:
    // unlike ChatMessageBubble's local preview (handleMediaElementError),
    // this element has no server-backed URL to fall back to while a file is
    // still only picked/uploading, so a failed blob load (e.g. a
    // misconfigured `img-src`/`media-src` CSP -- `'self'` does not cover
    // `blob:`) must degrade to the same file chip a non-media attachment
    // gets rather than rendering nothing. Compared against the preview's own
    // url (not a plain boolean) so a new pick -- which always carries a
    // fresh `URL.createObjectURL` value -- automatically stops treating
    // itself as failed without needing a separate reset effect.
    const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
    const thumbLoadFailed = attachmentPreview !== null && attachmentPreview.url === failedPreviewUrl;
    const upsertHistory = useChatStore(s => s.upsertHistory);
    const markRoomReadInStore = useRoomsStore(s => s.markRoomRead);

    // fetch the last read timestamp from the backend and store it into useReadLastIdStore
    useLoadLastRead(roomId, partnerId);

    // --- History management ---
    // Pulls paginated history for this room and writes pages into the global store via upsertHistory.
    // `receivedSet` prevents double-inserting messages when pages overlap.
    const {
        state: {hasMore, isFetching},
        actions: {fetchHistory, loadOlderUntilDone},
    } = useChatHistory({
        roomId,
        pageSize: 40,
        isE2EMock: false,
        localUserId: Number(localUser.id) || 0,
        receivedSet: receivedIds,
        broadcast: () => {
        },
        upsertHistory,
    });
    useHistoryBackfill({roomId, loadOlderUntilDone});

    // Close search when the room changes so it does not carry a stale query
    // across conversations.
    useEffect(() => () => closeSearch(), [roomId, closeSearch]);

    const {
        actions: {sendMessage, sendTyping, sendRoomUpdate, sendReadReceipt},
        state: {isPartnerTyping},
    } = useChatRoom({roomId, localUser, roomData: currentRoom});

    const {sendLatestRead} = useChatReadReceipts({
        roomId,
        messages,
        localUserId: Number(localUser.id),
        sendReadReceipt,
    });

    // Landing on a conversation should show the conversation. The tab bar owns
    // the Chat/Order choice from then on.
    //
    // This replaces a resize listener that called setIsFlowOpen(false) on every
    // resize below 640px. Under the old slide-over that just closed a drawer;
    // with tabs it yanks a mobile reader off the Order tab, and iOS fires
    // resize whenever the URL bar shows or hides. The 640 was also inconsistent
    // with the md/768 breakpoint everything else in this feature uses.
    useEffect(() => {
        setIsFlowOpen(false);
    }, [roomId, setIsFlowOpen]);

    // Keep the local ` currentRoom ` in sync with server-refreshed room metadata from the channel.
    useLayoutEffect(() => {
        if (!roomData) return;
        setCurrentRoom(roomData);
    }, [roomData]);

    // Mark active + read, and notify peer on join/leave (single source of truth)
    useEffect(() => {
        if (initialFetchRef.current) return;

        const chatStore = useChatStore.getState();

        const localMessages: ChatMessage[] = chatStore.getByRoom
            ? chatStore.getByRoom(roomId)
            : [];
        const hasLocalMessages = Array.isArray(localMessages) && localMessages.length > 0;

        const shouldFetch = wasUnread(roomId) || !hasLocalMessages;

        if (!shouldFetch || isFetching) return;

        initialFetchRef.current = true;

        fetchHistory()
            .then(() => {
                // after successfully fetching messages
                clearWasUnread(roomId);
                markRoomReadInStore(roomId);
            })
            .catch(() => {
                initialFetchRef.current = false; // allow retry
            });
    }, [roomId, isFetching, fetchHistory]);

    const setWorkflowState = (key: StatusKey, statusBeforeCancel?: StatusKey, isClientUpdate = true) => {
        useStateMachineStore.setState({
            state: key,
            stepIndex: ORDER.indexOf(key),
            statusBeforeCancel: key === 'Cancelled' ? (statusBeforeCancel ?? currentStatus) : undefined,
        });
        if (isClientUpdate) {
            lastClientUpdateRef.current = {status: key, timestamp: Date.now()};
        }
    };

    const {goToStatus, handleChangeStatus} = useWorkflowStatus({
        currentStatus,
        setWorkflowState,
        hasStarted,
        setHasStarted,
        ORDER,
        send,
        canGo,
        statusBeforeCancel,
    });

    // Reflect the backend workflow state in the UI state machine. Keeps `hasStarted` and `statusBeforeCancel` coherent.
    useEffect(() => {
        const rd: any = currentRoom as any;
        if (!rd) return;
        const apiStatusRaw = rd?.workflow?.status;
        const apiStatusBeforeCancelRaw = rd?.workflow?.statusBeforeCancel;
        if (typeof apiStatusRaw === 'string') {
            const uiStatus = apiToUiStatus(apiStatusRaw as any);
            const uiStatusBeforeCancel = apiStatusBeforeCancelRaw
                ? apiToUiStatus(apiStatusBeforeCancelRaw as any)
                : undefined;
            if (uiStatus) {
                const shouldBeStarted = uiStatus !== 'Completed' && uiStatus !== 'Cancelled';
                setHasStarted(shouldBeStarted);
                if (uiStatus !== currentStatus || uiStatusBeforeCancel !== statusBeforeCancel) {
                    setWorkflowState(uiStatus as StatusKey, uiStatusBeforeCancel as StatusKey | undefined, false);
                }
            }
        }
    }, [currentRoom, currentStatus, statusBeforeCancel, setHasStarted]);

    // Centralize all workflow actions into a dedicated hook
    const {
        startWorkflowAction,
        quotationSubmit,
        approveQuotation: approveQuotationFromHook,
        startWork,
        submitDelivery,
        requestRevision,
        approveWork,
        cancelJob,
    } = useWorkflowActions({
        messages,
        roomData: currentRoom,
        localUser,
        roomId,
        selectedFile,
        setError,
        t: (k: string) => String(t(k) ?? k),
        sendMessage,
        sendRoomUpdate,
        goToStatus,
        setHasStarted,
        setShowQuotationModal,
        setSelectedFile,
        createInvoice,
        startWorkflow,
        approveQuotationApi,
        submitStartWorkApi,
        approveWorkApi,
        postId: roomPostId ?? null,
        walletId: wallet?.id,
        currentStatus,
    });

    // Wrap approveQuotation with additional balance guard to keep identical behavior
    const approveQuotationWrapped = React.useCallback(async (): Promise<boolean> => {
        if (insufficientForApprove) {
            setError(t('profileChat.insufficientBalanceWarning') || 'Insufficient balance to approve the quotation.');
            return false;
        }
        return await approveQuotationFromHook();
    }, [insufficientForApprove, approveQuotationFromHook, setError, t]);

    // Wrap approveWork to trigger the review modal after approval
    const approveWorkWrapped = React.useCallback(async (): Promise<boolean> => {
        const success = await approveWork();
        if (success && isEmployer) {
            setShowSubmitReviewModal(true); // Show review modal after approving work
        }
        return success;
    }, [approveWork, isEmployer]);

    const submitReview = useCallback(async (form: SubmitUserReviewForm) => {
        try {
            const response = await submitReviewApi({
                revieweeId: form.revieweeId,
                workflowId: form.workflowId,
                rating: form.rating,
                proposal: form.proposal,
            });
            if (response.state === REQUEST_STATE.SUCCESS) {
                const messageId = uuidv4();
                await sendMessage({
                    message: JSON.stringify({type: 'review-submitted', rating: form.rating, comment: form.proposal}),
                    senderId: Number(localUser.id),
                    secure: Boolean((localUser as any)?.isMessageSecure),
                    id: messageId,
                });
                return true;
            } else {
                setError(t('profileChat.submitReviewError') || 'Failed to submit review. Please try again.');
                return false;
            }
        } catch (error) {
            setError(t('profileChat.submitReviewError') || 'Failed to submit review. Please try again.');
            return false;
        }
    }, [submitReviewApi, localUser.id, sendMessage, setError, t]);

    /**
     * Handle message submit from ChatInput.
     */
    const onSubmit = useCallback(
        async (data: MessageForm) => {
            if (isSubmittingRef.current) return;
            const message = data.message?.trim() || "";
            if (!message && !selectedFile) return;

            const contentToSend = selectedFile
                ? buildAttachmentEnvelope({
                    url: selectedFile.fileUrl,
                    name: selectedFile.fileName,
                    mime: selectedFile.fileType,
                    caption: message || undefined,
                    assetId: selectedFile.assetId,
                })
                : message;

            isSubmittingRef.current = true;
            const messageId = uuidv4();

            await sendMessage({
                message: contentToSend,
                senderId: Number(localUser.id),
                secure: Boolean((localUser as any)?.isMessageSecure),
                id: messageId,
                assetId: selectedFile?.assetId,
            });

            setSelectedFile(null);
            isSubmittingRef.current = false;
        },
        [sendMessage, selectedFile, localUser, setSelectedFile]
    );
    const flowActions: FlowActions = createFlowActions({
        t,
        goToStatus,
        setShowQuotationModal,
        roomId,
        localUser,
        setError,
        approveQuotation: approveQuotationWrapped,
        startWork: async () => await startWork(),
        getPostId: () => roomPostId,
        submitDelivery: async () => await submitDelivery(),
        hasSelectedFile: () => !!selectedFile,
        requestRevision: async () => await requestRevision(),
        approveWork: async () => await approveWorkWrapped(),
    });

    // ChatRoomMessages owns the actual Virtuoso scroller and asks for one
    // page when its top edge is reached. The pager coalesces duplicate calls.
    const handleOnTopReached = useCallback(() => {
        if (!hasMore || isFetching) return;
        void fetchHistory();
    }, [hasMore, isFetching, fetchHistory]);

    const renderFlowContent = () => (
        <>
            <FreelanceChatFlow
                currentStatus={currentStatus}
                onChangeStatus={handleChangeStatus}
                orientation="vertical"
                compact={false}
                className="space-y-4"
                started={hasStarted}
                onStart={startWorkflowAction}
                isEmployer={isEmployerKnown ? isEmployer : undefined}
                onProposeQuote={flowActions.onProposeQuote}
                onApproveQuotation={flowActions.onApproveQuotation}
                onStartWork={!isEmployer ? flowActions.onStartWork : undefined}
                onSubmitDelivery={!isEmployer ? flowActions.onSubmitDelivery : undefined}
                onRequestRevision={isEmployer ? flowActions.onRequestRevision : undefined}
                onReleasePayment={isEmployer ? flowActions.onReleasePayment : undefined}
                onCancel={() => {
                    void cancelJob();
                }}
                onFileUpload={(ev: any) => handleFileUpload(ev as any)}
                selectedFile={selectedFile}
                isDeletingFile={isDeletingFile}
                onFileRemove={handleRemoveSelectedFile}
                statusBeforeCancel={statusBeforeCancel}
                availableBalance={availableBalance}
                requiredAmount={latestQuoteAmount}
                canBeUsed={canBeUsed}
            />
        </>
    );

    // The Orders + Media panel. Built once per meaningful change rather than
    // inside the effect below, because it now has two consumers: the desktop
    // sidebar (via context) and the mobile Order pane, which renders it
    // inline. Same dependency list the effect carried before.
    const sidebarContent = useMemo(
        () => (
            <ChatSidebarTabs
                roomId={roomId}
                partnerName={partnerName || "User"}
                orders={
                    <JobFlowContent
                        renderFlowContent={renderFlowContent}
                        jobId={roomPostId}
                        lang={lang}
                    />
                }
            />
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            currentRoom,
            isEmployer,
            isEmployerKnown,
            hasStarted,
            selectedFile,
            isDeletingFile,
            statusBeforeCancel,
            availableBalance,
            latestQuoteAmount,
            currentStatus,
            roomId,
            partnerName,
            roomPostId,
            lang,
        ],
    );

    useLayoutEffect(() => {
        setContent(sidebarContent);
        return () => setContent(null);
    }, [sidebarContent, setContent]);

    return (
        <>
            <div className="relative flex-1 min-w-0 flex flex-col md:flex-row h-full">
                <div className="flex-1 min-w-0 flex flex-col h-full w-full">
                    {/* Header: partner presence and typing indicator */}
                    <ChatHeader
                        avatarUrl={partnerAvatar}
                        displayName={partnerName || "User"}
                        typingText={isPartnerTyping ? (t("profileChat.typing") || "กำลังพิมพ์...") : undefined}
                        partnerId={partnerId}
                        onToggleSearch={() => {
                            if (isSearchOpen) {
                                closeSearch();
                                return;
                            }
                            // Search renders inside the Chat pane, which is
                            // display:none on the Order tab -- opening it there
                            // would flip aria-expanded and show nothing.
                            // Searching is a request to look at the conversation.
                            setIsFlowOpen(false);
                            openSearch();
                        }}
                        isSearchOpen={isSearchOpen}
                    />

                    {/* Mobile only; desktop shows both panes side by side. */}
                    <ChatRoomTabs
                        activeTab={isFlowOpen ? "order" : "chat"}
                        onSelect={(tab) => setIsFlowOpen(tab === "order")}
                    />

                    <div
                        id="chat-room-panel-chat"
                        role="tabpanel"
                        aria-labelledby="chat-room-tab-chat"
                        className={`${isFlowOpen ? "hidden md:flex" : "flex"} min-h-0 flex-1 flex-col`}
                    >
                        <div className="relative flex min-h-0 flex-1 flex-col bg-slate-50">
                            {isSearchOpen && (
                                <ChatSearchPanel roomId={roomId} partnerName={partnerName || "User"} />
                            )}
                            <ChatRoomMessages
                                key={roomId}
                                messages={messages}
                                partnerAvatar={partnerAvatar || ProfileImage.avatar}
                                onTopReached={handleOnTopReached}
                                hasMore={hasMore}
                                isFetching={isFetching}
                                partnerId={partnerId}
                            />
                        </div>
                        {/* The bottom padding folds the notch/home-indicator inset
                            into the responsive padding rather than replacing it,
                            and the `,0px` fallback keeps it inert everywhere the
                            inset does not exist. Landed on main as the fix for
                            #125; kept verbatim here so the two do not drift. */}
                        <div ref={inputContainerRef} className="border-t px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:pt-3 sm:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] bg-white">
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
                                    {attachmentPreview && (
                                        <div
                                            className="mb-2 flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                                            {attachmentPreview.kind === "file" || thumbLoadFailed ? (
                                                <span aria-hidden className="shrink-0 text-lg text-blue-600">📎</span>
                                            ) : (
                                                <div
                                                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-black/5 ring-1 ring-black/5">
                                                    {attachmentPreview.kind === "image" ? (
                                                        <img
                                                            src={attachmentPreview.url}
                                                            alt={t("profileChat.attachmentPreviewAlt", {name: attachmentPreview.name}) || `Preview of ${attachmentPreview.name}`}
                                                            className="h-full w-full object-cover"
                                                            onError={() => setFailedPreviewUrl(attachmentPreview.url)}
                                                        />
                                                    ) : (
                                                        // No `controls`: this is a static pick-time preview, not a
                                                        // player, and it must never autoplay -- omitting `autoPlay`
                                                        // (rather than setting it false) is what guarantees that.
                                                        <video
                                                            src={attachmentPreview.url}
                                                            muted
                                                            playsInline
                                                            preload="metadata"
                                                            aria-label={t("profileChat.attachmentPreviewAlt", {name: attachmentPreview.name}) || `Preview of ${attachmentPreview.name}`}
                                                            className="h-full w-full object-cover"
                                                            onError={() => setFailedPreviewUrl(attachmentPreview.url)}
                                                        />
                                                    )}
                                                    {isUploading && (
                                                        uploadPercent != null ? (
                                                            <div
                                                                role="progressbar"
                                                                aria-label={t("profileChat.uploadingLabel") || "Uploading"}
                                                                aria-valuemin={0}
                                                                aria-valuemax={100}
                                                                aria-valuenow={uploadPercent}
                                                                aria-valuetext={t("profileChat.uploadingPercent", {percent: uploadPercent}) || `Uploading ${uploadPercent}%`}
                                                                className="absolute inset-0 flex items-center justify-center bg-black/50"
                                                            >
                                                                <span aria-hidden className="text-xs font-semibold text-white">
                                                                    {uploadPercent}%
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                role="status"
                                                                aria-live="polite"
                                                                aria-busy="true"
                                                                className="absolute inset-0 flex items-center justify-center bg-black/50"
                                                            >
                                                                <span
                                                                    aria-hidden
                                                                    className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
                                                                />
                                                                <span className="sr-only">
                                                                    {t("profileChat.uploadingLabel") || "Uploading"}
                                                                </span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}

                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-blue-900 truncate">
                                                    {attachmentPreview.name}
                                                </p>
                                                {isUploading && (attachmentPreview.kind === "file" || thumbLoadFailed) && (
                                                    uploadPercent != null ? (
                                                        <div
                                                            role="progressbar"
                                                            aria-label={t("profileChat.uploadingLabel") || "Uploading"}
                                                            aria-valuemin={0}
                                                            aria-valuemax={100}
                                                            aria-valuenow={uploadPercent}
                                                            aria-valuetext={t("profileChat.uploadingPercent", {percent: uploadPercent}) || `Uploading ${uploadPercent}%`}
                                                            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-blue-100"
                                                        >
                                                            <div
                                                                className="h-full rounded-full bg-blue-500 transition-[width]"
                                                                style={{width: `${uploadPercent}%`}}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div
                                                            role="status"
                                                            aria-live="polite"
                                                            aria-busy="true"
                                                            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-blue-100"
                                                        >
                                                            <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-400"/>
                                                            <span className="sr-only">
                                                                {t("profileChat.uploadingLabel") || "Uploading"}
                                                            </span>
                                                        </div>
                                                    )
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleRemoveSelectedFile}
                                                disabled={isDeletingFile}
                                                className={`ml-2 shrink-0 self-start p-1 rounded-full hover:bg-blue-100 transition-colors ${isDeletingFile ? 'text-gray-400 cursor-not-allowed' : 'text-red-500 hover:text-red-800'}`}
                                                aria-label={t("profileChat.removeAttachment") || "Remove attachment"}
                                            >
                                                <Trash2 className={`h-4 w-4 ${isDeletingFile ? 'animate-spin' : ''}`}/>
                                            </button>
                                        </div>
                                    )}
                                    <ChatInput
                                        onSubmit={onSubmit}
                                        disabledHint=""
                                        hasAttachment={!!selectedFile}
                                        isUploading={isUploading}
                                        onFileUpload={(ev: any) => handleFileUpload(ev as any)}
                                        onTyping={(v) => {
                                            try {
                                                sendTyping?.(v);
                                            } catch {
                                            }
                                        }}
                                        typingHint={isPartnerTyping ? (t("profileChat.typing") || "กำลังพิมพ์...") : undefined}
                                        sendLatestRead={sendLatestRead}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Order pane. `md:hidden` buys visual exclusivity only --
                        it is display:none, not an unmount. Whenever isFlowOpen
                        is true at >=768px this mounts a second live copy of
                        `sidebarContent` alongside the one JobFlowSidebar's
                        permanent aside already renders: two ChatSidebarTabs,
                        two ChatMediaPanel backfills, two FreelanceChatFlow
                        instances. Reachable by selecting Order below 768px and
                        then widening -- rotation, iPad split view, dragging a
                        desktop window narrow and back. This is not new: the
                        slide-over this replaced was also `{isOpen && ...}` with
                        `md:hidden` and behaved identically. */}
                    {isFlowOpen && (
                        <div
                            id="chat-room-panel-order"
                            role="tabpanel"
                            aria-labelledby="chat-room-tab-order"
                            className="flex min-h-0 flex-1 flex-col md:hidden"
                        >
                            {sidebarContent}
                        </div>
                    )}
                </div>
            </div>
            {/* Delivery review modal (employer review of delivered work) */}
            {showReviewDeliveryModal && (
                <ReviewDeliveryModal
                    showReviewDeliveryModal={showReviewDeliveryModal}
                    setShowReviewDeliveryModal={setShowReviewDeliveryModal}
                    goToStatus={goToStatus}
                    sendMessage={sendMessage}
                    requestRevisionAction={requestRevision}
                    localUser={localUser}
                />
            )}
            {/* Submit review modal (employer submits review after approving work) */}
            {showSubmitReviewModal && (
                <SubmitReviewModal
                    showReviewModal={showSubmitReviewModal}
                    setShowReviewModal={setShowSubmitReviewModal}
                    revieweeId={partnerPersonId}
                    workflowId={currentRoom.workflow?.id}
                    submitReview={submitReview}
                />
            )}
            {/* Quotation modal (propose/approve quotation for current job) */}
            <QuotationModal
                isOpen={showQuotationModal}
                onClose={() => setShowQuotationModal(false)}
                onSubmit={quotationSubmit}
                postId={roomPostId}
                proposalId={roomProposalId}
                partnerId={partnerId}
                projectName={post?.name || t("profileChat.noJobTitle")}
                amount={post?.budget}
            />
        </>
    );
};

export default ChatRoomView;

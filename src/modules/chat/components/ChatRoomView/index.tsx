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
import {useRoomsStore} from '@/modules/chat/store/roomsStore';
import FreelanceChatFlow, {FlowActions, StatusKey} from "@/modules/chat/components/FreelanceChatFlow";
import {createFlowActions} from "@/modules/chat/utils/flowActions";
import QuotationModal from "@/modules/chat/components/Modal/QuotationModal";
import {useWorkflowStepper} from "@/hooks/utils/useWorkflowMachine";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {apiToUiStatus, useStateMachineStore} from "@/modules/chat/store/stateMachineStore";
import {Trash2} from "lucide-react";
import {JobDetailModal} from "@/modules/chat/components/Modal/JobDetailModal";
import {ReviewDeliveryModal} from "@/modules/chat/components/Modal/ReviewDeliveryModal";
import {JobFlowContent} from "@/modules/chat/components/JobFlowContent";
import {useWorkflowStatus} from '@/modules/chat/hooks/useWorkflowStatus';
import {useFileUpload} from '@/modules/chat/hooks/useFileUpload';
import {useWorkflowActions} from '@/modules/chat/hooks/useWorkflowActions';
import {emitChatNewMessage} from "@/modules/chat/events";
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
    const [showJobDetailModal, setShowJobDetailModal] = useState<boolean>(false);
    const [hasStarted, setHasStarted] = useState<boolean>(false);
    // Flow sidebar is now managed globally via JobFlowSidebarProvider
    const {isOpen: isFlowOpen, setOpen: setIsFlowOpen, setContent} = useJobFlowSidebar();
    const [currentRoom, setCurrentRoom] = useState<ChatRoomView>(roomData as ChatRoomView);
    const {getByRoom} = useChatStore();
    const messages = getByRoom(roomId);
    const initialFetchRef = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [scrollParentEl, setScrollParentEl] = useState<HTMLElement | null>(null);
    const roomPostId = post?.id;
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
    useCallback((el: HTMLDivElement | null) => {
        scrollContainerRef.current = el;
        if (el) setScrollParentEl(el);
    }, []);

    const {
        selectedFile,
        setSelectedFile,
        isDeletingFile,
        handleFileUpload,
        handleRemoveSelectedFile
    } = useFileUpload({setError, t: (k: string) => t(k)});
    const upsertHistory = useChatStore(s => s.upsertHistory);
    const markRoomReadInStore = useRoomsStore(s => s.markRoomRead);

    // fetch the last read timestamp from the backend and store it into useReadLastIdStore
    useLoadLastRead(roomId, partnerId);

    // --- History management ---
    // Pulls paginated history for this room and writes pages into the global store via upsertHistory.
    // `receivedSet` prevents double-inserting messages when pages overlap.
    const {
        state: {hasMore, isFetching},
        actions: {fetchHistory},
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

    // Auto-collapse the workflow panel on narrow viewports to preserve space for the conversation.
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 640) {
                setIsFlowOpen(false);
            }
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

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
                comment: form.comment,
            });
            if (response.state === REQUEST_STATE.SUCCESS) {
                const tsIso = new Date().toISOString();
                const messageId = uuidv4();
                const content = t('profileChat.reviewSubmitted') || 'Review submitted successfully.';
                const detail = {
                    roomId,
                    id: messageId,
                    senderId: Number(localUser.id),
                    content,
                    createdAt: tsIso,
                    status: 'sending' as const,
                };
                emitChatNewMessage(detail);
                await sendMessage({
                    message: JSON.stringify({type: 'review-submitted', rating: form.rating, comment: form.comment}),
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
    }, [submitReviewApi, roomId, localUser.id, sendMessage, setError, t, emitChatNewMessage]);

    /**
     * Handle message submit from ChatInput.
     */
    const onSubmit = useCallback(
        async (data: MessageForm) => {
            if (isSubmittingRef.current) return;
            const message = data.message?.trim() || "";
            if (!message && !selectedFile) return;

            const contentToSend = selectedFile
                ? JSON.stringify({
                    type: "file",
                    url: selectedFile.fileUrl,
                    name: selectedFile.fileName,
                    mime: selectedFile.fileType,
                    caption: message || undefined,
                })
                : message;

            isSubmittingRef.current = true;
            const messageId = uuidv4();

            const preview = selectedFile
                ? (message || `[File] ${selectedFile.fileName}`)
                : message;

            emitChatNewMessage({
                roomId,
                id: messageId,
                senderId: Number(localUser.id),
                content: preview,
                createdAt: new Date().toISOString(),
                status: 'sending',
            });

            await sendMessage({
                message: contentToSend,
                senderId: Number(localUser.id),
                secure: Boolean((localUser as any)?.isMessageSecure),
                id: messageId
            });

            setSelectedFile(null);
            isSubmittingRef.current = false;
        },
        [sendMessage, roomId, selectedFile, localUser, emitChatNewMessage, setSelectedFile]
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

    // Load older history when user scrolls above halfway from the bottom.
    const handleOnTopReached = useCallback(() => {
        if (!hasMore || isFetching) return;
        const rootEl = scrollContainerRef.current ?? scrollParentEl;

        // Always fetch when ChatRoomMessages reports top reached; preserve position if we can
        if (!rootEl) {
            fetchHistory().catch(() => {
            });
            return;
        }

        const oldHeight = rootEl.scrollHeight;
        fetchHistory()
            .then(() => {
                // Use requestAnimationFrame to ensure DOM is updated
                requestAnimationFrame(() => {
                    const newHeight = rootEl.scrollHeight;
                    rootEl.scrollTop += newHeight - oldHeight; // preserve visual position
                });
            })
            .catch(() => {
            });
    }, [hasMore, isFetching, scrollParentEl, fetchHistory]);

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

    // Provide JobFlowContent to the global sidebar
    useLayoutEffect(() => {
        setContent(
            <JobFlowContent
                setIsFlowOpen={setIsFlowOpen}
                renderFlowContent={renderFlowContent}
                setShowJobDetailModal={setShowJobDetailModal}
                currentRoom={currentRoom}
            />
        );

        return () => setContent(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        currentRoom,
        setContent,
        setIsFlowOpen,
        setShowJobDetailModal,
        isEmployer,
        isEmployerKnown,
        hasStarted,
        selectedFile,
        isDeletingFile,
        statusBeforeCancel,
        availableBalance,
        latestQuoteAmount,
        currentStatus,
    ]);

    return (
        <>
            <div className="relative flex-1 min-w-0 flex flex-col md:flex-row h-full">
                <div className="flex-1 min-w-0 flex flex-col h-full w-full">
                    {/* Header: partner presence, typing indicator, and toggle for workflow side panel */}
                    <ChatHeader
                        avatarUrl={partnerAvatar}
                        displayName={partnerName || "User"}
                        typingText={isPartnerTyping ? (t("profileChat.typing") || "กำลังพิมพ์...") : undefined}
                        onToggleFlow={() => setIsFlowOpen(!isFlowOpen)}
                        isFlowOpen={isFlowOpen}
                        partnerId={partnerId}
                    />
                    <ChatRoomMessages
                        messages={messages}
                        partnerAvatar={partnerAvatar || ProfileImage.avatar}
                        customScrollParent={scrollParentEl}
                        onTopReached={handleOnTopReached}
                        hasMore={hasMore}
                        isFetching={isFetching}
                        partnerId={partnerId}
                    />
                    <div ref={inputContainerRef} className="border-t px-3 py-2 sm:px-4 sm:py-3 bg-white">
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
                                {selectedFile && (
                                    <div
                                        className="mb-2 flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span aria-hidden className="text-blue-600">📎</span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-blue-900 truncate">
                                                    {selectedFile.fileName}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRemoveSelectedFile}
                                            disabled={isDeletingFile}
                                            className={`ml-2 p-1 rounded-full hover:bg-blue-100 transition-colors ${isDeletingFile ? 'text-gray-400 cursor-not-allowed' : 'text-red-500 hover:text-red-800'}`}
                                            aria-label="Remove attached file"
                                        >
                                            <Trash2 className={`h-4 w-4 ${isDeletingFile ? 'animate-spin' : ''}`}/>
                                        </button>
                                    </div>
                                )}
                                <ChatInput
                                    onSubmit={onSubmit}
                                    disabledHint=""
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
            </div>
            {/* Delivery review modal (employer review of delivered work) */}
            {showReviewDeliveryModal && (
                <ReviewDeliveryModal
                    showReviewDeliveryModal={showReviewDeliveryModal}
                    setShowReviewDeliveryModal={setShowReviewDeliveryModal}
                    goToStatus={goToStatus}
                    sendMessage={sendMessage}
                    requestRevisionAction={requestRevision}
                    roomId={roomId}
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
            {/* Job detail modal (post/room metadata) */}
            {showJobDetailModal && (
                <JobDetailModal
                    showJobDetailModal={showJobDetailModal}
                    setShowJobDetailModal={setShowJobDetailModal}
                    post={post}
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
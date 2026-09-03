import {FlowActions, StatusKey} from '@/modules/chat/components/FreelanceChatFlow';
import {v4 as uuidv4} from 'uuid';
import type {LocalUser} from '@108-plaza/jh-client';
import {sendChatMessage} from "@/modules/chat/events";

export type CreateFlowActionsDeps = {
    t: (k: string) => string | undefined;
    goToStatus: (key: StatusKey) => void;
    setShowQuotationModal: (v: boolean) => void;
    roomId: string;
    localUser: LocalUser;
    setError: (msg: string) => void;
    approveQuotation?: () => Promise<boolean>;
    startWork?: () => Promise<boolean>;
    getPostId?: () => string | number | undefined;
    // New: delivery submission support
    submitDelivery?: () => Promise<boolean>;
    hasSelectedFile?: () => boolean;
    // New: employer request revision support
    requestRevision?: () => Promise<boolean>;
    // New: employer approve work & release payment
    approveWork?: () => Promise<boolean>;
};

export function createFlowActions(deps: CreateFlowActionsDeps): FlowActions {
    const {
        t,
        goToStatus,
        setShowQuotationModal,
        roomId,
        localUser,
    } = deps;

    return {
        onProposeQuote: () => {
            if (deps.getPostId && !deps.getPostId()) {
                deps.setError(
                    t('profileChat.missingPostIdForQuotation') ||
                    'This chat room is not linked to a post. You cannot create a quotation.'
                );
                return;
            }
            setShowQuotationModal(true);
        },
        onApproveQuotation: async () => {
            // If provided, call the API to approve quotation first
            if (deps.approveQuotation) {
                try {
                    const ok = await deps.approveQuotation();
                    if (!ok) return; // Abort if API failed
                } catch {
                    return;
                }
            }

            const messageId = uuidv4();
            const payload = {type: 'employer-assigned'} as any;

            await sendChatMessage({roomId} as any, {
                message: payload,
                senderId: localUser.id,
                secure: Boolean((localUser as any)?.isMessageSecure),
                id: messageId
            });

            goToStatus('OrderApproved');
        },
        onStartWork: async () => {
            if (!deps.startWork) return;
            try {
                const ok = await deps.startWork();
                if (!ok) return;
            } catch {
                return;
            }
            const messageId = uuidv4();
            const payload = {type: 'start-work'} as any;

            await sendChatMessage({roomId} as any, {
                message: payload,
                senderId: localUser.id,
                secure: Boolean((localUser as any)?.isMessageSecure),
                id: messageId
            });

            goToStatus('InProgress');
        },
        // onUploadAsset: () => {
        //     const input = document.createElement('input');
        //     input.type = 'file';
        //     input.onchange = (e) => handleFileUpload(e as any);
        //     input.click();
        // },
        // onSendMessage: () => {
        //     const input = (scrollContainerRef.current as any)?.querySelector('input');
        //     if (input) input.focus();
        // },
        onSubmitDelivery: deps.hasSelectedFile && deps.hasSelectedFile()
            ? async () => {
                if (deps.submitDelivery) {
                    try {
                        const ok = await deps.submitDelivery();
                        if (!ok) return;
                    } catch {
                        return;
                    }
                }
                // Move to review pending; employer will get review modal on their side
                goToStatus('PendingEmployerReview');
            }
            : undefined,
        onRequestRevision: async () => {
            if (deps.requestRevision) {
                try {
                    const ok = await deps.requestRevision();
                    if (!ok) return;
                } catch {
                    return;
                }
            } else {
                // fallback: just move status if no impl provided
                goToStatus('InProgress');
            }
        },
        onReleasePayment: async () => {
            if (deps.approveWork) {
                try {
                    const ok = await deps.approveWork();
                    if (!ok) return; // Abort if API failed
                } catch {
                    return;
                }
            }
            goToStatus('Completed');
        },
        onCancel: () => {
            goToStatus('Cancelled');
        },
    };
}

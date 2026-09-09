import type { BillingId } from "./BillingId";
import type { BillingStatus } from "./BillingStatus";
import type { ChatRoomId } from "./ChatRoomId";
import type { Coin } from "./Coin";
import type { EscrowState } from "./EscrowState";
import type { LocalUserId } from "./LocalUserId";
import type { PostId } from "./PostId";
import type { ProposalId } from "./ProposalId";
import type { WorkflowId } from "./WorkflowId";
import type { WorkflowStatus } from "./WorkflowStatus";

/**
 * One order inside a conversation.
 *
 * A 108Jobs room holds every order two people have run together, so a room no
 * longer has "a" workflow. Everything needed to draw a row is here, because the
 * alternative is a request per order.
 */
export type OrderSummary = {
    workflowId: WorkflowId,
    roomId: ChatRoomId,
    /** Server-assigned position in this conversation. Never sent by a client. */
    seqNumber: number,
    status: WorkflowStatus,
    /** What the order was before it was cancelled, so the UI can say what was lost. */
    statusBeforeCancel?: WorkflowStatus,
    postId: PostId,
    postName?: string,
    proposalId?: ProposalId,
    /** Per order, not per room: these two swap sides between orders. */
    employerId?: LocalUserId,
    freelancerId?: LocalUserId,
    billingId?: BillingId,
    amount?: Coin,
    billingStatus?: BillingStatus,
    escrow: EscrowState,
    createdAt: string,
    updatedAt?: string,
    completedAt?: string,
    cancelledAt?: string,
    /**
     * The order finished before the server recorded finish times, so the only
     * timestamp available is `updatedAt`. Show it as approximate rather than
     * implying a precision that was never captured.
     */
    finishedAtIsApproximate: boolean,
};

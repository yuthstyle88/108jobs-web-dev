import type { ChatRoomId } from "./ChatRoomId";
import type { PostId } from "./PostId";
import type { ProposalId } from "./ProposalId";

/**
 * Start an order in a conversation.
 *
 * No `seqNumber`: the server assigns the order's position inside the
 * transaction that creates it. This client used to send `1` every time, which
 * is why one room's orders read 1, 2, 3 and then 1 nine more times.
 *
 * `postId` is the job the order is for — draft context. It does not name the
 * conversation; the same two people keep one room across every job.
 */
export type StartWorkflowForm = {
    postId: PostId,
    roomId: ChatRoomId,
    proposalId?: ProposalId,
};

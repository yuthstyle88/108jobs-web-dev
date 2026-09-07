import type { StatusKey } from "@/modules/chat/components/FreelanceChatFlow";
import { workflowActionsMap } from "@/modules/chat/types/workflow";

/** Just enough of a room to decide what the workflow stepper should show. */
interface RoomWithWorkflow {
  workflow?: { status?: string | null; active?: boolean | null } | null;
}

/**
 * The status the workflow stepper should adopt for this room, or `null` to
 * leave the machine alone.
 *
 * The stepper is a client-only state machine: it starts at
 * `WaitForFreelancerQuotation` and is advanced by local clicks. Nothing ever
 * told it what the server thought, so reopening a room showed a finished job as
 * not started, and the Orders tab rendered no stage at all (#136).
 *
 * The answer was already in the room payload. `ChatRoomView.workflow` comes
 * from `Workflow::get_current_by_room_id`, and its `status` is the same union
 * as `StatusKey` — so there is no mapping to get wrong, only the question of
 * when adopting it is safe. It is not safe when:
 *
 *   * there is no workflow yet — a room opened before anyone quoted. Adopting
 *     `undefined` would overwrite the machine's own initial state with nothing.
 *   * the workflow is not active. `get_current_by_room_id` filters on
 *     `active = true`, so this should not arrive; adopting a retired workflow
 *     would silently resurrect a dead job, which is worse than ignoring a row
 *     that should not have been sent.
 *   * the status is one this client does not know. The server's enum can gain a
 *     variant first, and an unknown key puts the machine in a state with no
 *     step and no actions — a blank panel, which is the bug, not the fix.
 */
export function hydratableWorkflowStatus(
  room: RoomWithWorkflow | null | undefined,
): StatusKey | null {
  const workflow = room?.workflow;
  if (!workflow) return null;
  if (workflow.active === false) return null;

  const status = workflow.status;
  if (!status) return null;

  // `workflowActionsMap` is keyed by every status the stepper renders, so it is
  // the client's own list of what it understands — no second copy to drift.
  return Object.prototype.hasOwnProperty.call(workflowActionsMap, status)
    ? (status as StatusKey)
    : null;
}

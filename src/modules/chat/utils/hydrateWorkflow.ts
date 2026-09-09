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

/** Just enough of a selected order to decide what the stepper should show. */
interface SelectedOrderLike {
  status?: string | null;
  statusBeforeCancel?: string | null;
}

/**
 * The status the stepper should adopt for the SELECTED order, or `null` to
 * leave the machine alone.
 *
 * `hydratableWorkflowStatus` above reads the room's single workflow, and that
 * was the whole story while a room held one order. A conversation now holds
 * every order two people have run together, and the one on screen is whichever
 * the reader picked in the Orders tab -- which `room.workflow` knows nothing
 * about. Seen live: a Completed order highlighted in the list, and the panel
 * under it still offering "Send Quotation" and "Cancel job" for a different
 * order. The action ids already followed the selection; the displayed stage
 * did not, so the buttons described one order and would have acted on another.
 *
 * Same refusal as the room path for a status this client does not know: an
 * unknown key puts the machine in a state with no step and no actions.
 */
export function hydratableOrderStatus(
  order: SelectedOrderLike | null | undefined,
): StatusKey | null {
  const status = order?.status;
  if (!status) return null;
  return Object.prototype.hasOwnProperty.call(workflowActionsMap, status)
    ? (status as StatusKey)
    : null;
}

/**
 * What the stepper should show, given a selection and a room.
 *
 * The selection wins. `ChatRoomView` has an effect that keeps the machine
 * equal to "the room's workflow" -- it depends on `currentStatus`, so whenever
 * the store holds anything else it writes the room's value back. That was
 * correct while a room held one order and is exactly wrong now: a selection
 * wrote `Completed` and three `WaitForFreelancerQuotation` writes followed it
 * in the same tick. So the selection is not a second writer racing that
 * effect; it is the source the effect reads from.
 *
 * A selection whose status this client does not know falls through to the
 * room rather than blanking the panel.
 */
export function stepperStatusFor(
  selected: SelectedOrderLike | null | undefined,
  room: RoomWithWorkflow | null | undefined,
): { status: StatusKey; statusBeforeCancel: StatusKey | undefined } | null {
  const fromSelection = hydratableOrderStatus(selected);
  if (fromSelection) {
    return {
      status: fromSelection,
      statusBeforeCancel:
        hydratableOrderStatus({ status: selected?.statusBeforeCancel }) ?? undefined,
    };
  }
  const fromRoom = hydratableWorkflowStatus(room);
  if (!fromRoom) return null;
  const before = (room?.workflow as { statusBeforeCancel?: string | null } | null | undefined)
    ?.statusBeforeCancel;
  return {
    status: fromRoom,
    statusBeforeCancel: hydratableOrderStatus({ status: before }) ?? undefined,
  };
}

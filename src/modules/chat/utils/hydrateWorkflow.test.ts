import { describe, expect, it } from "vitest";
import { hydratableOrderStatus, hydratableWorkflowStatus, stepperStatusFor } from "./hydrateWorkflow";

// The workflow stepper is a client-only state machine that starts at
// `WaitForFreelancerQuotation` and is advanced by local clicks. Nothing ever
// told it what the server thinks, so reopening a room showed a finished job as
// not started (#136).
//
// The room payload has carried the answer all along: `ChatRoomView.workflow`
// comes from `Workflow::get_current_by_room_id`, and its `status` uses the very
// same union as the stepper's `StatusKey`. No mapping is needed -- only the
// decision of when it is safe to adopt.
describe("hydratableWorkflowStatus", () => {
  it("adopts the server's status for a live workflow", () => {
    expect(
      hydratableWorkflowStatus({
        workflow: { status: "PendingEmployerReview", active: true },
      }),
    ).toBe("PendingEmployerReview");
  });

  it("adopts a completed workflow, which is the case that was most wrong", () => {
    expect(
      hydratableWorkflowStatus({ workflow: { status: "Completed", active: true } }),
    ).toBe("Completed");
  });

  it("returns null when the room has no workflow yet", () => {
    // A room opened before anyone raised a quotation. Hydrating here would
    // overwrite the machine's own initial state with nothing.
    expect(hydratableWorkflowStatus({})).toBeNull();
    expect(hydratableWorkflowStatus(undefined)).toBeNull();
    expect(hydratableWorkflowStatus({ workflow: undefined })).toBeNull();
  });

  it("ignores a workflow the server has retired", () => {
    // `get_current_by_room_id` filters on `active = true`, so an inactive row
    // should never arrive -- but adopting a retired workflow's status would
    // silently resurrect a dead job, so refuse it rather than trust the filter.
    expect(
      hydratableWorkflowStatus({ workflow: { status: "InProgress", active: false } }),
    ).toBeNull();
  });

  it("ignores a status the stepper does not know", () => {
    // The server's enum can gain a variant before this client does. Adopting an
    // unknown key would put the machine in a state with no rendered step and no
    // actions -- a blank panel, which is the bug being fixed, not a fix.
    expect(
      hydratableWorkflowStatus({
        workflow: { status: "SomeFutureStatus", active: true },
      }),
    ).toBeNull();
  });
});

/**
 * The stepper has to follow the SELECTED order, not the room.
 *
 * Seen live: with a Completed order highlighted in the Orders tab, the panel
 * under it still showed "Send Quotation" / "Cancel job" -- the stage and the
 * actions of the room's single workflow, which was a different order. Action
 * targeting already followed the selection (the ids did); the displayed stage
 * did not, so the buttons described one order and would have acted on another.
 */
describe("hydratableOrderStatus", () => {
    const order = (status: string) => ({ status, statusBeforeCancel: undefined }) as never;

    it("adopts the selected order's status", () => {
        expect(hydratableOrderStatus(order("Completed"))).toBe("Completed");
        expect(hydratableOrderStatus(order("InProgress"))).toBe("InProgress");
    });

    it("has nothing to adopt when no order is selected", () => {
        expect(hydratableOrderStatus(null)).toBeNull();
        expect(hydratableOrderStatus(undefined)).toBeNull();
    });

    it("refuses a status this client does not know, the way the room path does", () => {
        // A newer server can add a variant first. An unknown key puts the
        // machine in a state with no step and no actions -- a blank panel.
        expect(hydratableOrderStatus(order("SomethingNew"))).toBeNull();
    });
});

/**
 * Which status the stepper adopts when both a room and a selection exist.
 *
 * `ChatRoomView` has an effect that keeps the machine equal to the room's
 * single workflow: it depends on `currentStatus`, so the moment the store holds
 * anything else it writes the room's value back. Seen live: a selection wrote
 * `Completed`, and three `WaitForFreelancerQuotation` writes followed it in the
 * same tick. The selection must be the source that effect reads from, not a
 * second writer racing it.
 */
describe("stepperStatusFor", () => {
    const room = { workflow: { status: "WaitForFreelancerQuotation", active: true } } as never;

    it("takes the selected order's status over the room's", () => {
        expect(
            stepperStatusFor({ status: "Completed" } as never, room),
        ).toEqual({ status: "Completed", statusBeforeCancel: undefined });
    });

    it("carries the selected order's statusBeforeCancel", () => {
        expect(
            stepperStatusFor(
                { status: "Cancelled", statusBeforeCancel: "InProgress" } as never,
                room,
            ),
        ).toEqual({ status: "Cancelled", statusBeforeCancel: "InProgress" });
    });

    it("falls back to the room when nothing is selected", () => {
        expect(stepperStatusFor(null, room)).toEqual({
            status: "WaitForFreelancerQuotation",
            statusBeforeCancel: undefined,
        });
    });

    it("falls back to the room when the selection's status is unknown", () => {
        expect(stepperStatusFor({ status: "SomethingNew" } as never, room)?.status).toBe(
            "WaitForFreelancerQuotation",
        );
    });

    it("has nothing when there is neither", () => {
        expect(stepperStatusFor(null, null)).toBeNull();
    });
});

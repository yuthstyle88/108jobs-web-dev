import { describe, expect, it } from "vitest";
import { hydratableWorkflowStatus } from "./hydrateWorkflow";

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

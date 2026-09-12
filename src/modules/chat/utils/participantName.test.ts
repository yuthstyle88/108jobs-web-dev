import { describe, expect, it } from "vitest";
import { participantDisplayName } from "./participantName";

// Every account provisioned through Identity-Platform gets a generated actor
// name (`user_<8 hex>`), so `name` is unreadable for essentially every person
// who signs in by phone — which is everyone. `displayName` is what the job
// board, the proposal list and the iOS app all show, and it rides in the same
// payload.
//
// This started as two separate bugs: the chat header (#138) and then the chat
// room list (#144), which was missed when the header was fixed. Both call this
// now, so there is one rule rather than a convention each component has to
// remember.
describe("participantDisplayName", () => {
  it("prefers the display name", () => {
    expect(
      participantDisplayName({
        name: "user_7c566e59",
        displayName: "Regression Worker",
      }),
    ).toBe("Regression Worker");
  });

  it("falls back to the actor name when there is no display name", () => {
    expect(participantDisplayName({ name: "somebody" })).toBe("somebody");
    expect(
      participantDisplayName({ name: "somebody", displayName: undefined }),
    ).toBe("somebody");
  });

  it("treats a blank display name as absent", () => {
    // A saved-then-cleared profile field arrives as "" or whitespace, and
    // rendering that gives a nameless row rather than falling back.
    expect(
      participantDisplayName({ name: "user_abc", displayName: "   " }),
    ).toBe("user_abc");
  });

  it("has a last resort when the participant has neither", () => {
    expect(participantDisplayName({})).toBe("Unknown");
    expect(participantDisplayName(undefined)).toBe("Unknown");
    expect(participantDisplayName(null)).toBe("Unknown");
  });
});

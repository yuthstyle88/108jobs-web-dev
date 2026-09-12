import {describe, expect, it} from "vitest";

import {employerOnOrder, selectionFromOrder} from "./employerRole";

/**
 * Which side of the order this person is on.
 *
 * `ChatRoomView` answered this once for the whole conversation, by comparing
 * the **room's** post creator with the viewer. One room now holds every order
 * two people have run together and the same two swap sides between orders, so
 * that answer belongs to whichever job the room last saw. Seen live on
 * `dm:8058:8059` signed in as 8058: order #10, which 8058 employed 8059 for,
 * reported "You are the freelancer" -- and since every employer-only control
 * is gated on this flag, the employer of a finished order could not act on it
 * at all (#151).
 *
 * The order carries the answer: the server sends `employerId` and
 * `freelancerId` per order.
 */
describe("who the employer is", () => {
    it("is the person the selected order names", () => {
        expect(employerOnOrder({employerId: 8058}, 8058, false)).toBe(true);
    });

    it("is not the other party on that order", () => {
        expect(employerOnOrder({employerId: 8058}, 8059, true)).toBe(false);
    });

    it("compares ids that arrive as different types", () => {
        // `LocalUserId` is a branded number in the client types, but the room
        // payload has handed this component strings -- which is why the code
        // this replaces compared `String(a) === String(b)`. A mixed pair is
        // the pair that matters: `8058 === "8058"` is false, and answering
        // "you are the freelancer" to the employer is the whole of #151.
        expect(employerOnOrder({employerId: "8058" as never}, 8058, false)).toBe(true);
        expect(employerOnOrder({employerId: 8058}, "8058" as never, false)).toBe(true);
        expect(employerOnOrder({employerId: "8058" as never}, 8059, true)).toBe(false);
    });

    it("falls back to the room when the order predates the columns", () => {
        // Orders created before `employer_id` existed report none. The room's
        // post creator is the only answer left, and it was the old behaviour.
        expect(employerOnOrder({employerId: null}, 8058, true)).toBe(true);
        expect(employerOnOrder({}, 8058, false)).toBe(false);
    });

    it("falls back to the room when nothing is selected", () => {
        expect(employerOnOrder(null, 8058, true)).toBe(true);
        expect(employerOnOrder(undefined, 8058, undefined)).toBeUndefined();
    });

    it("stays unknown when the order names an employer but we are nobody yet", () => {
        // The local user has not loaded. Answering `false` here would render
        // the freelancer's controls to an employer for one paint; unknown
        // renders neither, which is what `isEmployerKnown` is for.
        expect(employerOnOrder({employerId: 8058}, null, undefined)).toBeUndefined();
    });
});

/**
 * What the panel keeps about the order it is showing.
 *
 * The role rule above can only answer when the selection carries the parties,
 * and this shape is where that is decided -- it is built in two places (the
 * default selection on open, and a click in the list) and both must carry
 * them, or the room-level fallback silently takes over again.
 */
describe("the selection the panel keeps", () => {
    it("carries the parties, not just the ids to act with", () => {
        const selection = selectionFromOrder({
            workflowId: 19 as never,
            billingId: 24 as never,
            status: "Completed" as never,
            statusBeforeCancel: undefined,
            employerId: 8058 as never,
            freelancerId: 8059 as never,
            seqNumber: 13 as never,
            postName: "VIDEO 0908 — record all core flows" as never,
        } as never);

        expect(selection).toEqual({
            workflowId: 19,
            billingId: 24,
            status: "Completed",
            statusBeforeCancel: null,
            employerId: 8058,
            // The selector line names the order the panel is showing, and it
            // has only this selection to name it from (#156).
            seqNumber: 13,
            postName: "VIDEO 0908 — record all core flows",
        });
    });

    it("keeps an old order's missing ids as null rather than undefined", () => {
        // `billingId` absent is "no billing", and the panel's own guards test
        // for null. An order that predates `employer_id` reports none, which
        // is what sends the role back to the room's post.
        expect(selectionFromOrder({workflowId: 3 as never, status: "Cancelled" as never} as never))
            .toEqual({
                workflowId: 3,
                billingId: null,
                status: "Cancelled",
                statusBeforeCancel: null,
                employerId: null,
                seqNumber: 0,
                postName: null,
            });
    });
});

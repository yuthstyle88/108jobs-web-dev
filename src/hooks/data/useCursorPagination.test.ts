// Resetting a pager that is already on page one must not change anything.
//
// `resetPagination` used to call `setCursorHistory([])` unconditionally. By
// value that is correct; by identity it is a new array every time, and
// identity is what React compares. So an already-reset pager re-rendered on
// every reset.
//
// That is a wasted render until a caller puts the reset in an effect keyed on
// `resetPagination`'s identity -- which the job board does. Function identity
// is stable in steady state and is not stable across a Fast Refresh or a
// remount, so each re-run produced a guaranteed render, which produced another
// re-run, until React gave up with "Maximum update depth exceeded".
//
// The identity assertions below are therefore the point of this file; a
// `toEqual([])` would pass against the version that loops.

import {describe, expect, it} from "vitest";
import {resetCursorHistory} from "./useCursorPagination";

describe("resetCursorHistory", () => {
    it("returns the very same array when already empty", () => {
        const empty: string[] = [];

        expect(resetCursorHistory(empty)).toBe(empty);
    });

    it("clears a non-empty history", () => {
        const history = ["cursor-1", "cursor-2"];
        const next = resetCursorHistory(history);

        expect(next).toEqual([]);
        expect(next).not.toBe(history);
    });

    it("does not mutate the history it was given", () => {
        const history = ["cursor-1"];
        resetCursorHistory(history);

        expect(history).toEqual(["cursor-1"]);
    });
});

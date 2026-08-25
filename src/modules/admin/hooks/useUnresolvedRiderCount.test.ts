/**
 * The bigint boundary, and nothing else.
 *
 * `useHttpGet` (the network edge) is mocked, exactly as
 * `usePaginatedRiders.test.ts` and `RiderReviewModal/index.test.ts` do.
 */
import {describe, expect, it, vi} from "vitest";

vi.mock("@/hooks/api/http/useHttpGet", () => ({useHttpGet: vi.fn()}));

import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {useUnresolvedRiderCount} from "@/modules/admin/hooks/useUnresolvedRiderCount";

const mockUseHttpGet = useHttpGet as unknown as ReturnType<typeof vi.fn>;

/** Runs the hook body. It calls no React hook except `useMemo`, which is pure here. */
function useHookHarness() {
    return useUnresolvedRiderCount();
}

vi.mock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();
    return {...actual, useMemo: (fn: () => unknown) => fn()};
});

describe("useUnresolvedRiderCount", () => {
    it("converts the bigint the client declares into a real number", () => {
        // ts-rs maps Rust `i64` to TS `bigint`, so `NotificationCountResponse`
        // is typed `{count: bigint}` -- but `JSON.parse` never produces a real
        // bigint, so at runtime this is already a number. The conversion has to
        // survive both, because a bigint reaching i18next's `count` renders
        // nothing at all and a `bigint > number` comparison throws.
        mockUseHttpGet.mockReturnValue({data: {count: 7n}, isLoading: false});
        const {count} = useHookHarness();
        expect(count).toBe(7);
        expect(typeof count).toBe("number");
    });

    it("passes a plain number through unchanged — the real runtime shape", () => {
        mockUseHttpGet.mockReturnValue({data: {count: 3}, isLoading: false});
        expect(useHookHarness().count).toBe(3);
    });

    it("is null before the first response, not zero", () => {
        // Zero is a real answer meaning "the queue is empty" and hides the
        // badge. Guessing it while loading would flash an empty queue at an
        // admin whose queue is not empty.
        mockUseHttpGet.mockReturnValue({data: undefined, isLoading: true});
        expect(useHookHarness().count).toBeNull();
    });

    it("is null when the payload has no count at all", () => {
        mockUseHttpGet.mockReturnValue({data: {}, isLoading: false});
        expect(useHookHarness().count).toBeNull();
    });

    it("zero stays zero rather than becoming null", () => {
        mockUseHttpGet.mockReturnValue({data: {count: 0}, isLoading: false});
        expect(useHookHarness().count).toBe(0);
    });
});

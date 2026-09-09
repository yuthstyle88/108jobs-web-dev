// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {useOrders} from "@/modules/chat/hooks/useOrders";
import type {OrderSummary} from "@/lib/108jobs-client/src";

/**
 * What `useOrders` hands back must be referentially stable across renders
 * that carry the same data.
 *
 * This is not a performance nicety. `ChatRoomView` builds the sidebar's
 * React node from `groups`, and a pre-existing `useLayoutEffect` pushes that
 * node into `JobFlowSidebarContext` with a plain `useState` setter whenever
 * it changes. A new `groups` object on every render therefore means a new
 * node on every render, a `setContent` on every commit, a provider
 * re-render, a view re-render -- and React's "Maximum update depth exceeded".
 * That is exactly what the chat page did the first time it was opened
 * against the real API: an error boundary instead of a conversation.
 *
 * The cause was upstream. `useHttpGet` creates `execute` as a fresh closure
 * on every render (`const execute = () => swr.mutate()`), and this hook had
 * put it in the memo's dependency list. The mock below reproduces exactly
 * that shape: stable data, unstable `execute`.
 */
const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
};

const order = (over: Partial<OrderSummary>): OrderSummary =>
    ({
        workflowId: 1,
        roomId: "dm:8058:8059",
        seqNumber: 1,
        status: "Completed",
        postId: 1305940,
        escrow: "none",
        createdAt: "2026-09-08T00:00:00Z",
        finishedAtIsApproximate: false,
        ...over,
    }) as unknown as OrderSummary;

// One payload object, held for the whole test, the way SWR holds cached data.
const payload = {
    orders: [
        order({workflowId: 17, seqNumber: 11, status: "Cancelled"}),
        order({workflowId: 16, seqNumber: 10, status: "InProgress"}),
    ],
    total: 2,
    limit: 20,
    offset: 0,
};
const successState = {state: "success", data: payload};

vi.mock("@/hooks/api/http/useHttpGet", () => ({
    useHttpGet: () => ({
        state: successState,
        data: payload,
        error: undefined,
        isLoading: false,
        // Fresh on every call -- this is what the real hook does.
        execute: () => Promise.resolve(),
        isMutating: false,
        pagination: null,
    }),
}));

vi.mock("@/services/HttpService", () => ({
    REQUEST_STATE: {SUCCESS: "success", FAILED: "failed"},
}));

let container: HTMLDivElement;
let root: Root;
const seen: Array<ReturnType<typeof useOrders>> = [];

function Probe({tick}: {tick: number}) {
    // `tick` exists only to force a re-render with identical data.
    void tick;
    seen.push(useOrders("dm:8058:8059"));
    return null;
}

beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    seen.length = 0;
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
});

describe("useOrders across re-renders with the same data", () => {
    it("hands back the same groups object", () => {
        act(() => root.render(createElement(Probe, {tick: 1})));
        act(() => root.render(createElement(Probe, {tick: 2})));

        expect(seen).toHaveLength(2);
        expect(seen[1].groups).toBe(seen[0].groups);
    });

    it("hands back the same fallback selection", () => {
        act(() => root.render(createElement(Probe, {tick: 1})));
        act(() => root.render(createElement(Probe, {tick: 2})));

        expect(seen[1].fallbackSelection).toBe(seen[0].fallbackSelection);
    });

    it("still reads the data correctly", () => {
        act(() => root.render(createElement(Probe, {tick: 1})));

        const {groups, fallbackSelection} = seen[0];
        expect(groups.active.map(o => o.workflowId)).toEqual([16]);
        expect(groups.cancelled.map(o => o.workflowId)).toEqual([17]);
        expect(fallbackSelection?.workflowId).toBe(16);
    });
});

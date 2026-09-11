// @vitest-environment jsdom

import {act, createElement, useEffect} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {OrderSummary} from "@/lib/108jobs-client/src";

/**
 * Paging the order history.
 *
 * `GET /account/services/orders/by-room` takes `limit` (default 20, max 100)
 * and `offset`, and answers with `{orders, total, limit, offset}`. This hook
 * sent neither and ignored `total`, so a conversation with 21 orders showed the
 * newest 20 and said nothing about the rest -- the history the Orders pane
 * exists to show, quietly truncated (#156).
 */
const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

const order = (seq: number): OrderSummary =>
    ({
        workflowId: seq,
        roomId: "dm:8058:8059",
        seqNumber: seq,
        status: "Completed",
        postId: 1305940,
        escrow: "none",
        createdAt: "2026-09-08T00:00:00Z",
        finishedAtIsApproximate: false,
    }) as unknown as OrderSummary;

const TOTAL = 23;
const firstPage = {
    orders: Array.from({length: 20}, (_, i) => order(TOTAL - i)),
    total: TOTAL,
    limit: 20,
    offset: 0,
};

vi.mock("@/hooks/api/http/useHttpGet", () => ({
    useHttpGet: () => ({
        state: {state: "success", data: firstPage},
        data: firstPage,
        error: undefined,
        isLoading: false,
        execute: () => Promise.resolve(),
        isMutating: false,
        pagination: null,
    }),
}));

const calls: Array<Record<string, unknown>> = [];
vi.mock("@/services/HttpService", () => ({
    REQUEST_STATE: {SUCCESS: "success", FAILED: "failed"},
    callHttp: (_method: string, args: Record<string, unknown>) => {
        calls.push(args);
        const offset = Number(args.offset ?? 0);
        const limit = Number(args.limit ?? 20);
        const all = Array.from({length: TOTAL}, (_, i) => order(TOTAL - i));
        return Promise.resolve({
            state: "success",
            data: {orders: all.slice(offset, offset + limit), total: TOTAL, limit, offset},
        });
    },
}));

const {useOrders} = await import("@/modules/chat/hooks/useOrders");

let container: HTMLDivElement;
let root: Root;
let seen: ReturnType<typeof useOrders> | null = null;

function Probe() {
    const value = useOrders("dm:8058:8059");
    useEffect(() => {
        seen = value;
    });
    return null;
}

beforeEach(() => {
    calls.length = 0;
    seen = null;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(createElement(Probe)));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
});

describe("the order history", () => {
    it("reports the server's total, not what is loaded", () => {
        expect(seen!.orders).toHaveLength(20);
        expect(seen!.total).toBe(23);
    });

    it("knows there is more to fetch", () => {
        expect(seen!.hasMore).toBe(true);
    });

    it("appends the next page rather than replacing", async () => {
        await act(async () => {
            await seen!.loadMore();
        });

        expect(calls.at(-1)).toMatchObject({offset: 20, limit: 20});
        expect(seen!.orders).toHaveLength(23);
        expect(seen!.orders.map(o => o.seqNumber)).toEqual(
            Array.from({length: 23}, (_, i) => 23 - i),
        );
        expect(seen!.hasMore).toBe(false);
    });

    it("does not fetch past the end", async () => {
        await act(async () => {
            await seen!.loadMore();
        });
        const after = calls.length;
        await act(async () => {
            await seen!.loadMore();
        });
        expect(calls).toHaveLength(after);
    });
});

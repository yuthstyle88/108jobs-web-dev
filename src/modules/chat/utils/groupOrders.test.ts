import {describe, expect, it} from "vitest";
import {
    canInferPostForRehire,
    defaultSelectedOrder,
    groupOrders,
    isActiveOrder,
    preselectPostForRehire,
} from "./groupOrders";
import type {OrderSummary} from "@108-plaza/jh-client";

/**
 * Shaped like the API's `OrderSummary`, trimmed to what these functions read.
 * The server returns newest first, so fixtures are written that way.
 */
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

describe("grouping a conversation's orders", () => {
    it("keeps completed and cancelled orders, which is the whole of #136", () => {
        // The exact shape of the reported room: eleven orders, the newest of
        // them cancelled, and the tab showed nothing at all.
        const orders = [
            order({workflowId: 17, seqNumber: 11, status: "Cancelled"}),
            order({workflowId: 16, seqNumber: 10, status: "Completed"}),
            order({workflowId: 15, seqNumber: 9, status: "Completed"}),
        ];

        const groups = groupOrders(orders);

        expect(groups.completed).toHaveLength(2);
        expect(groups.cancelled).toHaveLength(1);
        expect(groups.active).toHaveLength(0);
        expect(
            groups.completed.length + groups.cancelled.length + groups.active.length,
        ).toBe(orders.length);
    });

    it("allows more than one active order, because a pair can run two jobs", () => {
        const groups = groupOrders([
            order({workflowId: 2, status: "InProgress", postId: 1}),
            order({workflowId: 3, status: "QuotationPendingReview", postId: 2}),
        ]);
        expect(groups.active).toHaveLength(2);
    });

    it("does not reorder within a group", () => {
        const groups = groupOrders([
            order({workflowId: 9, seqNumber: 3}),
            order({workflowId: 8, seqNumber: 2}),
            order({workflowId: 7, seqNumber: 1}),
        ]);
        expect(groups.completed.map(o => o.seqNumber)).toEqual([3, 2, 1]);
    });

    it("treats every non-terminal status as active", () => {
        for (const status of [
            "WaitForFreelancerQuotation",
            "QuotationPendingReview",
            "OrderApproved",
            "InProgress",
            "PendingEmployerReview",
        ]) {
            expect(isActiveOrder(order({status} as Partial<OrderSummary>))).toBe(true);
        }
        expect(isActiveOrder(order({status: "Completed"}))).toBe(false);
        expect(isActiveOrder(order({status: "Cancelled"}))).toBe(false);
    });
});

describe("which order a room opens on", () => {
    it("picks the newest running deal", () => {
        const running = order({workflowId: 5, status: "InProgress"});
        expect(
            defaultSelectedOrder([order({workflowId: 6}), running])?.workflowId,
        ).toBe(5);
    });

    it("still picks something when every order has finished", () => {
        // Selecting nothing here is what made a finished conversation render as
        // an empty panel.
        const newest = order({workflowId: 6, seqNumber: 2});
        expect(
            defaultSelectedOrder([newest, order({workflowId: 5, seqNumber: 1})])
                ?.workflowId,
        ).toBe(6);
    });

    it("has nothing to select in a conversation with no orders", () => {
        expect(defaultSelectedOrder([])).toBeNull();
    });
});

describe("whether Hire Again may choose the job itself", () => {
    it("can, when the conversation has only ever been about one job", () => {
        expect(
            canInferPostForRehire([
                order({postId: 42, workflowId: 1}),
                order({postId: 42, workflowId: 2}),
            ]),
        ).toBe(42);
    });

    it("must ask when the conversation covers several jobs", () => {
        // Guessing here starts a real order and holds real coins against a job
        // the employer did not choose.
        expect(
            canInferPostForRehire([
                order({postId: 42, workflowId: 1}),
                order({postId: 43, workflowId: 2}),
            ]),
        ).toBeNull();
    });

    it("must ask when there is no history to infer from", () => {
        expect(canInferPostForRehire([])).toBeNull();
    });
});

/**
 * What "Hire again" offers as its default -- never what it starts with.
 *
 * The draft context is the post this chat was opened from; the spec makes it
 * "draft context for creating a new order", so it is the first choice to offer.
 * Failing that, a conversation about exactly one job may offer that job.
 * Failing that, nothing is offered and the employer must pick. Whatever is
 * offered, nothing starts until it is confirmed: "Hire Now?" used to start a
 * real order, holding real coins, against the room's last recorded post.
 */
describe("what Hire again pre-selects", () => {
    it("offers the draft context first", () => {
        expect(
            preselectPostForRehire(77, [order({postId: 42}), order({postId: 43})]),
        ).toBe(77);
    });

    it("falls back to the conversation's only job", () => {
        expect(preselectPostForRehire(null, [order({postId: 42})])).toBe(42);
    });

    it("offers nothing when the history covers several jobs", () => {
        expect(
            preselectPostForRehire(undefined, [order({postId: 42}), order({postId: 43})]),
        ).toBeNull();
    });

    it("offers nothing when there is no history at all", () => {
        expect(preselectPostForRehire(null, [])).toBeNull();
    });
});

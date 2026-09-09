// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {OrdersList} from "@/modules/chat/components/OrdersList";
import {groupOrders} from "@/modules/chat/utils/groupOrders";
import type {OrderSummary} from "@/lib/108jobs-client/src";

const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
};

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        // Echo the key (plus the interpolated number) so assertions do not
        // depend on copy that three catalogues have to agree on.
        t: (k: string, opts?: {n?: number}) => (opts?.n != null ? `${k}:${opts.n}` : k),
    }),
}));

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

let container: HTMLDivElement;
let root: Root;

function renderList(props: {
    orders: OrderSummary[];
    selectedWorkflowId?: number | null;
    onSelect?: (o: OrderSummary) => void;
}) {
    act(() => {
        root.render(
            createElement(OrdersList, {
                groups: groupOrders(props.orders),
                selectedWorkflowId: props.selectedWorkflowId ?? null,
                onSelect: props.onSelect ?? vi.fn(),
            }),
        );
    });
}

const buttons = () => Array.from(container.querySelectorAll("button"));

beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
});

describe("the Orders tab", () => {
    /**
     * The regression for #136, at the level somebody sees it. The reported room
     * held eleven orders and the tab rendered none of them, because the panel
     * could only ever show the room's single "current" workflow -- which in
     * that room was a cancelled one.
     */
    it("shows finished orders, not just the running one", () => {
        renderList({
            orders: [
                order({workflowId: 17, seqNumber: 11, status: "Cancelled"}),
                order({workflowId: 16, seqNumber: 10, status: "Completed"}),
                order({workflowId: 4, seqNumber: 1, status: "Completed"}),
            ],
        });

        expect(buttons()).toHaveLength(3);
        expect(container.textContent).toContain("profileChat.ordersCompleted");
        expect(container.textContent).toContain("profileChat.ordersCancelled");
    });

    it("shows two active orders at once", () => {
        renderList({
            orders: [
                order({workflowId: 2, seqNumber: 2, status: "InProgress", postId: 1}),
                order({workflowId: 3, seqNumber: 3, status: "OrderApproved", postId: 2}),
            ],
        });
        expect(container.textContent).toContain("profileChat.ordersActive");
        expect(buttons()).toHaveLength(2);
    });

    /** Actions must target the order the user picked, not "the room's". */
    it("reports which order was selected", () => {
        const onSelect = vi.fn();
        renderList({
            orders: [
                order({workflowId: 16, seqNumber: 10, status: "Completed"}),
                order({workflowId: 17, seqNumber: 11, status: "InProgress"}),
            ],
            selectedWorkflowId: 17,
            onSelect,
        });

        const finished = buttons().find(
            b => b.getAttribute("data-workflow-id") === "16",
        );
        act(() => {
            finished?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        });

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect.mock.calls[0][0].workflowId).toBe(16);
    });

    it("marks exactly one order as current for assistive tech", () => {
        renderList({
            orders: [
                order({workflowId: 17, seqNumber: 11, status: "InProgress"}),
                order({workflowId: 16, seqNumber: 10}),
            ],
            selectedWorkflowId: 17,
        });
        const current = buttons().filter(
            b => b.getAttribute("aria-current") === "true",
        );
        expect(current).toHaveLength(1);
        expect(current[0].getAttribute("data-workflow-id")).toBe("17");
    });

    it("says so when a conversation has no orders yet", () => {
        renderList({orders: []});
        expect(container.textContent).toContain("profileChat.ordersEmpty");
    });

    it("flags a finish time the server never recorded", () => {
        renderList({
            orders: [
                order({
                    workflowId: 4,
                    status: "Completed",
                    finishedAtIsApproximate: true,
                }),
            ],
        });
        expect(container.textContent).toContain("profileChat.ordersFinishedApprox");
    });
});

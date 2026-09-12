// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {OrderHistoryModal} from "@/modules/chat/components/OrderHistoryModal";
import type {OrderGroups} from "@/modules/chat/utils/groupOrders";
import type {OrderSummary} from "@108-plaza/jh-client";

/**
 * The order history, opened from the selector line.
 *
 * Everything the pair has run together, grouped as before, with the newest page
 * loaded and the rest fetched as the reader scrolls. Picking one closes the
 * modal and the panel behind it follows (#156).
 */
const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (k: string, o?: Record<string, unknown>) =>
            o && "shown" in o ? `Showing ${o.shown} of ${o.total}` : k,
    }),
}));

const order = (seq: number, status = "Completed"): OrderSummary =>
    ({
        workflowId: seq,
        roomId: "dm:8058:8059",
        seqNumber: seq,
        status,
        postId: 1305940,
        postName: "VIDEO 0908 — record all core flows",
        escrow: "none",
        createdAt: "2026-09-08T00:00:00Z",
        finishedAtIsApproximate: false,
    }) as unknown as OrderSummary;

const groups: OrderGroups = {
    active: [order(17, "InProgress")],
    completed: [order(16), order(15)],
    cancelled: [],
};

let container: HTMLDivElement;
let root: Root;

function render(props: Partial<Parameters<typeof OrderHistoryModal>[0]> = {}) {
    act(() => {
        root.render(
            createElement(OrderHistoryModal, {
                isOpen: true,
                onClose: vi.fn(),
                groups,
                selectedWorkflowId: 17,
                onSelect: vi.fn(),
                loaded: 3,
                total: 3,
                hasMore: false,
                onLoadMore: vi.fn(),
                isLoading: false,
                ...props,
            }),
        );
    });
}

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

describe("the order history modal", () => {
    it("lists the history it has", () => {
        render();
        expect(container.textContent).toContain("#17");
        expect(container.textContent).toContain("#16");
    });

    it("says how much of the history is on screen", () => {
        render({loaded: 20, total: 23, hasMore: true});
        expect(container.textContent).toContain("Showing 20 of 23");
    });

    it("picking an order reports it and closes", () => {
        const onSelect = vi.fn();
        const onClose = vi.fn();
        render({onSelect, onClose});

        const row = Array.from(container.querySelectorAll("button")).find(b =>
            b.textContent?.includes("#16"),
        )!;
        act(() => {
            row.click();
        });

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect.mock.calls[0][0]).toMatchObject({seqNumber: 16});
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("offers the rest only while there is more", () => {
        const onLoadMore = vi.fn();
        render({loaded: 20, total: 23, hasMore: true, onLoadMore});
        const more = container.querySelector<HTMLButtonElement>('[data-testid="orders-load-more"]')!;
        expect(more).not.toBeNull();
        act(() => {
            more.click();
        });
        expect(onLoadMore).toHaveBeenCalledTimes(1);

        render({loaded: 3, total: 3, hasMore: false, onLoadMore});
        expect(container.querySelector('[data-testid="orders-load-more"]')).toBeNull();
    });

    it("renders nothing at all when closed", () => {
        render({isOpen: false});
        expect(container.textContent).toBe("");
    });
});

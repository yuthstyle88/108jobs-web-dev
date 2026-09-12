// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {OrderSelectorLine} from "@/modules/chat/components/OrderSelectorLine";

/**
 * The line that stands in for the order history.
 *
 * The pane used to carry the whole list, which grows with every order two
 * people complete. What has to stay on screen is *which* order the panel is
 * showing -- the thing that was invisible before the list existed (#136) -- and
 * a way to reach the rest without scrolling past it (#156).
 */
const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

// Interpolating like the real thing: `ordersOrderNumber` is "Order #{{n}}"
// and `ordersSelectorCount` is "{{count}} orders". A mock that returned bare
// keys would pass whatever the component did with them.
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (k: string, o?: Record<string, unknown>) => {
            if (o && "n" in o) return `Order #${o.n}`;
            if (o && "count" in o) return `${o.count} orders`;
            // The stepper's own labels, which the status now reads through.
            if (k === "profileChat.step1") return "Wait For Quotation";
            return k;
        },
    }),
}));

let container: HTMLDivElement;
let root: Root;

const selected = {seqNumber: 17, postName: "HIRE AGAIN 0909 - third job", status: "WaitForFreelancerQuotation"};

function render(props: Partial<Parameters<typeof OrderSelectorLine>[0]> = {}) {
    act(() => {
        root.render(
            createElement(OrderSelectorLine, {
                selected,
                total: 17,
                onOpen: vi.fn(),
                ...props,
            }),
        );
    });
}
const button = () => container.querySelector<HTMLButtonElement>('[data-testid="order-selector-line"]')!;

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

describe("the order selector line", () => {
    it("names the order the panel is showing", () => {
        render();
        expect(container.textContent).toContain("#17");
        expect(container.textContent).toContain("HIRE AGAIN 0909 - third job");
    });

    it("words the status the way the stepper and the phone do", () => {
        // Not the raw `WaitForFreelancerQuotation` the server sends.
        render();
        expect(container.textContent).toContain("Wait For Quotation");
        expect(container.textContent).not.toContain("WaitForFreelancerQuotation");
    });

    it("shows a status this build does not know as the server's own word", () => {
        render({selected: {seqNumber: 5, postName: "A job", status: "SomethingNewer"}});
        expect(container.textContent).toContain("SomethingNewer");
    });

    it("says how many the conversation has, not how many are loaded", () => {
        render({total: 23});
        expect(container.textContent).toContain("23 orders");
    });

    it("opens the history when clicked", () => {
        const onOpen = vi.fn();
        render({onOpen});
        act(() => {
            button().click();
        });
        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it("says so plainly when nothing is selected yet", () => {
        render({selected: null, total: 0});
        expect(container.textContent).toContain("profileChat.ordersSelectorNone");
    });
});

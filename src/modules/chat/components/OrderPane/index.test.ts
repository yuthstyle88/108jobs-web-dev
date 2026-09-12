// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {OrderPane} from "@/modules/chat/components/OrderPane";

/**
 * What the Orders pane opens on.
 *
 * The workflow is what the reader came to act on -- approve, release, hire
 * again -- and the order history is reference material behind it. The history
 * used to come first, so on `dm:8058:8059`, which holds 17 orders, the stepper
 * and every one of its buttons were off-screen until the reader had scrolled
 * past the lot (#154).
 *
 * Pinned here rather than in `ChatRoomView`, which cannot be mounted without a
 * room, a socket and a wallet: this component is the seam where the order of
 * the two halves is decided.
 */
const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

let container: HTMLDivElement;
let root: Root;

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

function render() {
    act(() => {
        root.render(
            createElement(OrderPane, {
                selector: createElement("div", {"data-testid": "selector"}, "Order #17"),
                workflow: createElement("div", {"data-testid": "workflow"}, "stepper and actions"),
                history: createElement("div", {"data-testid": "history"}, "17 orders"),
            }),
        );
    });
}

describe("the Orders pane", () => {
    it("names the order before showing its workflow", () => {
        render();
        const selector = container.querySelector('[data-testid="selector"]')!;
        const workflow = container.querySelector('[data-testid="workflow"]')!;
        expect(
            selector.compareDocumentPosition(workflow) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it("puts the workflow before the history", () => {
        render();
        const workflow = container.querySelector('[data-testid="workflow"]')!;
        const history = container.querySelector('[data-testid="history"]')!;

        expect(workflow).not.toBeNull();
        expect(history).not.toBeNull();
        // DOCUMENT_POSITION_FOLLOWING: history comes after workflow.
        expect(workflow.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("renders every part it is given", () => {
        render();
        expect(container.textContent).toContain("Order #17");
        expect(container.textContent).toContain("stepper and actions");
        expect(container.textContent).toContain("17 orders");
    });
});

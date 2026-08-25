// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {HowToHireModal, type HowToHireCopy} from "@/modules/chat/components/HowToHireModal";

const copy: HowToHireCopy = {
    title: "How to hire",
    closeLabel: "Close guide",
    dismissLabel: "Got it",
    steps: [
        {title: "Discuss the work", items: ["Agree on the scope"]},
        {title: "Approve and pay", items: ["Approve the quotation"]},
        {title: "Review delivery", items: ["Release payment after approval"]},
    ],
    hintTitle: "Keep it on 108heros",
    hint: "Keep the agreement, delivery, and payment in this conversation.",
};

describe("HowToHireModal", () => {
    it("shows the 108heros hiring guide only while it is open", () => {
        const closed = renderToStaticMarkup(
            createElement(HowToHireModal, {isOpen: false, onClose: () => undefined, copy}),
        );
        const open = renderToStaticMarkup(
            createElement(HowToHireModal, {isOpen: true, onClose: () => undefined, copy}),
        );

        expect(closed).toBe("");
        expect(open).toContain("Discuss the work");
        expect(open).toContain("Approve and pay");
        expect(open).toContain("Review delivery");
        expect(open).toContain("Keep it on 108heros");
    });
});

describe("HowToHireModal keyboard interaction", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root?.unmount());
        container.remove();
    });

    it("traps Tab, closes with Escape, and restores focus to the trigger", () => {
        const trigger = document.createElement("button");
        document.body.appendChild(trigger);
        trigger.focus();
        const onClose = vi.fn();

        act(() => {
            root.render(createElement(HowToHireModal, {isOpen: true, onClose, copy}));
        });

        const buttons = container.querySelectorAll<HTMLButtonElement>("button");
        expect(document.activeElement).toBe(buttons[0]);
        expect(document.body.style.overflow).toBe("hidden");

        buttons[1].focus();
        const tab = new KeyboardEvent("keydown", {key: "Tab", bubbles: true, cancelable: true});
        act(() => document.dispatchEvent(tab));
        expect(tab.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(buttons[0]);

        act(() => document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true})));
        expect(onClose).toHaveBeenCalledOnce();

        act(() => root.render(createElement(HowToHireModal, {isOpen: false, onClose, copy})));
        expect(document.activeElement).toBe(trigger);
        expect(document.body.style.overflow).toBe("");
        trigger.remove();
    });
});

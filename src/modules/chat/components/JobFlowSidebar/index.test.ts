// @vitest-environment jsdom

import {act, createElement, useLayoutEffect} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {HowToHireGuide} from "@/modules/chat/components/HowToHireGuide";
import JobFlowSidebar from "@/modules/chat/components/JobFlowSidebar";
import {
    JobFlowSidebarProvider,
    useJobFlowSidebar,
} from "@/modules/chat/contexts/JobFlowSidebarContext";

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => ({
            "profileChat.howToHire.promptTitle": "Not sure where to start?",
            "profileChat.howToHire.promptSubtitle": "Don't worry, here's a quick guide.",
            "profileChat.howToHire.open": "How to hire",
            "profileChat.howToHire.title": "How to hire on 108jobs",
            "profileChat.howToHire.close": "Close guide",
            "profileChat.howToHire.dismiss": "Got it",
            "profileChat.howToHire.discuss.title": "Discuss the work",
            "profileChat.howToHire.discuss.scope": "Agree on the scope",
            "profileChat.howToHire.discuss.price": "Agree on the price",
            "profileChat.howToHire.pay.title": "Approve and pay",
            "profileChat.howToHire.pay.quotation": "Approve the quotation",
            "profileChat.howToHire.pay.payment": "Fund the work",
            "profileChat.howToHire.review.title": "Review delivery",
            "profileChat.howToHire.review.delivery": "Review the delivery",
            "profileChat.howToHire.review.approval": "Release payment",
            "profileChat.howToHire.hintTitle": "Keep it on 108jobs",
            "profileChat.howToHire.hint": "Keep the agreement here.",
        }[key] ?? key),
    }),
}));

function SidebarHarness() {
    const {setContent, setOpen} = useJobFlowSidebar();

    useLayoutEffect(() => {
        setContent(createElement(HowToHireGuide));
        setOpen(true);
        return () => setContent(null);
    }, [setContent, setOpen]);

    return createElement(JobFlowSidebar);
}

describe("JobFlowSidebar hiring guide", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        Object.defineProperty(window, "innerWidth", {configurable: true, value: 1024, writable: true});
        vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (this: HTMLElement) {
            const sidebar = this.closest<HTMLElement>('aside[aria-label="Job Flow Sidebar"]');
            const isDesktopSidebar = sidebar?.getAttribute("role") === "complementary";
            const isVisible = window.innerWidth >= 768 ? isDesktopSidebar : !isDesktopSidebar;
            return (isVisible ? [new DOMRect()] : []) as unknown as DOMRectList;
        });
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root?.unmount());
        container.remove();
        document.body.style.overflow = "";
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
        vi.restoreAllMocks();
    });

    it("keeps one usable modal open when the viewport crosses the md breakpoint", () => {
        act(() => {
            root.render(createElement(JobFlowSidebarProvider, null, createElement(SidebarHarness)));
        });

        const desktopSidebar = document.querySelector<HTMLElement>(
            'aside[role="complementary"][aria-label="Job Flow Sidebar"]',
        );
        const desktopTrigger = Array.from(desktopSidebar?.querySelectorAll("button") ?? [])
            .find((button) => button.textContent?.includes("How to hire"));
        const mobileSidebar = document.querySelector<HTMLElement>(
            'aside[role="dialog"][aria-label="Job Flow Sidebar"]',
        );
        const mobileTrigger = Array.from(mobileSidebar?.querySelectorAll("button") ?? [])
            .find((button) => button.textContent?.includes("How to hire"));
        expect(desktopTrigger).toBeInstanceOf(HTMLButtonElement);
        expect(mobileTrigger).toBeInstanceOf(HTMLButtonElement);

        act(() => {
            desktopTrigger?.focus();
            desktopTrigger?.click();
        });
        let modal = document.querySelector<HTMLElement>('[role="dialog"][aria-labelledby="how-to-hire-title"]');
        expect(modal).not.toBeNull();
        expect(document.querySelectorAll('[role="dialog"][aria-labelledby="how-to-hire-title"]')).toHaveLength(1);
        expect(document.body.style.overflow).toBe("hidden");

        act(() => {
            window.innerWidth = 640;
            window.dispatchEvent(new Event("resize"));
        });

        modal = document.querySelector<HTMLElement>('[role="dialog"][aria-labelledby="how-to-hire-title"]');
        expect(modal?.parentElement?.parentElement).toBe(document.body);
        expect(document.querySelectorAll('[role="dialog"][aria-labelledby="how-to-hire-title"]')).toHaveLength(1);
        expect(document.body.style.overflow).toBe("hidden");

        act(() => document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true})));
        expect(document.querySelector('[role="dialog"][aria-labelledby="how-to-hire-title"]')).toBeNull();
        expect(document.body.style.overflow).toBe("");
        expect(document.activeElement).toBe(mobileTrigger);
    });
});

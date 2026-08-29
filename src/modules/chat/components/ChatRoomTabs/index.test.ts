// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import ChatRoomTabs from "@/modules/chat/components/ChatRoomTabs";

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => ({
            "profileChat.tabChat": "Chat",
            "profileChat.tabOrder": "Order",
            "profileChat.jobFlow": "Job Flow",
        }[key] ?? key),
    }),
}));

describe("ChatRoomTabs", () => {
    let container: HTMLDivElement;
    let root: Root;

    const tabs = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root?.unmount());
        container.remove();
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
        vi.restoreAllMocks();
    });

    function render(activeTab: "chat" | "order", onSelect = vi.fn()) {
        act(() => {
            root.render(createElement(ChatRoomTabs, {activeTab, onSelect}));
        });
        return onSelect;
    }

    it("renders both tabs and marks only the active one selected", () => {
        render("chat");

        expect(tabs().map((tab) => tab.textContent)).toEqual(["Chat", "Order"]);
        expect(tabs().map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    });

    it("points each tab at the pane it controls", () => {
        render("chat");

        expect(tabs().map((tab) => tab.id)).toEqual(["chat-room-tab-chat", "chat-room-tab-order"]);
        expect(tabs().map((tab) => tab.getAttribute("aria-controls"))).toEqual([
            "chat-room-panel-chat",
            "chat-room-panel-order",
        ]);
    });

    it("reports the tab the user clicked", () => {
        const onSelect = render("chat");

        act(() => tabs()[1].click());

        expect(onSelect).toHaveBeenCalledWith("order");
    });

    it("is hidden from the md breakpoint up", () => {
        render("chat");

        // The desktop layout keeps its permanent sidebar; a tab bar there
        // would offer a choice the desktop UI does not have.
        expect(document.querySelector('[role="tablist"]')?.className).toContain("md:hidden");
    });

    it("keeps a single tab stop and moves selection with the arrow keys", () => {
        const onSelect = render("chat");

        expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1]);

        act(() => {
            tabs()[0].dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowRight", bubbles: true}));
        });

        expect(onSelect).toHaveBeenCalledWith("order");
    });

    it("wraps around when arrowing past either end", () => {
        const onSelect = render("chat");

        act(() => {
            tabs()[0].dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowLeft", bubbles: true}));
        });

        expect(onSelect).toHaveBeenCalledWith("order");
    });
});

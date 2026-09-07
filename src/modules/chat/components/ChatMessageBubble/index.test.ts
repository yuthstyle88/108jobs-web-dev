// @vitest-environment jsdom

import {act, createElement, Profiler, type ProfilerOnRenderCallback} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import ChatMessageBubble from "@/modules/chat/components/ChatMessageBubble";
import {usePresenceStore} from "@/modules/chat/store/presenceStore";
import {useReadLastIdStore} from "@/modules/chat/store/readStore";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key === "profileChat.read" ? "Read" : key,
        i18n: {language: "en"},
    }),
}));

const mockRetryNow = vi.fn();
vi.mock("@/modules/chat/contexts/ChatBridgeProvider", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/modules/chat/contexts/ChatBridgeProvider")>();
    return {
        ...actual,
        useChatServices: () => ({
            sender: null,
            resend: {
                retryNow: mockRetryNow,
            },
        }),
    };
});

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};
const partnerId = 7;
const roomId = "room-1";
const outgoingMessage = {
    id: "message-1",
    roomId,
    senderId: 11,
    content: "Already read",
    createdAt: "2026-08-20T10:00:00.000Z",
    status: "delivered",
    isOwner: true,
    secure: false,
} as never;

describe("ChatMessageBubble read receipt", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        useReadLastIdStore.getState().clearAll();
        useReadLastIdStore.getState().setPeerLastReadAt(
            roomId as never,
            partnerId,
            "2026-08-20T10:01:00.000Z",
        );
        usePresenceStore.setState({byUserId: {}, phase: "ready", _queuedDiffs: []});
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    });

    it("does not rerender a historical read receipt when only peer presence changes", () => {
        usePresenceStore.getState().setPeerOnline(partnerId, Date.now());

        let commitCount = 0;
        const countCommit: ProfilerOnRenderCallback = () => {
            commitCount += 1;
        };

        act(() => {
            root.render(createElement(
                Profiler,
                {id: "read-receipt", onRender: countCommit},
                createElement(ChatMessageBubble, {
                    message: outgoingMessage,
                    partnerId: partnerId as never,
                }),
            ));
        });

        expect(container.textContent).toContain("Read");
        expect(commitCount).toBe(1);

        act(() => usePresenceStore.getState().setPeerOffline(partnerId, Date.now()));

        expect(container.textContent).toContain("Read");
        expect(commitCount).toBe(1);
    });

    it("shows a historical read receipt when the peer is already offline", () => {
        usePresenceStore.getState().setPeerOffline(partnerId, Date.now());

        act(() => {
            root.render(createElement(ChatMessageBubble, {
                message: outgoingMessage,
                partnerId: partnerId as never,
            }));
        });

        expect(container.textContent).toContain("Read");
    });

    it("renders a retry button for failed outgoing messages and triggers resend.retryNow when clicked", () => {
        mockRetryNow.mockClear();
        useReadLastIdStore.getState().clearAll();
        const failedMessage = {
            id: "msg-failed-btn",
            roomId,
            senderId: 11,
            content: "Failed to send message",
            createdAt: "2026-08-20T10:00:00.000Z",
            status: "failed",
            isOwner: true,
            secure: false,
        } as never;

        act(() => {
            root.render(createElement(ChatMessageBubble, {
                message: failedMessage,
                partnerId: partnerId as never,
            }));
        });

        const retryButton = container.querySelector("button");
        expect(retryButton).not.toBeNull();
        expect(retryButton?.textContent).toContain("profileChat.retry");

        act(() => {
            retryButton?.click();
        });

        expect(mockRetryNow).toHaveBeenCalledWith(roomId, "msg-failed-btn");
    });
});


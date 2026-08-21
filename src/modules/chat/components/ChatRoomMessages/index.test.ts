// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import ChatRoomMessages from "@/modules/chat/components/ChatRoomMessages";

const {scrollToIndex} = vi.hoisted(() => ({scrollToIndex: vi.fn()}));

vi.mock("react-virtuoso", async () => {
    const React = await import("react");

    return {
        Virtuoso: React.forwardRef(function VirtuosoTestDouble(props: {data?: unknown[]}, ref) {
            React.useImperativeHandle(ref, () => ({scrollToIndex}));
            return React.createElement("div", {"data-message-count": props.data?.length ?? 0});
        }),
    };
});

vi.mock("next/navigation", () => ({useParams: () => ({lang: "en"})}));
vi.mock("react-i18next", () => ({useTranslation: () => ({t: (key: string) => key})}));
vi.mock("@/modules/chat/components/ChatMessageBubble", () => ({default: () => null}));

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};
const message = (id: string) => ({
    id,
    roomId: "room-1",
    senderId: 7,
    content: id,
    createdAt: `2026-08-20T00:00:${id.padStart(2, "0")}Z`,
});

describe("ChatRoomMessages initial position", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        scrollToIndex.mockReset();
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    });

    const renderMessages = (messages: ReturnType<typeof message>[]) => {
        act(() => {
            root.render(createElement(ChatRoomMessages, {
                messages: messages as never[],
                partnerAvatar: "/avatar.png",
                partnerId: 7 as never,
                hasMore: true,
                isFetching: false,
            }));
        });
    };

    it("opens cached history at the newest message and does not reset after older messages prepend", () => {
        renderMessages([message("2"), message("3")]);

        expect(scrollToIndex).toHaveBeenCalledTimes(1);
        expect(scrollToIndex).toHaveBeenLastCalledWith({index: "LAST", behavior: "auto", align: "end"});

        renderMessages([message("1"), message("2"), message("3")]);

        expect(scrollToIndex).toHaveBeenCalledTimes(1);
    });

    it("moves to the newest message once when the first history page arrives asynchronously", () => {
        renderMessages([]);
        expect(scrollToIndex).not.toHaveBeenCalled();

        renderMessages([message("1"), message("2")]);
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
        expect(scrollToIndex).toHaveBeenLastCalledWith({index: "LAST", behavior: "auto", align: "end"});

        renderMessages([message("1"), message("2"), message("3")]);
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
    });
});

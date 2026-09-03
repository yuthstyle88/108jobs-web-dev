// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import MessageClient from "@/app/[lang]/chat/message/[roomId]/MessageClient";
import {REQUEST_STATE} from "@/services/HttpService";
import {useRoomsStore} from "@/modules/chat/store/roomsStore";

const mockUseHttpGet = vi.fn();
const mockRefetch = vi.fn();

vi.mock("@/hooks/api/http/useHttpGet", () => ({
    useHttpGet: (...args: any[]) => mockUseHttpGet(...args),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {language: "en"},
    }),
}));

vi.mock("@/services", () => ({
    UserService: {
        Instance: {isLoggedIn: true},
    },
}));

vi.mock("@/store/useUserStore", () => ({
    useUserStore: () => ({
        user: {id: 1, name: "test_user"},
    }),
}));

vi.mock("@/components/RoomNotFound", () => ({
    RoomNotFound: () => createElement("div", {id: "room-not-found"}, "Room Not Found"),
}));

vi.mock("@/modules/chat/components/ChatRoomView", () => ({
    default: () => createElement("div", {id: "chat-room-view"}, "Chat Room View"),
}));

vi.mock("@/modules/chat/contexts/ChatBridgeProvider", () => ({
    ChatBridgeProvider: ({children}: any) => createElement("div", null, children),
}));

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

describe("MessageClient", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        mockRefetch.mockClear();
        useRoomsStore.setState({rooms: []});
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    });

    it("renders error state with retry button when getChatRoom fails and room not in store", () => {
        mockUseHttpGet.mockReturnValue({
            data: null,
            isLoading: false,
            state: {state: REQUEST_STATE.FAILED, err: new Error("Server error")},
            execute: mockRefetch,
        });

        act(() => {
            root.render(createElement(MessageClient, {roomId: "room-123"}));
        });

        expect(container.querySelector("#room-not-found")).toBeNull();
        expect(container.textContent).toContain("error.loadChatRoomFailed");
        expect(container.textContent).toContain("global.buttonRetry");

        const retryButton = container.querySelector("button");
        expect(retryButton).not.toBeNull();
        act(() => {
            retryButton?.click();
        });
        expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it("renders RoomNotFound when API succeeds but room is empty", () => {
        mockUseHttpGet.mockReturnValue({
            data: {room: null},
            isLoading: false,
            state: {state: REQUEST_STATE.SUCCESS},
            execute: mockRefetch,
        });

        act(() => {
            root.render(createElement(MessageClient, {roomId: "room-nonexistent"}));
        });

        expect(container.querySelector("#room-not-found")).not.toBeNull();
        expect(container.textContent).toContain("Room Not Found");
    });
});

// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {UserEventsProvider} from "@/modules/chat/contexts/UserEventsContext";
import {WS_EVENT} from "@/modules/chat/protocol/wireEvents";
import {useRoomsStore} from "@/modules/chat/store/roomsStore";
import {useUnreadStore} from "@/modules/chat/store/unreadStore";
import type {RoomView} from "@/modules/chat/types";

const mocks = vi.hoisted(() => ({
    addMessageListener: vi.fn(),
    callHttp: vi.fn(),
    clearCacheEntry: vi.fn(),
    getChatRoom: vi.fn(),
    getUnreadSnapshot: vi.fn(),
    listener: null as null | ((data: unknown) => unknown),
    userId: 42,
    wsIsReady: true,
}));

vi.mock("@/modules/chat/hooks/useWebSocket", () => ({
    useWebSocket: () => ({
        status: "connected",
        isReady: mocks.wsIsReady,
        addMessageListener: mocks.addMessageListener,
    }),
}));

vi.mock("@/store/useUserStore", () => ({
    useUserStore: (selector?: (state: {user: {id: number}}) => unknown) => {
        const state = {user: {id: mocks.userId}};
        return selector ? selector(state) : state;
    },
}));

vi.mock("@/services", () => ({
    HttpService: {
        client: {
            getChatRoom: mocks.getChatRoom,
        },
    },
    UserService: {
        Instance: {
            auth: () => "test-token",
        },
    },
}));

vi.mock("@/services/HttpService", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/services/HttpService")>(),
    callHttp: mocks.callHttp,
    HttpService: {
        clearCacheEntry: mocks.clearCacheEntry,
    },
}));

vi.mock("@/hooks/api/http/useHttpGet", () => ({
    useHttpGet: () => ({data: [], state: {state: "success"}}),
}));

vi.mock("@/modules/chat/utils", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/modules/chat/utils")>(),
    maybeHandlePresenceUpdate: vi.fn(),
}));

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

function roomView(id: string, lastMessageAt: string): RoomView {
    return {
        room: {
            id: id as never,
            roomName: id,
            createdAt: "2026-08-20T08:00:00.000Z",
        } as never,
        participants: [],
        lastMessage: {
            id: `${id}-message`,
            roomId: id as never,
            senderId: 7 as never,
            content: "New message",
            secure: false,
            status: "delivered" as never,
            createdAt: lastMessageAt,
        },
        isActive: false,
    };
}

describe("UserEventsProvider room-list synchronization", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        mocks.listener = null;
        mocks.userId = 42;
        mocks.wsIsReady = true;
        mocks.callHttp.mockReset();
        mocks.clearCacheEntry.mockReset();
        mocks.getChatRoom.mockReset();
        mocks.getUnreadSnapshot.mockReset();
        mocks.getUnreadSnapshot.mockResolvedValue({state: "success", data: []});
        mocks.callHttp.mockImplementation((method: string, roomId?: string) => {
            if (method === "getUnreadSnapshot") return mocks.getUnreadSnapshot();
            return mocks.getChatRoom(roomId);
        });
        mocks.addMessageListener.mockReset();
        mocks.addMessageListener.mockImplementation((listener: (data: unknown) => unknown) => {
            mocks.listener = listener;
            return vi.fn();
        });
        useRoomsStore.getState().reset();
        useUnreadStore.getState().clearAll();
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
        vi.clearAllMocks();
    });

    it("adds an unknown room from a live chat signal without waiting for a page reload", async () => {
        const existingRoom = roomView("existing-room", "2026-08-20T09:00:00.000Z");
        const newRoom = roomView("new-room", "2026-08-20T10:00:00.000Z");
        useRoomsStore.setState({rooms: [existingRoom]});
        mocks.getChatRoom.mockResolvedValue({
            state: "success",
            data: {room: newRoom},
        });

        act(() => {
            root.render(createElement(UserEventsProvider, null, createElement("div")));
        });

        await act(async () => {
            await mocks.listener?.({
                event: WS_EVENT.ChatsSignal,
                payload: {
                    kind: "chat",
                    roomId: "new-room",
                    unreadCount: 1,
                    lastMessageAt: "2026-08-20T10:00:00.000Z",
                    senderId: 7,
                },
            });
        });

        expect(mocks.getChatRoom).toHaveBeenCalledTimes(1);
        expect(mocks.getChatRoom).toHaveBeenCalledWith("new-room");
        expect(mocks.callHttp).toHaveBeenCalledWith("getChatRoom", "new-room");
        expect(useRoomsStore.getState().rooms.map((room) => room.room.id)).toEqual([
            "new-room",
            "existing-room",
        ]);
        expect(useRoomsStore.getState().getUnread("new-room")).toBe(1);
    });

    it("shares one room-details request across repeated signals for the same new room", async () => {
        const newRoom = roomView("new-room", "2026-08-20T10:00:00.000Z");
        let resolveRoom!: (value: unknown) => void;
        mocks.getChatRoom.mockReturnValue(new Promise((resolve) => {
            resolveRoom = resolve;
        }));

        act(() => {
            root.render(createElement(UserEventsProvider, null, createElement("div")));
        });

        const signal = {
            event: WS_EVENT.ChatsSignal,
            payload: {
                kind: "chat",
                roomId: "new-room",
                unreadCount: 2,
                lastMessageAt: "2026-08-20T10:00:00.000Z",
                senderId: 7,
            },
        };
        let firstResult: unknown;
        let secondResult: unknown;

        act(() => {
            firstResult = mocks.listener?.(signal);
            secondResult = mocks.listener?.(signal);
        });

        expect(mocks.getChatRoom).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolveRoom({state: "success", data: {room: newRoom}});
            await Promise.all([firstResult, secondResult]);
        });

        expect(useRoomsStore.getState().rooms.map((room) => room.room.id)).toEqual(["new-room"]);
        expect(useRoomsStore.getState().getUnread("new-room")).toBe(2);
    });

    it("reorders an existing room from the live timestamp without fetching it again", () => {
        const currentFirstRoom = roomView("current-first", "2026-08-20T09:00:00.000Z");
        const updatedRoom = roomView("updated-room", "2026-08-20T08:00:00.000Z");
        useRoomsStore.setState({rooms: [currentFirstRoom, updatedRoom]});

        act(() => {
            root.render(createElement(UserEventsProvider, null, createElement("div")));
        });

        act(() => {
            mocks.listener?.({
                event: WS_EVENT.ChatsSignal,
                payload: {
                    kind: "chat",
                    roomId: "updated-room",
                    unreadCount: 1,
                    lastMessageAt: "2026-08-20T10:00:00.000Z",
                    senderId: 7,
                },
            });
        });

        expect(mocks.callHttp).not.toHaveBeenCalledWith("getChatRoom", "updated-room");
        expect(useRoomsStore.getState().rooms.map((room) => room.room.id)).toEqual([
            "updated-room",
            "current-first",
        ]);
        expect(useRoomsStore.getState().rooms[0].lastMessageAt).toBe("2026-08-20T10:00:00.000Z");
    });

    it("uses the live timestamp to put a fetched room first when room details have no last message", async () => {
        const existingRoom = roomView("existing-room", "2026-08-20T09:00:00.000Z");
        const newRoomWithoutMessage: RoomView = {
            room: {
                id: "new-room" as never,
                roomName: "new-room",
                createdAt: "2026-08-20T08:00:00.000Z",
            } as never,
            participants: [],
            isActive: false,
        };
        useRoomsStore.setState({rooms: [existingRoom]});
        mocks.getChatRoom.mockResolvedValue({
            state: "success",
            data: {room: newRoomWithoutMessage},
        });

        act(() => {
            root.render(createElement(UserEventsProvider, null, createElement("div")));
        });

        await act(async () => {
            await mocks.listener?.({
                event: WS_EVENT.ChatsSignal,
                payload: {
                    kind: "chat",
                    roomId: "new-room",
                    unreadCount: 1,
                    lastMessageAt: "2026-08-20T10:00:00.000Z",
                    senderId: 7,
                },
            });
        });

        expect(useRoomsStore.getState().rooms.map((room) => room.room.id)).toEqual([
            "new-room",
            "existing-room",
        ]);
    });

    it("does not let an old user's pending room request write into the next user's store", async () => {
        const newRoom = roomView("new-room", "2026-08-20T10:00:00.000Z");
        let resolveRoom!: (value: unknown) => void;
        const roomRequest = new Promise((resolve) => {
            resolveRoom = resolve;
        });
        mocks.getChatRoom.mockReturnValue(roomRequest);

        act(() => {
            root.render(createElement(UserEventsProvider, null, createElement("div")));
        });

        const oldUserResult = mocks.listener?.({
            event: WS_EVENT.ChatsSignal,
            payload: {
                kind: "chat",
                roomId: "new-room",
                unreadCount: 1,
                lastMessageAt: "2026-08-20T10:00:00.000Z",
                senderId: 7,
            },
        });

        mocks.userId = 99;
        act(() => {
            root.render(createElement(UserEventsProvider, null, createElement("div")));
        });

        await act(async () => {
            resolveRoom({state: "success", data: {room: newRoom}});
            await roomRequest;
            await oldUserResult;
        });

        expect(useRoomsStore.getState().getRoom("new-room")).toBeUndefined();
    });

    it("keeps a valid room fetch alive across a temporary socket disconnect", async () => {
        const newRoom = roomView("new-room", "2026-08-20T10:00:00.000Z");
        let resolveRoom!: (value: unknown) => void;
        const roomRequest = new Promise((resolve) => {
            resolveRoom = resolve;
        });
        mocks.getChatRoom.mockReturnValue(roomRequest);

        act(() => {
            root.render(createElement(UserEventsProvider, null, createElement("div")));
        });

        act(() => {
            mocks.listener?.({
                event: WS_EVENT.ChatsSignal,
                payload: {
                    kind: "chat",
                    roomId: "new-room",
                    unreadCount: 1,
                    lastMessageAt: "2026-08-20T10:00:00.000Z",
                    senderId: 7,
                },
            });
        });

        mocks.wsIsReady = false;
        act(() => {
            root.render(createElement(UserEventsProvider, null, createElement("div")));
        });

        await act(async () => {
            resolveRoom({state: "success", data: {room: newRoom}});
            await roomRequest;
            await Promise.resolve();
        });

        expect(useRoomsStore.getState().rooms.map((room) => room.room.id)).toEqual(["new-room"]);
        expect(useRoomsStore.getState().getUnread("new-room")).toBe(1);
    });

    it("preserves a live unread count when the initial unread snapshot completes later", async () => {
        const newRoom = roomView("new-room", "2026-08-20T10:00:00.000Z");
        let resolveSnapshot!: (value: unknown) => void;
        const snapshotRequest = new Promise((resolve) => {
            resolveSnapshot = resolve;
        });
        mocks.getUnreadSnapshot.mockReturnValue(snapshotRequest);
        mocks.getChatRoom.mockResolvedValue({
            state: "success",
            data: {room: newRoom},
        });

        act(() => {
            root.render(createElement(UserEventsProvider, null, createElement("div")));
        });

        await act(async () => {
            await mocks.listener?.({
                event: WS_EVENT.ChatsSignal,
                payload: {
                    kind: "chat",
                    roomId: "new-room",
                    unreadCount: 1,
                    lastMessageAt: "2026-08-20T10:00:00.000Z",
                    senderId: 7,
                },
            });
        });
        expect(useRoomsStore.getState().getUnread("new-room")).toBe(1);

        await act(async () => {
            resolveSnapshot({state: "success", data: []});
            await snapshotRequest;
            await Promise.resolve();
        });

        expect(useRoomsStore.getState().getUnread("new-room")).toBe(1);
    });

    it("ignores an old user's late unread snapshot and fetches a fresh snapshot for the next user", async () => {
        let resolveOldSnapshot!: (value: unknown) => void;
        const oldSnapshotRequest = new Promise((resolve) => {
            resolveOldSnapshot = resolve;
        });
        mocks.getUnreadSnapshot
            .mockReturnValueOnce(oldSnapshotRequest)
            .mockResolvedValueOnce({
                state: "success",
                data: [{roomId: "new-user-room", unreadCount: 3}],
            });

        act(() => {
            root.render(createElement(UserEventsProvider, null, createElement("div")));
        });
        expect(mocks.getUnreadSnapshot).toHaveBeenCalledTimes(1);

        mocks.userId = 99;
        await act(async () => {
            root.render(createElement(UserEventsProvider, null, createElement("div")));
            await Promise.resolve();
        });
        expect(mocks.getUnreadSnapshot).toHaveBeenCalledTimes(2);

        await act(async () => {
            resolveOldSnapshot({
                state: "success",
                data: [{roomId: "old-user-room", unreadCount: 9}],
            });
            await oldSnapshotRequest;
            await Promise.resolve();
        });

        expect(useRoomsStore.getState().getUnread("old-user-room")).toBe(0);
        expect(useRoomsStore.getState().getUnread("new-user-room")).toBe(3);
        expect(mocks.clearCacheEntry).toHaveBeenCalledTimes(2);
        expect(mocks.clearCacheEntry).toHaveBeenNthCalledWith(1, "getUnreadSnapshot");
        expect(mocks.clearCacheEntry).toHaveBeenNthCalledWith(2, "getUnreadSnapshot");
    });
});

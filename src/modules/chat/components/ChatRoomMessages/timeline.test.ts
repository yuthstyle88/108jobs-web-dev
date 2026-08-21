import {describe, expect, it} from "vitest";

import {
    CHAT_TIMELINE_START_INDEX,
    getTimelineArrayIndex,
    syncChatTimeline,
} from "@/modules/chat/components/ChatRoomMessages/timeline";

type TimelineMessage = {
    id: string;
    content: string;
};

describe("syncChatTimeline", () => {
    it("keeps the visible messages at their virtual positions when older history is prepended", () => {
        const current = {
            items: [
                {id: "3", content: "Current first message"},
                {id: "4", content: "Current second message"},
            ],
            firstItemIndex: 100_000,
        };

        const next = syncChatTimeline<TimelineMessage>(current, [
            {id: "1", content: "Older first message"},
            {id: "2", content: "Older second message"},
            {id: "3", content: "Current first message"},
            {id: "4", content: "Current second message"},
        ]);

        expect(next).toEqual({
            items: [
                {id: "1", content: "Older first message"},
                {id: "2", content: "Older second message"},
                {id: "3", content: "Current first message"},
                {id: "4", content: "Current second message"},
            ],
            firstItemIndex: 99_998,
        });
    });

    it("does not move the virtual timeline when a newly sent message is appended", () => {
        const next = syncChatTimeline<TimelineMessage>({
            items: [{id: "3", content: "Existing message"}],
            firstItemIndex: CHAT_TIMELINE_START_INDEX,
        }, [
            {id: "3", content: "Existing message"},
            {id: "4", content: "Newly sent message"},
        ]);

        expect(next.firstItemIndex).toBe(CHAT_TIMELINE_START_INDEX);
        expect(next.items.map((message) => message.id)).toEqual(["3", "4"]);
    });

    it("resets the virtual timeline when the message window is replaced", () => {
        const next = syncChatTimeline<TimelineMessage>({
            items: [{id: "old-room-message", content: "Old room"}],
            firstItemIndex: 99_750,
        }, [{id: "new-room-message", content: "New room"}]);

        expect(next.firstItemIndex).toBe(CHAT_TIMELINE_START_INDEX);
        expect(next.items).toEqual([{id: "new-room-message", content: "New room"}]);
    });
});

describe("getTimelineArrayIndex", () => {
    it("maps Virtuoso's virtual item index back to the current message array", () => {
        expect(getTimelineArrayIndex(99_998, 99_998)).toBe(0);
        expect(getTimelineArrayIndex(100_000, 99_998)).toBe(2);
    });
});

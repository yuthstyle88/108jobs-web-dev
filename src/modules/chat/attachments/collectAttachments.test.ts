import type {ChatMessage} from "108jobs-client";
import {describe, expect, it} from "vitest";

import {collectAttachments} from "@/modules/chat/attachments/collectAttachments";

const message = (over: Partial<ChatMessage> & {id: string}): ChatMessage =>
  ({
    roomId: "room-1",
    senderId: 7,
    content: "hello",
    secure: false,
    status: "sent",
    createdAt: "2026-08-18T10:00:00.000Z",
    ...over,
  }) as ChatMessage;

const file = (name: string, mime: string) =>
  JSON.stringify({type: "file", url: `https://x.test/${name}`, name, mime});

describe("collectAttachments", () => {
  it("keeps only attachments and preserves their message identity", () => {
    const items = collectAttachments([
      message({id: "a", content: "just talking"}),
      message({id: "b", content: file("photo.png", "image/png"), senderId: 9, isOwner: true}),
      message({id: "c", content: JSON.stringify({type: "proposed-quote", quote: {}})}),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      messageId: "b",
      senderId: 9,
      isOwner: true,
      attachment: {kind: "image", name: "photo.png"},
    });
  });

  it("returns newest first, whatever order the store held", () => {
    const items = collectAttachments([
      message({id: "old", content: file("a.pdf", "application/pdf"), createdAt: "2026-08-01T00:00:00.000Z"}),
      message({id: "new", content: file("c.pdf", "application/pdf"), createdAt: "2026-08-18T00:00:00.000Z"}),
      message({id: "mid", content: file("b.pdf", "application/pdf"), createdAt: "2026-08-10T00:00:00.000Z"}),
    ]);

    expect(items.map((item) => item.messageId)).toEqual(["new", "mid", "old"]);
  });

  it("does not collapse two attachments sent in the same millisecond", () => {
    const items = collectAttachments([
      message({id: "a", content: file("a.pdf", "application/pdf")}),
      message({id: "b", content: file("b.pdf", "application/pdf")}),
    ]);
    expect(items).toHaveLength(2);
  });

  it("survives an unparseable timestamp instead of scrambling the list", () => {
    const items = collectAttachments([
      message({id: "bad", content: file("a.pdf", "application/pdf"), createdAt: "not a date"}),
      message({id: "good", content: file("b.pdf", "application/pdf")}),
    ]);
    expect(items).toHaveLength(2);
  });

  it("is empty for a room with nothing in it", () => {
    expect(collectAttachments([])).toEqual([]);
  });

  // Not in the brief: collectAttachments guards each entry with `message?.`,
  // which implies the store can hand back a nullish slot. Every message
  // parser here must never throw, so that guard needs its own case.
  it("skips a nullish entry in the messages array instead of throwing", () => {
    const items = collectAttachments([
      null as unknown as ChatMessage,
      message({id: "good", content: file("a.pdf", "application/pdf")}),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].messageId).toBe("good");
  });
});

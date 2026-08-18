import type {ChatMessage} from "108jobs-client";
import {describe, expect, it} from "vitest";

import {searchMessages} from "@/modules/chat/search/searchMessages";

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

describe("searchMessages", () => {
  it("matches plain text regardless of case", () => {
    const hits = searchMessages(
      [message({id: "a", content: "The Invoice is attached"}), message({id: "b", content: "no"})],
      "invoice",
    );
    expect(hits.map((h) => h.messageId)).toEqual(["a"]);
  });

  it("trims the query and ignores a blank one", () => {
    const messages = [message({id: "a", content: "anything"})];
    expect(searchMessages(messages, "")).toEqual([]);
    expect(searchMessages(messages, "   ")).toEqual([]);
  });

  it("matches an attachment's filename and caption", () => {
    const attachment = JSON.stringify({
      type: "file",
      url: "https://x.test/api/v4/media-proxy/a-1",
      name: "Q3 quotation.pdf",
      mime: "application/pdf",
      caption: "signed copy",
    });
    expect(searchMessages([message({id: "a", content: attachment})], "quotation")).toHaveLength(1);
    expect(searchMessages([message({id: "a", content: attachment})], "signed")).toHaveLength(1);
  });

  it("does not match the storage url a human never typed", () => {
    const attachment = JSON.stringify({
      type: "file",
      url: "https://x.test/api/v4/media-proxy/a-1",
      name: "photo.png",
      mime: "image/png",
    });
    expect(searchMessages([message({id: "a", content: attachment})], "media-proxy")).toEqual([]);
  });

  it("ignores workflow messages, which are machine json", () => {
    const quote = JSON.stringify({type: "proposed-quote", quote: {projectName: "Website build"}});
    expect(searchMessages([message({id: "a", content: quote})], "website")).toEqual([]);
    expect(searchMessages([message({id: "a", content: quote})], "proposed")).toEqual([]);
  });

  it("returns newest first", () => {
    const hits = searchMessages(
      [
        message({id: "old", content: "invoice", createdAt: "2026-08-01T00:00:00.000Z"}),
        message({id: "new", content: "invoice", createdAt: "2026-08-18T00:00:00.000Z"}),
      ],
      "invoice",
    );
    expect(hits.map((h) => h.messageId)).toEqual(["new", "old"]);
  });

  it("points at the match inside the snippet", () => {
    const [hit] = searchMessages([message({id: "a", content: "please send the invoice today"})], "invoice");
    expect(hit.snippet.slice(hit.matchStart, hit.matchStart + hit.matchLength)).toBe("invoice");
  });

  it("windows a long message around the match and still points at it", () => {
    const content = `${"x".repeat(400)} invoice ${"y".repeat(400)}`;
    const [hit] = searchMessages([message({id: "a", content})], "invoice");

    expect(hit.snippet.length).toBeLessThan(200);
    expect(hit.snippet.slice(hit.matchStart, hit.matchStart + hit.matchLength)).toBe("invoice");
  });

  it("carries who sent it, so results can be labelled", () => {
    const [hit] = searchMessages(
      [message({id: "a", content: "invoice", senderId: 42, isOwner: true})],
      "invoice",
    );
    expect(hit).toMatchObject({senderId: 42, isOwner: true, createdAt: "2026-08-18T10:00:00.000Z"});
  });

  it("is case-insensitive but not diacritic-insensitive", () => {
    // Deliberate: stripping combining marks would broaden Thai matching
    // wrongly, because Thai vowels and tone marks carry meaning.
    expect(searchMessages([message({id: "a", content: "tài liệu"})], "TÀI")).toHaveLength(1);
    expect(searchMessages([message({id: "a", content: "tài liệu"})], "tai")).toEqual([]);
  });

  // Not in the brief: windowAround(text, index) alone cannot know how long the
  // match is, so when a query is longer than the default trailing budget
  // (MAX_SNIPPET - SNIPPET_LEAD = 88 chars) and lands mid-text, the naive
  // window truncates the match before it finishes -- the ellipsis gets
  // appended inside the match instead of after it, and
  // `snippet.slice(matchStart, matchStart + matchLength)` no longer equals
  // the query. Guard the invariant for a match longer than that budget.
  it("keeps the whole match visible when the query is longer than the usual trailing window", () => {
    const query = "invoice".repeat(15); // 105 chars
    const content = `${"x".repeat(400)} ${query} ${"y".repeat(400)}`;
    const [hit] = searchMessages([message({id: "a", content})], query);

    expect(hit.snippet.slice(hit.matchStart, hit.matchStart + hit.matchLength)).toBe(query);
  });
});

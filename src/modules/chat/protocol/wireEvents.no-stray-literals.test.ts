import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CHAT_MODULE_ROOT = join(__dirname, "..");

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

// Guards against someone re-introducing an inline literal instead of using
// WS_EVENT -- the exact kind of drift that caused the original bug (this
// frontend's outbound "chat:readUpTo"/"chat:ack" silently diverging from
// the backend's canonical "readUpTo"/"ackConfirm").
describe("no stray legacy wire-string literals remain outside wireEvents.ts", () => {
  const files = listTsFiles(CHAT_MODULE_ROOT).filter(
    (f) => !f.endsWith(`${join("protocol", "wireEvents.ts")}`)
  );

  it("'chat:readUpTo' does not appear anywhere in src/modules/chat/", () => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes("chat:readUpTo"));
    expect(offenders).toEqual([]);
  });

  it("'chat:ack' does not appear anywhere in src/modules/chat/ (outside comments already reviewed)", () => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes("'chat:ack'") || readFileSync(f, "utf8").includes('"chat:ack"'));
    expect(offenders).toEqual([]);
  });

  // Same guard, for every name wire v2 retired: the three that were the
  // `phoenix` npm client's own, and the colon-prefixed spellings that went
  // with the Phoenix topic namespacing. A literal creeping back would be a
  // client quietly talking v1 at a server that only answers v2 -- and since
  // all three clients ship together with no compatibility shim, that is a
  // silent dead connection rather than a loud error: it connects, it
  // exchanges frames, and it matches nothing.
  //
  // events/chatEvents.ts is exempt. Its CHAT_EVENT registry holds
  // `chat:typing`, an in-browser DOM CustomEvent name that happens to spell
  // like a wire string -- an unrelated concern that predates the wire
  // protocol and is not sent anywhere. Now that the wire no longer uses that
  // spelling, this file is the only place it legitimately appears, which
  // makes the two registries harder to confuse than they used to be.
  const wireFiles = files.filter(
    (f) => !f.endsWith(join("events", "chatEvents.ts"))
  );

  it.each([
    "phx_join",
    "phx_leave",
    "phx_reply",
    "phx_error",
    "chat:typing",
    "chat:update",
    "chat:activeRooms",
    "chats:signal",
    "sync:pending",
    "typing:start",
    "typing:stop",
  ])(
    "'%s' does not appear as a string literal anywhere in src/modules/chat/",
    (legacy) => {
      const offenders = wireFiles.filter((f) => {
        const src = readFileSync(f, "utf8");
        return src.includes(`'${legacy}'`) || src.includes(`"${legacy}"`);
      });
      expect(offenders).toEqual([]);
    }
  );

  // `chat:message` used to have the same chatEvents.ts exemption as
  // `chat:typing` above -- it was CHAT_EVENT.MESSAGE, the DOM CustomEvent
  // name for a "new message" event that was dispatched but never listened
  // for. That dead code (CHAT_EVENT.MESSAGE, emitChatNewMessage,
  // normalizeChatNewMessageDetail, ChatNewMessageDetail, and
  // structured.ts's dispatchPreview) was removed in the same change that
  // split this assertion out of the exempted list above. Unlike
  // `chat:typing`, it has no live purpose left, so it gets a stricter check:
  // the literal must not reappear anywhere in src/modules/chat/, including
  // chatEvents.ts itself. Reintroducing it -- as an event name or a wire
  // string -- should fail this test and prompt a fresh look rather than a
  // silent revival.
  it("'chat:message' does not appear as a string literal anywhere in src/modules/chat/, including chatEvents.ts", () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return src.includes("'chat:message'") || src.includes('"chat:message"');
    });
    expect(offenders).toEqual([]);
  });
});

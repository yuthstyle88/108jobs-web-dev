import { describe, expect, it } from "vitest";
import { decodeRoomIdParam } from "./roomId";

// Room ids look like `dm:8051:8052:post:1305938`. Next.js hands dynamic route
// segments over still percent-encoded, so the colons arrive as `%3A` -- and
// every other room id in the app (the rooms store, API responses, the
// `chat_message.room_id` column) is the decoded form.
describe("decodeRoomIdParam", () => {
  it("decodes the percent-encoded colons Next.js leaves in a route segment", () => {
    expect(decodeRoomIdParam("dm%3A8051%3A8052%3Apost%3A1305938")).toBe(
      "dm:8051:8052:post:1305938",
    );
  });

  it("leaves an already-decoded room id untouched", () => {
    // Both spellings reach this helper: a <Link> click encodes, while a value
    // read back out of the rooms store does not.
    expect(decodeRoomIdParam("dm:8051:8052:post:1305938")).toBe(
      "dm:8051:8052:post:1305938",
    );
  });

  it("returns an empty string when there is no room in the route", () => {
    expect(decodeRoomIdParam(undefined)).toBe("");
    expect(decodeRoomIdParam(null)).toBe("");
  });

  it("returns a malformed sequence unchanged instead of throwing", () => {
    // decodeURIComponent("%") raises URIError. The value comes from the URL
    // bar, so a bare `%` is reachable by anyone typing one -- and this runs
    // during render, where a throw takes the whole chat route down.
    expect(decodeRoomIdParam("dm%3A100%")).toBe("dm%3A100%");
  });
});

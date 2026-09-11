/**
 * The room id from a `[roomId]` route segment, in the spelling the rest of the
 * app uses.
 *
 * Next.js does not decode dynamic route segments. Room ids contain colons
 * (`dm:8051:8052:post:1305938`), which the browser percent-encodes on
 * navigation — a `<Link>` click, a hard refresh and a typed URL all arrive as
 * `dm%3A8051%3A8052%3Apost%3A1305938`. Everywhere else — the rooms store, API
 * responses, the `chat_message.room_id` column — carries the decoded form.
 *
 * Using the raw param to open the socket meant the client joined a room id
 * that matched nothing: the join was accepted, heartbeats flowed, and every
 * message was addressed to a room nobody read. The UI showed "Sent" and no row
 * was ever written, with no error on either side.
 *
 * `MessageClient` already decoded its own copy inline, so the message list and
 * the socket disagreed about which room was open. Both now call this.
 */
export function decodeRoomIdParam(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    // `decodeURIComponent` throws URIError on a malformed escape (a bare `%`).
    // That value is reachable by anyone editing the URL, and this runs during
    // render, where a throw takes the whole chat route down. A room id that
    // matches nothing is the same outcome as one that does not exist, so hand
    // the raw value back and let the ordinary "no such room" path handle it.
    return raw;
  }
}

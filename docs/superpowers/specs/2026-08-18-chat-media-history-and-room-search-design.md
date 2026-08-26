# Chat media history and in-room search — design

Date: 2026-08-18
Repos: `108heros-clean` (primary), `api-108heros` (minimal, required)
Branches: `feat/chat-media-and-room-search`, `feat/chat-attachment-asset-id`

## What this adds

Three things, which share one substrate:

1. The chat right sidebar gains top-level **Orders** / **Media** tabs. Orders is
   today's job-flow panel, unchanged. Media has nested **Image & Video** and
   **Files** tabs.
2. The chat header gains a search control that searches **the open room only**,
   client-side, over decrypted messages.
3. Chat attachments start carrying the metadata that makes private media
   readable at all — the user's original filename, and the MAD asset id.

The substrate is a typed attachment module plus a progressive backfill of the
existing authorized history endpoint. Media and search both read the same
decrypted message list out of `chatStore`; neither adds a server-side query.

## Why the attachment contract is broken today

Three defects compound, and each one was found in the tree rather than assumed.

**The original filename is destroyed on upload.** `uploadToMad()`
(`src/services/media/madUpload.ts`) returns `filename: asset.assetId`, and
`useFileUpload` copies that into `fileName`, which `ChatRoomView` puts in the
envelope's `name`. The recipient sees a UUID.

This is not a slip in `madUpload`. MAD has **no filename concept anywhere**:
`CreateUploadSessionRequest` (`media-service/src/contract/mod.rs`) accepts only
`kind`, `declaredContentLength`, `contentType` and `visibility`, and neither
`media-service` nor `media-gateway` stores a name. The asset id genuinely *is*
the only handle MAD returns. So the original filename has nowhere to live except
the chat envelope, and preserving it there is the fix — not a workaround.

**Every chat attachment is uploaded as `kind: "image"`.** `ChatRoomView` calls
`useFileUpload({setError, t})` and takes the hook's `kind = 'image'` default, so
PDFs and videos are all declared images. MAD's `MediaKind` is
`image | video | audio | file` (`media-service/src/domain/kind.rs:11`), and
`create_upload_session` never validates `contentType` against `kind` — so this
fails silently rather than erroring, and has been mislabelling assets for as
long as the MAD path has existed.

**Private media cannot be authorized when the room is encrypted.**
`media_proxy` (`crates/routes/src/media_proxy.rs`) resolves an asset to its
owning room via `ChatMessage::find_by_asset_id`, i.e. the `chat_message.asset_id`
column. That column is populated by `extract_asset_id` in
`crates/chat_realtime/src/broker/bridge_message.rs`, which parses `content` as
JSON. When secure chat is on, the web client encrypts the envelope before it
leaves the browser (`sendEvents.ts`), so `extract_asset_id` sees ciphertext,
returns `None`, and the column stays NULL. `find_by_asset_id` then finds no row
and the proxy returns 404 for media the user is entitled to.

The Flutter client sidesteps this by sending attachment envelopes
**unencrypted** (`chat_outbox_provider.dart` — "encrypting the envelope would
only hide the URL from the card that has to read it"). That is a real
workaround, and not one to copy: it trades message confidentiality for
authorization metadata. Neither client actually emits `assetId` today, so the
mechanism is inert on both sides regardless.

## The wire contract

One envelope, additive, backward-compatible in both directions:

```json
{
  "type": "file",
  "url": "https://…/api/v4/media-proxy/<assetId>",
  "name": "Q3 quotation.pdf",
  "mime": "application/pdf",
  "caption": "optional",
  "assetId": "<uuid>"
}
```

`assetId` is new. `name` reverts to its documented meaning — the user's original
filename. Everything else is unchanged, so Flutter's parser (which reads
`type`/`url`/`name`/`mime`/`caption` and ignores unknown keys) is unaffected, and
old messages without `assetId` still parse.

`submit-delivery` messages (`useWorkflowActions.ts`) carry the same shape under a
different `type` and get the same `assetId` treatment. Without it, delivery
attachments are exactly as unauthorizable as chat ones.

**Websocket payload.** `assetId` also travels as an explicit sibling field
alongside the encrypted `content`, because that is the only way the server can
persist it without reading ciphertext:

```json
{"event":"message","payload":{"id":"…","roomId":"…","senderId":1,
 "content":"<ciphertext>","secure":true,"assetId":"<uuid>","createdAt":"…"}}
```

What this exposes is a UUID handle, not content. The bytes behind it stay behind
`media_proxy`'s membership check, which is unchanged.

## Attachment module — `src/modules/chat/attachments/`

Small, pure, and the single place JSON gets parsed. Both `ChatMessageBubble` and
the Media panel consume it; neither parses envelopes itself any more.

- `types.ts` — `AttachmentKind = "image" | "video" | "file"`, and
  `ChatAttachment = {kind, url, name, mime?, caption?, assetId?}`.
- `classifyMime.ts` — `image/*` → image, `video/*` → video, everything else →
  file. When `mime` is absent or unusable, falls back to sniffing the extension
  off the URL or name. That fallback exists for legacy `/account/files` URLs,
  which carry extensions; MAD proxy URLs are extension-less UUIDs and always
  have a `mime`.
- `parseAttachment.ts` — bails unless the content starts with `{`, `JSON.parse`
  in a `try`, requires `type` of `"file"` or `"submit-delivery"` plus a non-empty
  string `url`. Returns `null` for plain text, malformed JSON, and every other
  structured message type. Never throws.
- `collectAttachments.ts` — maps a message list to
  `{messageId, senderId, createdAt, isOwner, attachment}[]`, newest first.
- `buildAttachmentEnvelope.ts` — the one place an outgoing envelope is
  constructed, so `ChatRoomView` and `useWorkflowActions` cannot drift.

`ChatMessageBubble` keeps its existing generic `parsed` memo for workflow cards
(`proposed-quote`, `review-submitted`, …) and only swaps the `isFileMsg` branch
over to `parseAttachment`. That keeps the risky part of the file small.

## Upload metadata

`madUpload.ts` — `UploadedAsset` gains `assetId` and `originalFilename`.
`filename` keeps its current meaning (the storage handle) so the existing
`madUpload.test.ts` assertion "carries the asset id as the handle, not a
filename" stays true and the legacy `/account/files` delete path is untouched.

`useFileUpload.ts` — `UploadedFile` becomes
`{fileUrl, fileType, fileName /* display */, storageKey /* delete */, assetId?}`.
`handleRemoveSelectedFile` switches from `fileName` to `storageKey`. Chat infers
`kind` from the file's MIME: `image/*` → `"image"`, everything else including
video → `"file"`. `File` is documented in MAD as "stored and served verbatim,
never processed/transcoded", which is what keeps `/internal/assets/{id}/bytes`
returning original bytes for the proxy; declaring `video` would instead place the
asset in a transcoding pipeline it should not be in. Visibility stays `private`.

## Backend — three changes, no migration

`chat_message.asset_id` already exists (`crates/db/src/schema.rs:232`).

1. `protocol/api.rs` — `MessageModel` gains `pub asset_id: Option<String>`. With
   `#[skip_serializing_none]` and serde's implicit `Option` default, a client
   that omits it deserializes to `None` and the field never appears on the wire
   when unset. Compatible in both directions.
2. `bridge_message.rs` —
   `asset_id: payload.asset_id.clone().or_else(|| extract_asset_id(&payload.content))`.
   The explicit field wins; the plaintext scan survives as the fallback for
   Flutter and legacy senders. `extract_asset_id` and its four tests are
   untouched.
3. `find_by_asset_id` — add `.order(chat_message::id.asc())`. Today it is an
   unordered `.first()`, so when two rooms carry the same asset id the winner is
   arbitrary and a forged claim can shadow the real binding. Ordering binds an
   asset to its *first* use. This is strictly a tightening; the membership
   check, the internal token, and URL handling are unchanged.

Encryption behavior is not altered anywhere. The web client keeps encrypting
attachment envelopes; the explicit `assetId` is precisely what makes that safe.

## Encrypted-history search and media

No backend search, no new endpoint. Both features read decrypted messages from
`chatStore`, which `useChatHistory` already fills via the authorized paginated
`getChatHistory` flow.

**Two obstacles in the existing hook.** `fetchHistory` closes over `pageCursor`
*state*, so calling it in a loop re-fetches page one forever. And
`mapIncomingToChatMessage` dedupes against a shared `receivedSet`, so a second,
independent fetcher would silently return nothing. Both rule out a parallel
pagination path; the fix is to drive the existing instance.

`useChatHistory` changes:

- the page body moves into `fetchOnePage()`, driven by a **cursor ref** rather
  than state, with state kept in sync for render;
- an in-flight promise ref gives single-flight, so the scroll path and the
  backfill serialize instead of racing;
- `actions.loadOlderUntilDone({signal})` loops while `hasMoreRef.current` and the
  signal is unaborted.

The scroll path's observable behavior is unchanged. The loop body lives in a pure
`historyBackfill.ts` so it is unit-testable without React.

One runner per room, shared by search and media — if search has already pulled
everything, opening Media is instant.

**Search.** `searchMessages(messages, query)` is pure: case-insensitive
(`toLowerCase`) over plain-text content plus attachment `name` and `caption`,
skipping workflow JSON. 250 ms debounce. While `hasMore` is true it starts the
backfill and shows "searching older messages…" with a Cancel; results stream in
as pages land, because they derive from the store. States: idle, no query,
searching, no results, results.

Diacritic-insensitive matching is **out of scope**: stripping combining marks
would broaden Thai matching incorrectly, since Thai vowels and tone marks are
semantically load-bearing.

**Cross-tree wiring.** `JobFlowSidebar` renders the sidebar node inside its own
`<aside>`, so React context published from `ChatRoomView` would not reach it, even
though the element is created there. Rather than restructure the layout, one
small Zustand store — `chatPanelStore`, alongside the six chat stores already in
`src/modules/chat/store/` — holds sidebar tab, media sub-tab, search open state,
per-room backfill status, and the jump/highlight channel. `ChatRoomView` registers
the runner; panels call `start`/`cancel`. This also keeps the new state out of
`ChatRoomView`, which the brief asks not to grow.

## UI

`ChatHeader` gains a search toggle. `ChatSearchPanel` overlays the message area
and is scoped to the open room. Nothing is added to the left chat list.

`JobFlowSidebar` keeps its container, desktop column and mobile slide-over.
`ChatRoomView` pushes a new `ChatSidebarTabs` into the existing `setContent`
slot: **Orders** renders today's `JobFlowContent` verbatim, **Media** renders
`ChatMediaPanel`. Tabs use `role="tablist"`/`"tab"`/`"tabpanel"`, roving tabindex
with arrow keys, `aria-selected`, and visible focus rings.

Media, newest first:

- **Image & Video** — a responsive grid. Images are thumbnails that open a
  lightbox. Videos are cards with a play badge that open
  `<video controls preload="metadata">`; **nothing autoplays**. A thumbnail that
  fails to load falls back to the file card rather than a broken image.
- **Files** — name, type badge, date, sender, and Open
  (`target="_blank" rel="noopener noreferrer"`).
- Every item can jump to its originating message.
- Loading, empty, error and progressive-backfill states per tab.

`ChatMessageBubble` renders `video/*` as video instead of a generic file card.

**Jump and highlight.** `ChatRoomMessages` subscribes to the store's pending
jump, resolves the index, calls `scrollToIndex({align: 'center'})`, then applies
a ~2 s `ring-2` highlight to the target bubble. A static ring rather than a
keyframe animation, so reduced-motion needs no special case. If the id is not yet
in the list, the request stays pending and is retried when the data changes. On
mobile, jumping closes the drawer or search overlay.

**Correction (found after this landed): plain `<img src>` against the backend
proxy directly does not work.** `read_auth_token`
(`crates/api/api_utils/src/utils.rs:527`) accepts only an `Authorization:
Bearer` header or a cookie literally named `jwt`. This app's auth cookie is
named after `NEXT_PUBLIC_APP_NAME` (`authCookieName` in `src/utils/config.ts`,
`108Heros` in this deployment) — not `jwt` — so a browser `<img>`/`<video>` tag
pointed straight at `media-proxy` sends the `108Heros` cookie the backend never
looks for, and gets `401` every time. Confirmed against a real browser
request and the backend's own access log.

The fix is a same-origin byte proxy, `src/app/api/media/[assetId]/route.ts`.
It reads the token with the existing `getJwtFromRequest`
(`src/utils/helper-server.ts`, which already checks `jwt` then falls back to
`authCookieName`), forwards it as `Authorization: Bearer <token>` to the
backend's `media-proxy`, and streams the response straight back — preserving
status, `Content-Type`/`Content-Length`, and forwarding `Range` /
`Content-Range` / `Accept-Ranges` so video seeking still works. Every response
carries `Cache-Control: private, no-store`: the backend's room-membership
check is the sole authority over whether the bytes may be read, and this
route must never let a cache outlive that check.

The stored envelope is unaffected — `url` still holds the backend
`media-proxy` address, exactly as before, because Flutter builds and reads
the same envelope with its own bearer and changing the stored shape would
fork that cross-client contract. The web client instead derives the display
url at render time: `attachmentSrc(attachment)`
(`src/modules/chat/attachments/`) returns `/api/media/{assetId}` when
`assetId` is present and falls back to the stored `url` for legacy messages
that have none. `ChatMessageBubble`, the Media panel's grid, file list and
lightbox all read through it, so none of them talk to the backend origin
directly any more.

One consequence for CSP: image/video reads no longer need the backend origin
anywhere in `img-src` or `connect-src`. The browser only ever requests the
same-origin `/api/media/...` path, which `img-src 'self'` (already present)
covers; the Next.js *server*, not the browser, makes the authenticated call
to the backend, so that hop is never subject to the browser's CSP at all. (The
backend origin stays in `connect-src` for the unrelated calls the generated
client still makes directly from the browser — login, register, refresh.)

## Localization

Every new string goes to `src/translations/{en,th,vi}.ts` under `profileChat`,
covering tabs, media states, search states, and accessible labels. No hard-coded
user-facing text.

## Testing

Component tests are not added: `vitest.config.ts` runs `environment: "node"` and
includes only `src/**/*.test.ts`, there is no `@testing-library/react`, and no
`.test.tsx` exists in the repo. Rather than change shared test infrastructure,
the design keeps all real logic in pure modules so it is testable as-is:

- attachment parsing — valid envelope, plain text, malformed JSON, missing
  `url`, unknown `type`, legacy envelope with no `assetId`;
- MIME classification — `image/*`, `video/*`, other, and the extension fallback
  for legacy URLs;
- `collectAttachments` — newest-first ordering, non-attachments excluded;
- envelope generation — `assetId` present and absent, original filename
  preserved, MAD `kind` inference;
- search matching — case-insensitivity, attachment name/caption hits, workflow
  JSON excluded, empty query;
- the backfill loop — terminates on `hasMore: false`, honors abort, single-flight
  under a concurrent scroll fetch;
- `chatPanelStore` reducers — tab switches, jump request and consumption,
  highlight expiry.

Backend: unit tests for `MessageModel` round-tripping with and without
`assetId`, for explicit-over-extracted precedence in `bridge_message`, and a
DB-backed test that `find_by_asset_id` returns the earliest binding.

**Verification commands.** Frontend: `pnpm test:unit`, `pnpm lint`, `pnpm build`.
Backend, per `api-108heros/CLAUDE.md`:

```
RUSTFMT="$(rustup which --toolchain nightly rustfmt)" cargo +nightly fmt --all -- --check
cargo clippy --workspace --tests --all-targets -- -D warnings
cargo nextest run --workspace --no-fail-fast --profile ci
```

with a fresh local Postgres/Redis and an absolute `app_108heros_CONFIG_LOCATION`.
Never a bare `cargo fmt --all`.

## Deliberate limitations

- **Legacy attachments have no `assetId`.** They keep working through their
  existing URLs and are classified by extension sniffing, but they cannot be
  authorized by `media_proxy`. Nothing here changes that.
- **No backfill of historical messages.** Messages sent before this lands never
  gain an `asset_id`; only new sends populate it.
- **The MAD path is dormant.** `NEXT_PUBLIC_MEDIA_GATEWAY_URL` is commented out
  in this repo's `.env` and `.env.example`, and `madUpload.ts` documents it as
  unset in every environment including CI, so uploads still take the legacy
  `/account/files` route. Deployed environments were not inspected here. This
  lands ahead of the cutover the same way the upload path itself did — inert
  until MAD is deployed, correct when it is.
- **Search is case-insensitive only**, not diacritic- or stem-insensitive, and
  covers text plus attachment names and captions — not the rendered contents of
  workflow cards.
- **Flutter still sends attachment envelopes unencrypted.** This design does not
  change that; it makes the explicit-`assetId` path available so a later Flutter
  change can encrypt them without losing authorization.

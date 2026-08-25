# Chat Media History and In-Room Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the chat room a Media tab (Image & Video / Files) beside the existing Orders panel, an in-room client-side search, and an attachment contract that preserves the user's original filename and the MAD asset id so private media can be authorized.

**Architecture:** A pure attachment module (`src/modules/chat/attachments/`) becomes the single place a file envelope is parsed or built; `ChatMessageBubble` and the new Media panel both consume it. Media and search read decrypted messages out of the existing `chatStore` and pull older history by driving the existing `useChatHistory` instance in a loop, so no server-side search or new endpoint is introduced. A small Zustand store carries sidebar/search UI state and the jump-to-message channel, because the sidebar renders outside `ChatRoomView`'s subtree and React context cannot reach it.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, react-i18next, react-virtuoso, Tailwind, vitest (node environment). Backend: Rust, actix-web, diesel, serde.

## Global Constraints

- **Two worktrees, already created and green.** Frontend: `/Users/koeyl/108-ecosystem/108heros/108heros-clean/.worktrees/chat-media-search` on branch `feat/chat-media-and-room-search`. Backend: `/Users/koeyl/108-ecosystem/108heros/api-108jobs/.worktrees/chat-attachment-asset-id` on branch `feat/chat-attachment-asset-id`. **Verify the branch with `git rev-parse --abbrev-ref HEAD` before every commit** — other sessions share these repos.
- **Never touch `.claude/worktrees/`** in either repo.
- **Frontend baseline is 18 test files / 160 tests passing.** Any task that ends with fewer is a regression.
- **No new dependencies and no changes to `vitest.config.ts`.** It runs `environment: "node"` and includes only `src/**/*.test.ts`. All new tests are `.test.ts` over pure modules. Do not write `.test.tsx`.
- **No hard-coded user-facing strings.** Every label goes through `t(...)` and exists in all three of `src/translations/{en,th,vi}.ts`.
- **Do not alter encryption behavior.** `sendEvents.ts` keeps encrypting message content exactly as it does today.
- **Do not weaken `media_proxy` authorization** and never emit a direct MAD URL for a private asset.
- **Never run a bare `cargo fmt --all`** in the backend — always the `RUSTFMT=` nightly form given in Task 21.
- **Do not hand-edit `src/lib/108heros-client/dist/`.** Task 9 edits one hand-written source type under `src/lib/108heros-client/src/types/` and rebuilds.

### Wire contract (fixed — every task must match exactly)

```json
{"type":"file","url":"…","name":"Q3 quotation.pdf","mime":"application/pdf","caption":"…","assetId":"<uuid>"}
```

`assetId` is additive and optional. `name` is the user's original filename. `type` is `"file"` for chat attachments and `"submit-delivery"` for delivery submissions.

---

## File Structure

**Create (frontend):**

| Path | Responsibility |
|---|---|
| `src/modules/chat/attachments/types.ts` | `AttachmentKind`, `ChatAttachment`, recognized envelope types |
| `src/modules/chat/attachments/classifyMime.ts` | MIME → kind, with legacy extension fallback |
| `src/modules/chat/attachments/parseAttachment.ts` | Safe envelope parse; `null` for everything else |
| `src/modules/chat/attachments/collectAttachments.ts` | Message list → newest-first attachment items |
| `src/modules/chat/attachments/buildAttachmentEnvelope.ts` | The only place an outgoing envelope is built |
| `src/modules/chat/attachments/index.ts` | Barrel |
| `src/modules/chat/utils/ordering.ts` | `compareNewestFirst`, shared by media and search |
| `src/modules/chat/search/searchMessages.ts` | Pure room search + snippet |
| `src/modules/chat/hooks/historyBackfill.ts` | Pure backfill loop |
| `src/modules/chat/store/chatPanelStore.ts` | Sidebar/media tab, search open, backfill state, jump channel |
| `src/modules/chat/hooks/useHistoryBackfill.ts` | Binds the loop to the store and registers the runner |
| `src/modules/chat/components/ChatSidebarTabs/index.tsx` | Orders / Media top-level tabs |
| `src/modules/chat/components/ChatMediaPanel/index.tsx` | Nested media tabs + backfill status |
| `src/modules/chat/components/ChatMediaPanel/MediaGrid.tsx` | Image & video grid |
| `src/modules/chat/components/ChatMediaPanel/MediaFileList.tsx` | Files list |
| `src/modules/chat/components/ChatMediaPanel/MediaLightbox.tsx` | Image/video viewer |
| `src/modules/chat/components/ChatMediaPanel/MediaStates.tsx` | Loading / empty / error blocks |
| `src/modules/chat/components/ChatSearchPanel/index.tsx` | Search input + results overlay |
| `src/modules/chat/components/ChatSearchPanel/SearchResultItem.tsx` | One result row |

**Modify (frontend):** `src/services/media/madUpload.ts`, `src/services/media/madUpload.test.ts`, `src/modules/chat/hooks/useFileUpload.ts`, `src/modules/chat/hooks/useChatHistory.ts`, `src/modules/chat/types/common.ts`, `src/modules/chat/events/sendEvents.ts`, `src/modules/chat/utils/structured.ts`, `src/modules/chat/hooks/useWorkflowActions.ts`, `src/modules/chat/components/ChatRoomView/index.tsx`, `src/modules/chat/components/ChatHeader/index.tsx`, `src/modules/chat/components/ChatRoomMessages/index.tsx`, `src/modules/chat/components/ChatMessageBubble/index.tsx`, `src/lib/108heros-client/src/types/ChatMessage.ts`, `src/translations/{en,th,vi}.ts`.

**Modify (backend):** `crates/chat_realtime/src/protocol/api.rs`, `crates/chat_realtime/src/broker/bridge_message.rs`, `crates/db/src/impls/chat_message.rs`.

---

## Task 1: Backend — explicit `assetId` on the websocket payload

Work in `/Users/koeyl/108-ecosystem/108heros/api-108jobs/.worktrees/chat-attachment-asset-id`.

**Why:** `extract_asset_id` parses `content` as JSON. Encrypted content is ciphertext, so `chat_message.asset_id` stays NULL and `media_proxy` 404s. An explicit field is the only way to persist it without reading the ciphertext.

**Files:**
- Modify: `crates/chat_realtime/src/protocol/api.rs` (`MessageModel`, around line 124)
- Modify: `crates/chat_realtime/src/broker/bridge_message.rs` (around line 172, and the test module at the end)

**Interfaces:**
- Produces: `MessageModel.asset_id: Option<String>`, serialized as `assetId`.

- [ ] **Step 1: Write the failing tests**

Append to the `extract_asset_id_tests` module at the bottom of `crates/chat_realtime/src/broker/bridge_message.rs`, and rename the module to `asset_id_tests`:

```rust
  use crate::protocol::api::MessageModel;

  /// The explicit field is what makes an encrypted attachment authorizable:
  /// `extract_asset_id` sees ciphertext and can never recover it.
  #[test]
  fn explicit_asset_id_wins_over_the_content_scan() {
    let payload = MessageModel {
      content: Some(r#"{"type":"file","url":"u","assetId":"from-content"}"#.to_string()),
      asset_id: Some("explicit".to_string()),
      ..Default::default()
    };
    assert_eq!(
      payload
        .asset_id
        .clone()
        .or_else(|| extract_asset_id(&payload.content)),
      Some("explicit".to_string())
    );
  }

  #[test]
  fn falls_back_to_the_content_scan_when_the_field_is_absent() {
    let payload = MessageModel {
      content: Some(r#"{"type":"file","url":"u","assetId":"from-content"}"#.to_string()),
      asset_id: None,
      ..Default::default()
    };
    assert_eq!(
      payload
        .asset_id
        .clone()
        .or_else(|| extract_asset_id(&payload.content)),
      Some("from-content".to_string())
    );
  }

  #[test]
  fn a_payload_without_the_field_still_deserializes() {
    let json = r#"{"id":"m-1","content":"hello","secure":false}"#;
    let parsed: MessageModel = serde_json::from_str(json).expect("legacy payload");
    assert_eq!(parsed.asset_id, None);
  }

  #[test]
  fn the_field_is_omitted_from_the_wire_when_unset() {
    let payload = MessageModel {
      content: Some("hello".to_string()),
      ..Default::default()
    };
    let json = serde_json::to_string(&payload).expect("serialize");
    assert!(!json.contains("assetId"), "unset asset id must not be sent: {json}");
  }

  #[test]
  fn the_field_rides_the_wire_as_camel_case_when_set() {
    let payload = MessageModel {
      asset_id: Some("a-1".to_string()),
      ..Default::default()
    };
    let json = serde_json::to_string(&payload).expect("serialize");
    assert!(json.contains(r#""assetId":"a-1""#), "{json}");
  }
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cargo test --package app_108heros_chat_realtime asset_id_tests 2>&1 | tail -20
```

Expected: FAIL — `MessageModel` has no field named `asset_id`.

- [ ] **Step 3: Add the field**

In `crates/chat_realtime/src/protocol/api.rs`, inside `MessageModel` (which already carries `#[skip_serializing_none]` and `#[serde(rename_all = "camelCase")]`), add after `pub secure: Option<bool>,`:

```rust
  /// The MAD asset id of an attachment carried by this message, sent
  /// explicitly alongside `content` rather than read out of it.
  ///
  /// `extract_asset_id` recovers this from plaintext JSON, which works for
  /// the Flutter client because it deliberately sends attachment envelopes
  /// unencrypted. The web client encrypts them, so the scan sees ciphertext
  /// and `chat_message.asset_id` stays NULL -- which makes `media_proxy`
  /// return 404 for media the caller is entitled to, because that column is
  /// the only thing mapping an asset back to a room to check membership
  /// against. This field is what lets the body stay encrypted and the asset
  /// stay authorizable at the same time.
  ///
  /// Optional and `skip_serializing_none`, so a client that never sets it is
  /// unchanged on the wire in both directions.
  pub asset_id: Option<String>,
```

- [ ] **Step 4: Prefer the explicit field when persisting**

In `crates/chat_realtime/src/broker/bridge_message.rs`, replace the `asset_id` line in the `ChatMessageInsertForm` literal (around line 172):

```rust
              asset_id: payload
                .asset_id
                .clone()
                .or_else(|| extract_asset_id(&payload.content)),
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cargo test --package app_108heros_chat_realtime asset_id_tests 2>&1 | tail -20
```

Expected: PASS — 9 tests (4 pre-existing `extract_asset_id` + 5 new).

- [ ] **Step 6: Commit**

```bash
git rev-parse --abbrev-ref HEAD   # must print feat/chat-attachment-asset-id
git add crates/chat_realtime/src/protocol/api.rs crates/chat_realtime/src/broker/bridge_message.rs
git commit -m "feat(chat): carry an attachment's asset id explicitly on the wire

The content scan cannot see through encryption, so an encrypted
attachment left chat_message.asset_id NULL and media_proxy 404'd for
media the caller was entitled to. The scan stays as the fallback for
clients that still send plaintext envelopes."
```

---

## Task 2: Backend — bind an asset to its first message

**Why:** `find_by_asset_id` does an unordered `.first()`. When two rooms carry the same asset id the winner is arbitrary, so a later message claiming someone else's asset id can shadow the original binding and pass the membership check in the wrong room. Ordering makes the first use authoritative. This strictly tightens authorization.

**Files:**
- Modify: `crates/db/src/impls/chat_message.rs` (`find_by_asset_id`, around line 151; tests around line 390)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `ChatMessage::find_by_asset_id` now returns the earliest matching row deterministically.

- [ ] **Step 1: Write the failing test**

Add to the existing test module in `crates/db/src/impls/chat_message.rs`, next to `find_by_asset_id_finds_the_owning_message`. Follow the surrounding tests' setup helpers and randomized-identifier convention exactly (see the file's existing `find_by_asset_id_finds_the_owning_message` for the shape of `pool`, room creation, and `bulk_insert`):

```rust
  /// A later message claiming an asset id that is already bound elsewhere
  /// must not become the row `media_proxy` authorizes against -- otherwise a
  /// member of the second room reads the first room's asset.
  #[tokio::test]
  #[serial_test::file_serial]
  async fn find_by_asset_id_returns_the_earliest_binding() {
    let pool = &mut build_db_pool_for_tests().await;
    let asset_id = format!("asset-{}", uuid::Uuid::new_v4());

    let (first_room, second_room) = two_rooms(pool).await;

    insert_message_with_asset(pool, &first_room, &asset_id).await;
    insert_message_with_asset(pool, &second_room, &asset_id).await;

    let found = ChatMessage::find_by_asset_id(pool, &asset_id)
      .await
      .expect("find_by_asset_id")
      .expect("a row");

    assert_eq!(
      found.room_id, first_room,
      "the first message to carry the asset owns it"
    );
  }
```

Write `two_rooms` and `insert_message_with_asset` as local helpers in the same module, modelled on the setup already inside `find_by_asset_id_finds_the_owning_message`. Read that test first and reuse its exact helper calls rather than inventing new ones.

- [ ] **Step 2: Run the test to verify it fails**

Bring up the database first (see Task 21 for the full environment):

```bash
export app_108heros_DATABASE_URL="postgres://app_108heros:password@localhost:5432/app_108heros"
export DATABASE_URL="$app_108heros_DATABASE_URL"
export app_108heros_CONFIG_LOCATION="$PWD/config/config.ci.hjson"
cargo nextest run --profile ci -E 'test(find_by_asset_id_returns_the_earliest_binding)' 2>&1 | tail -20
```

Expected: FAIL, or flaky-pass — the unordered `.first()` may return either row. If it passes, run it a few more times; the point of the fix is that the outcome stops depending on planner choice.

- [ ] **Step 3: Order the query**

In `find_by_asset_id`, add the ordering and extend the doc comment:

```rust
  /// Finds the message (if any) whose attachment carries `asset_id` — used by
  /// `media_proxy` to authorize a read by resolving the owning room.
  /// `OptionalExtension` turns "no row" into `Ok(None)` rather than an error;
  /// there is nothing wrong with an asset id that isn't (yet, or ever)
  /// referenced by a chat message.
  ///
  /// Ordered by `id` so the **earliest** message carrying the asset wins. An
  /// unordered `.first()` let a later message in another room claim an
  /// already-bound asset id and become the row membership is checked against,
  /// which is a cross-room read. First use is the real binding.
  pub async fn find_by_asset_id(
    pool: &mut DbPool<'_>,
    asset_id: &str,
  ) -> App108Result<Option<Self>> {
    let conn = &mut get_conn(pool).await?;
    Ok(
      chat_message::table
        .filter(chat_message::asset_id.eq(asset_id))
        .order(chat_message::id.asc())
        .first(conn)
        .await
        .optional()?,
    )
  }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cargo nextest run --profile ci -E 'test(find_by_asset_id)' 2>&1 | tail -20
```

Expected: PASS, both the new test and `find_by_asset_id_finds_the_owning_message`.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add crates/db/src/impls/chat_message.rs
git commit -m "fix(media): bind an asset to the first message that carried it

An unordered .first() let a later message in another room shadow an
existing binding, so membership was checked against the wrong room."
```

---

## Task 3: Attachment kinds and MIME classification

All remaining tasks work in `/Users/koeyl/108-ecosystem/108heros/108heros-clean/.worktrees/chat-media-search`.

**Files:**
- Create: `src/modules/chat/attachments/types.ts`
- Create: `src/modules/chat/attachments/classifyMime.ts`
- Test: `src/modules/chat/attachments/classifyMime.test.ts`

**Interfaces:**
- Produces: `type AttachmentKind = "image" | "video" | "file"`; `type ChatAttachment`; `ATTACHMENT_MESSAGE_TYPES`; `classifyMime(mime?: string, ...fallbacks: Array<string | undefined>): AttachmentKind`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/chat/attachments/classifyMime.test.ts`:

```ts
import {describe, expect, it} from "vitest";

import {classifyMime} from "@/modules/chat/attachments/classifyMime";

describe("classifyMime", () => {
  it("routes images and videos to their own tab", () => {
    expect(classifyMime("image/png")).toBe("image");
    expect(classifyMime("image/svg+xml")).toBe("image");
    expect(classifyMime("video/mp4")).toBe("video");
    expect(classifyMime("video/quicktime")).toBe("video");
  });

  it("treats everything else as a file", () => {
    expect(classifyMime("application/pdf")).toBe("file");
    expect(classifyMime("audio/mpeg")).toBe("file");
    expect(classifyMime("text/plain")).toBe("file");
  });

  it("is case- and whitespace-insensitive, because servers are inconsistent", () => {
    expect(classifyMime("  IMAGE/PNG ")).toBe("image");
  });

  it("falls back to the extension for legacy attachments with no usable mime", () => {
    // /account/files URLs carry an extension and often no mime at all. MAD
    // proxy URLs are extension-less UUIDs, but always have a mime.
    expect(classifyMime(undefined, "holiday.JPG")).toBe("image");
    expect(classifyMime("", "clip.webm")).toBe("video");
    expect(classifyMime("application/octet-stream", "scan.png")).toBe("image");
    expect(classifyMime(undefined, "contract.pdf")).toBe("file");
  });

  it("reads the extension off a url with a query string", () => {
    expect(classifyMime(undefined, "https://x.test/a/b/photo.png?v=2#frag")).toBe("image");
  });

  it("does not let the extension override an explicit mime", () => {
    // A .png served as a pdf is a pdf; trusting the name would be a lie.
    expect(classifyMime("application/pdf", "invoice.png")).toBe("file");
  });

  it("is a file when there is nothing to go on", () => {
    expect(classifyMime()).toBe("file");
    expect(classifyMime(undefined, undefined)).toBe("file");
    expect(classifyMime(undefined, "no-extension")).toBe("file");
    expect(classifyMime(undefined, "trailing.")).toBe("file");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/modules/chat/attachments/classifyMime.test.ts
```

Expected: FAIL — cannot resolve `@/modules/chat/attachments/classifyMime`.

- [ ] **Step 3: Write the implementation**

Create `src/modules/chat/attachments/types.ts`:

```ts
/**
 * Which media tab an attachment belongs in. `file` is the catch-all, matching
 * MAD's own `File` kind: stored and served verbatim, never transcoded.
 */
export type AttachmentKind = "image" | "video" | "file";

/**
 * Message `type` values that carry a file envelope. `submit-delivery`
 * (see `useWorkflowActions`) has the same url/name/mime shape as a plain
 * attachment and is a file the room's participants sent each other, so it
 * belongs in Media too — its bubble keeps rendering as a workflow card.
 */
export const ATTACHMENT_MESSAGE_TYPES = ["file", "submit-delivery"] as const;

/** A parsed attachment envelope. Every field is already validated. */
export type ChatAttachment = {
  kind: AttachmentKind;
  url: string;
  /** The user's original filename. */
  name: string;
  mime?: string;
  caption?: string;
  /** MAD asset id. Absent on every message sent before this shipped. */
  assetId?: string;
};
```

Create `src/modules/chat/attachments/classifyMime.ts`:

```ts
import type {AttachmentKind} from "./types";

const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif", "bmp", "svg",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4", "webm", "mov", "m4v", "avi", "mkv", "ogv", "3gp",
]);

/** A mime that tells us nothing — the upload hook's default when the browser
 *  reported no type, and what the legacy upload endpoint stores. */
const UNINFORMATIVE_MIMES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

/** Lowercased extension of a filename or URL path, or `null`. */
function extensionOf(value: string): string | null {
  const withoutQuery = value.split(/[?#]/)[0] ?? "";
  const lastSegment = withoutQuery.split("/").pop() ?? "";
  const dot = lastSegment.lastIndexOf(".");
  if (dot <= 0 || dot === lastSegment.length - 1) return null;
  return lastSegment.slice(dot + 1).toLowerCase();
}

/**
 * Which tab an attachment belongs in.
 *
 * An explicit mime always wins — a `.png` served as `application/pdf` is a
 * pdf, and trusting the name over the type would be a lie. The `fallbacks`
 * (name, then url) are only consulted when the mime is missing or one of the
 * placeholder values that carry no information, which is exactly the shape of
 * a legacy `/account/files` attachment. MAD proxy URLs are extension-less
 * UUIDs but always carry a real mime, so they never reach the fallback.
 */
export function classifyMime(
  mime?: string,
  ...fallbacks: Array<string | undefined>
): AttachmentKind {
  const normalized = (mime ?? "").trim().toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";

  if (UNINFORMATIVE_MIMES.has(normalized)) {
    for (const candidate of fallbacks) {
      if (!candidate) continue;
      const extension = extensionOf(candidate);
      if (!extension) continue;
      if (IMAGE_EXTENSIONS.has(extension)) return "image";
      if (VIDEO_EXTENSIONS.has(extension)) return "video";
    }
  }

  return "file";
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run src/modules/chat/attachments/classifyMime.test.ts
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD   # must print feat/chat-media-and-room-search
git add src/modules/chat/attachments/
git commit -m "feat(chat): classify an attachment's mime into a media kind"
```

---

## Task 4: Parse the attachment envelope

**Files:**
- Create: `src/modules/chat/attachments/parseAttachment.ts`
- Test: `src/modules/chat/attachments/parseAttachment.test.ts`

**Interfaces:**
- Consumes: `classifyMime`, `ChatAttachment`, `ATTACHMENT_MESSAGE_TYPES` from Task 3.
- Produces: `parseAttachment(content: unknown): ChatAttachment | null`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/chat/attachments/parseAttachment.test.ts`:

```ts
import {describe, expect, it} from "vitest";

import {parseAttachment} from "@/modules/chat/attachments/parseAttachment";

const envelope = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "file",
    url: "https://x.test/api/v4/media-proxy/asset-1",
    name: "Q3 quotation.pdf",
    mime: "application/pdf",
    caption: "here you go",
    ...extra,
  });

describe("parseAttachment", () => {
  it("reads the current envelope", () => {
    expect(parseAttachment(envelope({assetId: "asset-1"}))).toEqual({
      kind: "file",
      url: "https://x.test/api/v4/media-proxy/asset-1",
      name: "Q3 quotation.pdf",
      mime: "application/pdf",
      caption: "here you go",
      assetId: "asset-1",
    });
  });

  it("reads a legacy envelope with no asset id", () => {
    const parsed = parseAttachment(envelope());
    expect(parsed?.assetId).toBeUndefined();
    expect(parsed?.name).toBe("Q3 quotation.pdf");
  });

  it("accepts a delivery submission, which carries the same shape", () => {
    const parsed = parseAttachment(
      JSON.stringify({type: "submit-delivery", url: "https://x.test/d.zip", name: "d.zip"}),
    );
    expect(parsed?.kind).toBe("file");
    expect(parsed?.url).toBe("https://x.test/d.zip");
  });

  it("classifies by mime", () => {
    expect(parseAttachment(envelope({mime: "image/png"}))?.kind).toBe("image");
    expect(parseAttachment(envelope({mime: "video/mp4"}))?.kind).toBe("video");
  });

  it("falls back to the url for a name when the envelope has none", () => {
    const parsed = parseAttachment(
      JSON.stringify({type: "file", url: "https://x.test/files/holiday%20photo.png"}),
    );
    expect(parsed?.name).toBe("holiday photo.png");
    expect(parsed?.kind).toBe("image");
  });

  it("survives a url whose escape sequence is malformed", () => {
    const parsed = parseAttachment(JSON.stringify({type: "file", url: "https://x.test/a%ZZ.png"}));
    expect(parsed?.name).toBe("a%ZZ.png");
  });

  it("ignores plain text without trying to parse it", () => {
    expect(parseAttachment("just a normal message")).toBeNull();
    expect(parseAttachment("file:some-legacy-name.png")).toBeNull();
    expect(parseAttachment("")).toBeNull();
  });

  it("ignores malformed json rather than throwing", () => {
    expect(parseAttachment('{"type":"file",')).toBeNull();
    expect(parseAttachment("{")).toBeNull();
  });

  it("ignores other structured messages", () => {
    expect(parseAttachment(JSON.stringify({type: "proposed-quote", quote: {}}))).toBeNull();
    expect(parseAttachment(JSON.stringify({type: "review-submitted", rating: 5}))).toBeNull();
    expect(parseAttachment(JSON.stringify({type: "request-revision"}))).toBeNull();
  });

  it("rejects an envelope with no usable url", () => {
    expect(parseAttachment(JSON.stringify({type: "file", name: "x.pdf"}))).toBeNull();
    expect(parseAttachment(JSON.stringify({type: "file", url: "   "}))).toBeNull();
    expect(parseAttachment(JSON.stringify({type: "file", url: 42}))).toBeNull();
  });

  it("ignores non-strings and json that is not an object", () => {
    expect(parseAttachment(undefined)).toBeNull();
    expect(parseAttachment(null)).toBeNull();
    expect(parseAttachment(12)).toBeNull();
    expect(parseAttachment("[1,2,3]")).toBeNull();
  });

  it("drops blank optional fields instead of carrying empty strings", () => {
    const parsed = parseAttachment(envelope({caption: "", assetId: "  "}));
    expect(parsed?.caption).toBeUndefined();
    expect(parsed?.assetId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/modules/chat/attachments/parseAttachment.test.ts
```

Expected: FAIL — cannot resolve `@/modules/chat/attachments/parseAttachment`.

- [ ] **Step 3: Write the implementation**

Create `src/modules/chat/attachments/parseAttachment.ts`:

```ts
import {classifyMime} from "./classifyMime";
import {ATTACHMENT_MESSAGE_TYPES, type ChatAttachment} from "./types";

const ATTACHMENT_TYPES: ReadonlySet<string> = new Set(ATTACHMENT_MESSAGE_TYPES);

/** A string field that is actually present and not blank. */
function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? value : undefined;
}

/** Last path segment of a URL, percent-decoded when that is possible. */
function nameFromUrl(url: string): string {
  const withoutQuery = url.split(/[?#]/)[0] ?? "";
  const lastSegment = withoutQuery.split("/").pop() ?? "";
  if (!lastSegment) return url;
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    // A malformed escape sequence is not a reason to lose the whole message.
    return lastSegment;
  }
}

/**
 * The one place a chat message is inspected for a file envelope.
 *
 * Returns `null` for everything that is not one — plain text, malformed JSON,
 * workflow messages, envelopes with no usable url — and never throws, because
 * it runs against every message in a room including ones written by older
 * clients.
 */
export function parseAttachment(content: unknown): ChatAttachment | null {
  if (typeof content !== "string") return null;
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  if (typeof record.type !== "string" || !ATTACHMENT_TYPES.has(record.type)) return null;

  const url = optionalString(record.url);
  if (!url) return null;

  const mime = optionalString(record.mime);
  const name = optionalString(record.name) ?? nameFromUrl(url);

  return {
    kind: classifyMime(mime, name, url),
    url,
    name,
    mime,
    caption: optionalString(record.caption),
    assetId: optionalString(record.assetId),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run src/modules/chat/attachments/parseAttachment.test.ts
```

Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/attachments/parseAttachment.ts src/modules/chat/attachments/parseAttachment.test.ts
git commit -m "feat(chat): parse a file envelope safely, once, in one place"
```

---

## Task 5: Collect a room's attachments, newest first

**Files:**
- Create: `src/modules/chat/utils/ordering.ts`
- Create: `src/modules/chat/attachments/collectAttachments.ts`
- Create: `src/modules/chat/attachments/index.ts`
- Test: `src/modules/chat/attachments/collectAttachments.test.ts`

**Interfaces:**
- Consumes: `parseAttachment` (Task 4), `ChatAttachment` (Task 3).
- Produces: `type AttachmentItem = {messageId: string; senderId: number; createdAt: string; isOwner: boolean; attachment: ChatAttachment}`; `collectAttachments(messages: readonly ChatMessage[]): AttachmentItem[]`; `compareNewestFirst(a, b)`; and a barrel re-exporting `parseAttachment`, `classifyMime`, `collectAttachments`, `buildAttachmentEnvelope` (added in Task 6) and the types.

- [ ] **Step 1: Write the failing test**

Create `src/modules/chat/attachments/collectAttachments.test.ts`:

```ts
import type {ChatMessage} from "108heros-client";
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/modules/chat/attachments/collectAttachments.test.ts
```

Expected: FAIL — cannot resolve `@/modules/chat/attachments/collectAttachments`.

- [ ] **Step 3: Write the implementation**

Create `src/modules/chat/utils/ordering.ts`:

```ts
/** The minimum a record needs to be ordered in a chat timeline. */
export type TimelineOrdered = {createdAt: string; messageId: string};

/**
 * Newest first, with the message id as a stable tiebreak.
 *
 * Two attachments sent in the same millisecond, or a timestamp the server
 * wrote in a shape `Date.parse` cannot read, must still produce a total order
 * — otherwise the list reshuffles on every render.
 */
export function compareNewestFirst(a: TimelineOrdered, b: TimelineOrdered): number {
  const at = Date.parse(a.createdAt);
  const bt = Date.parse(b.createdAt);
  if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
  return b.messageId.localeCompare(a.messageId);
}
```

Create `src/modules/chat/attachments/collectAttachments.ts`:

```ts
import type {ChatMessage} from "108heros-client";

import {compareNewestFirst} from "@/modules/chat/utils/ordering";

import {parseAttachment} from "./parseAttachment";
import type {ChatAttachment} from "./types";

/** One attachment, with enough of its message to jump back to it. */
export type AttachmentItem = {
  messageId: string;
  senderId: number;
  createdAt: string;
  isOwner: boolean;
  attachment: ChatAttachment;
};

/**
 * Every attachment in a room's decrypted messages, newest first.
 *
 * The input is whatever `chatStore` currently holds — messages arrive
 * decrypted, so this needs no key and no network. It grows as history is
 * backfilled, which is what makes the media panel fill in progressively.
 */
export function collectAttachments(messages: readonly ChatMessage[]): AttachmentItem[] {
  const items: AttachmentItem[] = [];

  for (const message of messages) {
    const attachment = parseAttachment(message?.content);
    if (!attachment) continue;
    items.push({
      messageId: String(message.id),
      senderId: Number(message.senderId) || 0,
      createdAt: message.createdAt,
      isOwner: Boolean(message.isOwner),
      attachment,
    });
  }

  return items.sort(compareNewestFirst);
}
```

Create `src/modules/chat/attachments/index.ts`:

```ts
export {classifyMime} from "./classifyMime";
export {parseAttachment} from "./parseAttachment";
export {collectAttachments, type AttachmentItem} from "./collectAttachments";
export {ATTACHMENT_MESSAGE_TYPES, type AttachmentKind, type ChatAttachment} from "./types";
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run src/modules/chat/attachments/collectAttachments.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/utils/ordering.ts src/modules/chat/attachments/
git commit -m "feat(chat): collect a room's attachments newest first"
```

---

## Task 6: Build the outgoing envelope in one place

**Files:**
- Create: `src/modules/chat/attachments/buildAttachmentEnvelope.ts`
- Modify: `src/modules/chat/attachments/index.ts`
- Test: `src/modules/chat/attachments/buildAttachmentEnvelope.test.ts`

**Interfaces:**
- Produces: `buildAttachmentEnvelope(input: AttachmentEnvelopeInput): string` where
  `type AttachmentEnvelopeInput = {url: string; name: string; mime?: string; caption?: string; assetId?: string; type?: "file" | "submit-delivery"}`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/chat/attachments/buildAttachmentEnvelope.test.ts`:

```ts
import {describe, expect, it} from "vitest";

import {buildAttachmentEnvelope} from "@/modules/chat/attachments/buildAttachmentEnvelope";
import {parseAttachment} from "@/modules/chat/attachments/parseAttachment";

describe("buildAttachmentEnvelope", () => {
  it("writes the current contract", () => {
    const json = buildAttachmentEnvelope({
      url: "https://x.test/api/v4/media-proxy/asset-1",
      name: "Q3 quotation.pdf",
      mime: "application/pdf",
      caption: "here you go",
      assetId: "asset-1",
    });

    expect(JSON.parse(json)).toEqual({
      type: "file",
      url: "https://x.test/api/v4/media-proxy/asset-1",
      name: "Q3 quotation.pdf",
      mime: "application/pdf",
      caption: "here you go",
      assetId: "asset-1",
    });
  });

  it("omits what it does not have rather than sending nulls", () => {
    const json = buildAttachmentEnvelope({url: "https://x.test/a.pdf", name: "a.pdf"});
    expect(JSON.parse(json)).toEqual({type: "file", url: "https://x.test/a.pdf", name: "a.pdf"});
  });

  it("keeps the user's filename, never the storage handle", () => {
    // uploadToMad returns the asset id as `filename` because MAD has no
    // filename concept at all -- this envelope is the only place the name the
    // user actually chose survives.
    const json = buildAttachmentEnvelope({
      url: "https://x.test/api/v4/media-proxy/9f1c",
      name: "Design brief.docx",
      assetId: "9f1c",
    });
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe("Design brief.docx");
    expect(parsed.assetId).toBe("9f1c");
  });

  it("can write a delivery submission", () => {
    const json = buildAttachmentEnvelope({
      type: "submit-delivery",
      url: "https://x.test/d.zip",
      name: "d.zip",
    });
    expect(JSON.parse(json).type).toBe("submit-delivery");
  });

  it("round-trips through the parser", () => {
    const json = buildAttachmentEnvelope({
      url: "https://x.test/clip.mp4",
      name: "clip.mp4",
      mime: "video/mp4",
      assetId: "a-2",
    });
    expect(parseAttachment(json)).toEqual({
      kind: "video",
      url: "https://x.test/clip.mp4",
      name: "clip.mp4",
      mime: "video/mp4",
      caption: undefined,
      assetId: "a-2",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/modules/chat/attachments/buildAttachmentEnvelope.test.ts
```

Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write the implementation**

Create `src/modules/chat/attachments/buildAttachmentEnvelope.ts`:

```ts
import {serializeStructured} from "@/modules/chat/utils/structured";

export type AttachmentEnvelopeInput = {
  url: string;
  /** The user's original filename, never the storage handle. */
  name: string;
  mime?: string;
  caption?: string;
  assetId?: string;
  /** Defaults to `"file"`; delivery submissions pass `"submit-delivery"`. */
  type?: "file" | "submit-delivery";
};

/**
 * The one place an outgoing attachment envelope is written.
 *
 * Two senders build these — an ordinary chat attachment and a delivery
 * submission — and they drifted apart before, which is how `assetId` ended up
 * on neither. Optional fields are omitted rather than sent as null, so an
 * older client reading this sees exactly the envelope it always did.
 */
export function buildAttachmentEnvelope(input: AttachmentEnvelopeInput): string {
  const envelope: Record<string, unknown> = {
    type: input.type ?? "file",
    url: input.url,
    name: input.name,
  };
  if (input.mime) envelope.mime = input.mime;
  if (input.caption) envelope.caption = input.caption;
  if (input.assetId) envelope.assetId = input.assetId;
  return serializeStructured(envelope);
}
```

Add to `src/modules/chat/attachments/index.ts`:

```ts
export {
  buildAttachmentEnvelope,
  type AttachmentEnvelopeInput,
} from "./buildAttachmentEnvelope";
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run src/modules/chat/attachments/
```

Expected: PASS — all four attachment test files.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/attachments/
git commit -m "feat(chat): build the outgoing attachment envelope in one place"
```

---

## Task 7: Return typed upload metadata from MAD

**Why:** `uploadToMad` returns `filename: asset.assetId`, and `useFileUpload` copies that into the envelope's `name`, so recipients see a UUID. MAD has no filename concept — `CreateUploadSessionRequest` takes only `kind`, `declaredContentLength`, `contentType`, `visibility` — so the caller must keep the name itself.

**Files:**
- Modify: `src/services/media/madUpload.ts` (`UploadedAsset`, `uploadToMad`)
- Test: `src/services/media/madUpload.test.ts` (extend; do not rewrite)

**Interfaces:**
- Produces: `UploadedAsset` gains `assetId: string` and `originalFilename: string`. `filename` keeps its existing meaning — the storage handle — so the existing test "carries the asset id as the handle, not a filename" still passes and the legacy delete path is unchanged.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe("uploadToMad", …)` block in `src/services/media/madUpload.test.ts`:

```ts
  it("keeps the user's filename alongside the storage handle", async () => {
    // MAD stores no filename at all, so if this call drops it the name is
    // gone for good and the recipient sees a UUID.
    stubFetch([SESSION, BYTES, COMPLETE]);

    const asset = await uploadToMad(file, "private");

    expect(asset).toMatchObject({
      assetId: "asset-9",
      originalFilename: file.name,
      filename: "asset-9",
    });
  });

  it("still reports an asset id when MAD omits the content type", async () => {
    stubFetch([SESSION, BYTES, {status: 200, body: {assetId: "asset-9"}}]);

    const asset = await uploadToMad(file, "private");

    expect(asset.assetId).toBe("asset-9");
    expect(asset.mimeType).toBe(file.type);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/services/media/madUpload.test.ts
```

Expected: FAIL — `assetId` and `originalFilename` are undefined.

- [ ] **Step 3: Write the implementation**

In `src/services/media/madUpload.ts`, replace the `UploadedAsset` type:

```ts
/** What every upload path here returns, matching the legacy `/account/files`
 *  response so call sites do not care which one ran. */
export type UploadedAsset = {
  url: string;
  /**
   * The handle the storage backend knows this by — the asset id on MAD, a
   * real filename on the legacy path. It is what deletion is keyed on, which
   * is why it is not the display name.
   */
  filename: string;
  size: number;
  mimeType?: string;
  /**
   * MAD's asset id, named for what it is. Callers need it explicitly: it goes
   * in the chat envelope so the server can persist `chat_message.asset_id`
   * without reading encrypted content, and `media_proxy` resolves the owning
   * room from that column to check membership.
   */
  assetId?: string;
  /**
   * The name the user's file actually had. MAD has no filename concept — the
   * upload contract accepts only kind/length/content-type/visibility — so
   * nothing recovers this if the caller drops it here.
   */
  originalFilename?: string;
};
```

And in `uploadToMad`, replace the return statement:

```ts
  return {
    url: assetUrl(asset.assetId, visibility, gateway),
    // The legacy contract calls this a filename because the old backend keyed
    // deletion on one. MAD keys everything on the asset id, so that is the
    // handle, whatever the field is called.
    filename: asset.assetId,
    size: file.size,
    mimeType: asset.contentType ?? contentType,
    assetId: asset.assetId,
    originalFilename: file.name,
  };
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run src/services/media/madUpload.test.ts
```

Expected: PASS — every existing test plus the two new ones.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/services/media/madUpload.ts src/services/media/madUpload.test.ts
git commit -m "feat(media): return the asset id and original filename explicitly

MAD stores no filename, so the caller is the only thing that still knows
what the user called the file."
```

---

## Task 8: Typed upload metadata and correct MAD kind in the chat hook

**Why:** `ChatRoomView` takes `useFileUpload`'s `kind = 'image'` default, so every chat attachment — PDFs, videos, archives — is declared an image to MAD. MAD never validates `contentType` against `kind`, so this fails silently.

**Files:**
- Modify: `src/modules/chat/hooks/useFileUpload.ts`
- Create: `src/modules/chat/hooks/uploadKind.ts`
- Test: `src/modules/chat/hooks/uploadKind.test.ts`

**Interfaces:**
- Consumes: `UploadedAsset` (Task 7).
- Produces: `uploadKindForMime(mime?: string, filename?: string): MediaKind`; `UploadedFile` becomes `{fileUrl: string; fileType: string; fileName: string; storageKey: string; assetId?: string} | null`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/chat/hooks/uploadKind.test.ts`:

```ts
import {describe, expect, it} from "vitest";

import {uploadKindForMime} from "@/modules/chat/hooks/uploadKind";

describe("uploadKindForMime", () => {
  it("declares images as image media", () => {
    expect(uploadKindForMime("image/png")).toBe("image");
    expect(uploadKindForMime("image/webp")).toBe("image");
  });

  it("declares video as file media, so MAD serves it verbatim", () => {
    // MAD's `File` kind is documented "stored and served verbatim, never
    // processed/transcoded", which is what keeps the proxy's
    // /internal/assets/{id}/bytes returning the original. Declaring `video`
    // would enrol a chat attachment in a transcoding pipeline instead.
    expect(uploadKindForMime("video/mp4")).toBe("file");
    expect(uploadKindForMime("video/quicktime")).toBe("file");
  });

  it("declares documents as file media", () => {
    expect(uploadKindForMime("application/pdf")).toBe("file");
    expect(uploadKindForMime("application/zip")).toBe("file");
    expect(uploadKindForMime("audio/mpeg")).toBe("file");
  });

  it("uses the filename when the browser reported no type", () => {
    expect(uploadKindForMime(undefined, "holiday.png")).toBe("image");
    expect(uploadKindForMime("application/octet-stream", "scan.JPEG")).toBe("image");
    expect(uploadKindForMime("", "notes.txt")).toBe("file");
  });

  it("is file when there is nothing to go on", () => {
    expect(uploadKindForMime()).toBe("file");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/modules/chat/hooks/uploadKind.test.ts
```

Expected: FAIL — cannot resolve `@/modules/chat/hooks/uploadKind`.

- [ ] **Step 3: Write the implementation**

Create `src/modules/chat/hooks/uploadKind.ts`:

```ts
import {classifyMime} from "@/modules/chat/attachments";
import type {MediaKind} from "@/services/media/madUpload";

/**
 * Which MAD kind to declare for a file being uploaded.
 *
 * MAD's own enum is `image | video | audio | file`, but the frontend only ever
 * declares two of them. Video and audio go up as `file` deliberately: `File`
 * is "stored and served verbatim, never processed/transcoded", which is
 * exactly what a chat attachment needs, and what keeps `media_proxy`'s
 * `/internal/assets/{id}/bytes` returning the original bytes. Declaring
 * `video` would instead place the asset in a transcoding pipeline it has no
 * business being in.
 *
 * MAD does not validate `contentType` against `kind`, so getting this wrong
 * is silent — which is how every chat attachment came to be declared an image.
 */
export function uploadKindForMime(mime?: string, filename?: string): MediaKind {
  return classifyMime(mime, filename) === "image" ? "image" : "file";
}
```

In `src/modules/chat/hooks/useFileUpload.ts`, replace the `UploadedFile` type:

```ts
export type UploadedFile = {
  fileUrl: string;
  fileType: string;
  /** What the user called it — this is what recipients see. */
  fileName: string;
  /** What the storage backend knows it by; deletion is keyed on this. */
  storageKey: string;
  /** MAD only. Goes in the chat envelope so the asset stays authorizable. */
  assetId?: string;
} | null;
```

Change the `kind` option's default so the caller's file decides. Replace the destructure:

```ts
    const {setError, t, visibility = 'private', kind} = opts;
```

Replace the MAD branch of `handleFileUpload`:

```ts
                if (madGatewayUrl()) {
                    // `kind` is a per-call override for callers that know
                    // better (the resume form uploads a document as `file`
                    // whatever its mime says); everything else infers it from
                    // the file, because taking the old `'image'` default meant
                    // declaring every pdf and video an image.
                    const resolvedKind = kind ?? uploadKindForMime(fileType, file.name);
                    const asset = await uploadToMad(file, visibility, resolvedKind);
                    uploaded = {
                        fileUrl: asset.url,
                        fileType: asset.mimeType || fileType,
                        fileName: asset.originalFilename || file.name,
                        storageKey: asset.filename,
                        assetId: asset.assetId,
                    };
                } else {
                    // Pass file as UploadImage interface
                    const res = await uploadFile({ image: file });
                    if (res.state !== REQUEST_STATE.SUCCESS) {
                        const msg = t('upload.error') || 'Failed to upload file';
                        setError(msg);
                        return null;
                    }

                    const data: any = res.data;
                    const legacyName = String(data?.filename || file.name || 'file');
                    uploaded = {
                        fileUrl: String(data?.url || ''),
                        fileType,
                        fileName: legacyName,
                        storageKey: legacyName,
                    };
                }
```

Add the import at the top:

```ts
import { uploadKindForMime } from '@/modules/chat/hooks/uploadKind';
```

Update `handleRemoveSelectedFile` to delete by the storage handle:

```ts
                // Deletion is keyed on the storage handle, which is the asset
                // id on MAD and a real filename on the legacy path -- not the
                // display name, which is now the user's own.
                const res = await deleteFile(selectedFile.storageKey);
```

and the log line below it:

```ts
                console.log('File deleted successfully:', { storageKey: selectedFile.storageKey }); // Debug
```

Update the `kind` JSDoc on `UseFileUploadProps` to match the new default:

```ts
    /**
     * What kind of asset this upload is. Left unset, it is inferred from the
     * file's own mime — see `uploadKindForMime`. Pass it explicitly only when
     * the caller knows better than the mime does. Only meaningful on the MAD
     * path — the legacy `/account/files` endpoint has no such concept.
     */
    kind?: MediaKind;
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm vitest run src/modules/chat/hooks/uploadKind.test.ts && pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: 5 tests PASS. `tsc` reports errors only in files later tasks fix (`ChatRoomView`, `useWorkflowActions`) if they read `selectedFile`; if it reports errors anywhere else, fix them now.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/hooks/uploadKind.ts src/modules/chat/hooks/uploadKind.test.ts src/modules/chat/hooks/useFileUpload.ts
git commit -m "fix(chat): keep the uploaded filename and declare the right MAD kind

Every chat attachment was declared kind 'image' and named after its
storage handle. MAD validates neither, so both failed silently."
```

---

## Task 9: Thread `assetId` onto the wire

**Files:**
- Modify: `src/lib/108heros-client/src/types/ChatMessage.ts`
- Modify: `src/modules/chat/types/common.ts` (`MessagePayload`)
- Modify: `src/modules/chat/events/sendEvents.ts` (`sendChatMessage`)
- Modify: `src/modules/chat/utils/structured.ts` (`sendStructured`)
- Test: `src/modules/chat/events/sendEvents.test.ts` (extend)

**Interfaces:**
- Consumes: nothing.
- Produces: `MessagePayload.assetId?: string`; `ChatMessage.assetId?: string`; `sendStructured` opts gain `assetId?: string`. The outgoing websocket payload carries `assetId` as a sibling of `content`.

- [ ] **Step 1: Write the failing test**

Read `src/modules/chat/events/sendEvents.test.ts` first and follow its existing mocking style. Append a describe block:

```ts
describe("sendChatMessage attachment metadata", () => {
  it("puts the asset id beside the encrypted content, not inside it", async () => {
    // The server cannot read an encrypted envelope, so this is the only way
    // chat_message.asset_id gets populated -- and media_proxy resolves the
    // owning room from that column to check membership.
    const sent: any[] = [];
    const deps = makeDeps(sent);   // reuse the helper this file already has

    await sendChatMessage(deps, {
      message: JSON.stringify({type: "file", url: "u", name: "n.pdf", assetId: "a-1"}),
      senderId: 1 as never,
      secure: true,
      id: "m-1",
      assetId: "a-1",
    });

    expect(sent[0]).toMatchObject({assetId: "a-1"});
  });

  it("omits the field entirely for an ordinary text message", async () => {
    const sent: any[] = [];
    const deps = makeDeps(sent);

    await sendChatMessage(deps, {
      message: "hello",
      senderId: 1 as never,
      secure: false,
      id: "m-2",
    });

    expect(sent[0]).not.toHaveProperty("assetId");
  });
});
```

If `sendEvents.test.ts` has no reusable `makeDeps`, write one in the new describe block that mirrors how the existing tests build `deps` (a `sender` with an async `sendMessage` that records its payload and returns the client id).

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/modules/chat/events/sendEvents.test.ts
```

Expected: FAIL — `assetId` is not on the sent payload.

- [ ] **Step 3: Write the implementation**

In `src/lib/108heros-client/src/types/ChatMessage.ts`, add to the `ChatMessage` type:

```ts
  /**
   * MAD asset id of an attachment this message carries, sent as a sibling of
   * `content` because `content` may be encrypted. Mirrors `MessageModel`'s
   * `assetId` on the server. Absent on plain messages and on everything sent
   * before this shipped.
   */
  assetId?: string;
```

In `src/modules/chat/types/common.ts`, add to `MessagePayload`:

```ts
export interface MessagePayload {
    message: string;
    senderId: LocalUserId;
    secure: boolean,
    id?: string;
    /** See `ChatMessage.assetId`. Set only for attachment messages. */
    assetId?: string;
}
```

In `src/modules/chat/events/sendEvents.ts`, inside `sendChatMessage`, immediately after `p.status = 'sending' as any;`:

```ts
    // Beside the content, never inside it: the server persists this into
    // chat_message.asset_id, which is the only thing mapping the asset back
    // to a room for media_proxy's membership check, and it cannot read the
    // ciphertext this message is about to become.
    if (data.assetId) (p as any).assetId = data.assetId;
```

In `src/modules/chat/utils/structured.ts`, extend `sendStructured`'s opts and pass it through:

```ts
export const sendStructured = async (
    sendMessage: WsMessageSender,
    roomId: string,
    payload: Structured,
    senderId: LocalUserId,
    opts: {
        previewText?: string;
        attach?: { url: string; name?: string } | null;
        secure?: boolean;
        /** See `ChatMessage.assetId`. */
        assetId?: string;
    } = {}
) => {
```

and change the final send call:

```ts
    await sendMessage({senderId: senderId, message, secure, id, assetId: opts.assetId});
```

- [ ] **Step 4: Run the tests and rebuild the client package**

```bash
pnpm vitest run src/modules/chat/events/sendEvents.test.ts
(cd src/lib/108heros-client && pnpm build)
rm -rf node_modules/.pnpm/file+src+lib+108heros-client && pnpm install
pnpm vitest run src/modules/chat/
```

Expected: PASS. The rebuild-and-reinstall is required — pnpm copies the sub-package into its store at install time, so an edit to its source is invisible until both steps run.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/lib/108heros-client/src/types/ChatMessage.ts src/modules/chat/types/common.ts src/modules/chat/events/sendEvents.ts src/modules/chat/utils/structured.ts src/modules/chat/events/sendEvents.test.ts
git commit -m "feat(chat): send an attachment's asset id beside its content"
```

---

## Task 10: Send the new envelope from both attachment senders

**Files:**
- Modify: `src/modules/chat/components/ChatRoomView/index.tsx` (`onSubmit`, around lines 330-360)
- Modify: `src/modules/chat/hooks/useWorkflowActions.ts` (`submitDelivery`, around lines 278-315; the `selectedFile` prop type at line 35)

**Interfaces:**
- Consumes: `buildAttachmentEnvelope` (Task 6), `UploadedFile` (Task 8), `MessagePayload.assetId` (Task 9).
- Produces: both senders emit the contract in Global Constraints.

- [ ] **Step 1: Update the chat attachment sender**

In `ChatRoomView`'s `onSubmit`, replace the `contentToSend` and `preview` expressions:

```ts
            const contentToSend = selectedFile
                ? buildAttachmentEnvelope({
                    url: selectedFile.fileUrl,
                    name: selectedFile.fileName,
                    mime: selectedFile.fileType,
                    caption: message || undefined,
                    assetId: selectedFile.assetId,
                })
                : message;
```

and pass the id through the send:

```ts
            await sendMessage({
                message: contentToSend,
                senderId: Number(localUser.id),
                secure: Boolean((localUser as any)?.isMessageSecure),
                id: messageId,
                assetId: selectedFile?.assetId,
            });
```

Add the import:

```ts
import {buildAttachmentEnvelope} from "@/modules/chat/attachments";
```

- [ ] **Step 2: Update the delivery sender**

In `src/modules/chat/hooks/useWorkflowActions.ts`, widen the prop type at line 35:

```ts
    selectedFile: UploadedFile;
```

with `import type {UploadedFile} from '@/modules/chat/hooks/useFileUpload';` at the top.

Then in `submitDelivery`, replace the `payload` literal and the send:

```ts
            const payload: any = {
                type: 'submit-delivery',
                url: selectedFile.fileUrl,
                name: selectedFile.fileName,
                mime: selectedFile.fileType,
                ...(selectedFile.assetId ? {assetId: selectedFile.assetId} : {}),
            };
            const preview = `[Delivery] ${selectedFile.fileName}`;
            await sendStructuredMessage(sendMessage, roomId, payload, localUser.id, {
                previewText: preview,
                assetId: selectedFile.assetId,
            });
```

- [ ] **Step 3: Verify types and the existing suite**

```bash
pnpm exec tsc --noEmit 2>&1 | head -20
pnpm test:unit 2>&1 | tail -6
```

Expected: no type errors; 18 files / 160+ tests passing.

- [ ] **Step 4: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/components/ChatRoomView/index.tsx src/modules/chat/hooks/useWorkflowActions.ts
git commit -m "feat(chat): send the asset id from both attachment senders"
```

---

## Task 11: A cancellable backfill loop

**Files:**
- Create: `src/modules/chat/hooks/historyBackfill.ts`
- Test: `src/modules/chat/hooks/historyBackfill.test.ts`

**Interfaces:**
- Produces: `type BackfillOutcome = "complete" | "cancelled" | "capped"`; `runBackfill(deps: BackfillDeps): Promise<BackfillOutcome>` where `BackfillDeps = {fetchOnePage: () => Promise<void>; hasMore: () => boolean; signal?: {aborted: boolean}; onPage?: (pagesLoaded: number) => void; maxPages?: number}`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/chat/hooks/historyBackfill.test.ts`:

```ts
import {describe, expect, it, vi} from "vitest";

import {runBackfill} from "@/modules/chat/hooks/historyBackfill";

/** A fake history source with `pages` pages left to hand out. */
function source(pages: number) {
  let remaining = pages;
  return {
    fetchOnePage: vi.fn(async () => {
      remaining -= 1;
    }),
    hasMore: () => remaining > 0,
    get remaining() {
      return remaining;
    },
  };
}

describe("runBackfill", () => {
  it("keeps pulling until the history is exhausted", async () => {
    const s = source(4);

    const outcome = await runBackfill({fetchOnePage: s.fetchOnePage, hasMore: s.hasMore});

    expect(outcome).toBe("complete");
    expect(s.fetchOnePage).toHaveBeenCalledTimes(4);
  });

  it("does nothing when there is nothing older", async () => {
    const s = source(0);

    expect(await runBackfill({fetchOnePage: s.fetchOnePage, hasMore: s.hasMore})).toBe("complete");
    expect(s.fetchOnePage).not.toHaveBeenCalled();
  });

  it("reports progress so the panel can say how far it has got", async () => {
    const s = source(3);
    const seen: number[] = [];

    await runBackfill({fetchOnePage: s.fetchOnePage, hasMore: s.hasMore, onPage: (n) => seen.push(n)});

    expect(seen).toEqual([1, 2, 3]);
  });

  it("stops when cancelled, without starting another page", async () => {
    const s = source(10);
    const signal = {aborted: false};

    const outcome = await runBackfill({
      fetchOnePage: s.fetchOnePage,
      hasMore: s.hasMore,
      signal,
      onPage: () => {
        signal.aborted = true;
      },
    });

    expect(outcome).toBe("cancelled");
    expect(s.fetchOnePage).toHaveBeenCalledTimes(1);
  });

  it("does not start at all when cancelled before the first page", async () => {
    const s = source(10);

    const outcome = await runBackfill({
      fetchOnePage: s.fetchOnePage,
      hasMore: s.hasMore,
      signal: {aborted: true},
    });

    expect(outcome).toBe("cancelled");
    expect(s.fetchOnePage).not.toHaveBeenCalled();
  });

  it("gives up rather than looping forever when the cursor never advances", async () => {
    // A server that keeps handing back a next-cursor would otherwise spin
    // here until the tab dies. `capped` exists so the UI can say the results
    // are partial instead of pretending they are complete.
    const fetchOnePage = vi.fn(async () => {});

    const outcome = await runBackfill({fetchOnePage, hasMore: () => true, maxPages: 3});

    expect(outcome).toBe("capped");
    expect(fetchOnePage).toHaveBeenCalledTimes(3);
  });

  it("lets a failing page reject so the caller can show an error", async () => {
    const fetchOnePage = vi.fn(async () => {
      throw new Error("network");
    });

    await expect(runBackfill({fetchOnePage, hasMore: () => true})).rejects.toThrow("network");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/modules/chat/hooks/historyBackfill.test.ts
```

Expected: FAIL — cannot resolve `@/modules/chat/hooks/historyBackfill`.

- [ ] **Step 3: Write the implementation**

Create `src/modules/chat/hooks/historyBackfill.ts`:

```ts
/** How a backfill ended. `capped` means the results are partial. */
export type BackfillOutcome = "complete" | "cancelled" | "capped";

export type BackfillDeps = {
  /** Pulls exactly one older page and writes it to the store. */
  fetchOnePage: () => Promise<void>;
  /** Read fresh each iteration — it changes as pages land. */
  hasMore: () => boolean;
  /** Anything with an `aborted` flag; an `AbortSignal` satisfies this. */
  signal?: {aborted: boolean};
  onPage?: (pagesLoaded: number) => void;
  maxPages?: number;
};

/**
 * A hard stop so a server that always returns a next-cursor cannot spin this
 * forever. At the hook's page size of 40 this is 40,000 messages, far past any
 * real room.
 */
const DEFAULT_MAX_PAGES = 1000;

/**
 * Pull older history until there is none left, the caller cancels, or the cap
 * trips.
 *
 * Extracted from React so the interesting parts — that cancellation is checked
 * before starting a page as well as after, that the cap is reported rather
 * than silently swallowed — are testable without a component.
 */
export async function runBackfill(deps: BackfillDeps): Promise<BackfillOutcome> {
  const maxPages = deps.maxPages ?? DEFAULT_MAX_PAGES;
  let pagesLoaded = 0;

  while (deps.hasMore()) {
    if (deps.signal?.aborted) return "cancelled";
    if (pagesLoaded >= maxPages) return "capped";

    await deps.fetchOnePage();
    pagesLoaded += 1;
    deps.onPage?.(pagesLoaded);

    if (deps.signal?.aborted) return "cancelled";
  }

  return "complete";
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run src/modules/chat/hooks/historyBackfill.test.ts
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/hooks/historyBackfill.ts src/modules/chat/hooks/historyBackfill.test.ts
git commit -m "feat(chat): a cancellable loop for pulling older history"
```

---

## Task 12: Drive `useChatHistory` from a cursor ref

**Why:** `fetchHistory` closes over `pageCursor` **state**, so calling it repeatedly inside one loop re-fetches page one forever. And `mapIncomingToChatMessage` dedupes against a shared `receivedSet`, so a second independent fetcher would silently return nothing — a parallel pagination path is not an option.

**Files:**
- Modify: `src/modules/chat/hooks/useChatHistory.ts`

**Interfaces:**
- Consumes: `runBackfill`, `BackfillOutcome` (Task 11).
- Produces: `UseChatHistoryResult.actions` gains
  `loadOlderUntilDone(opts?: {signal?: AbortSignal; onPage?: (n: number) => void}): Promise<BackfillOutcome>`.
  `fetchHistory` keeps its exact current signature and error-swallowing behavior.

- [ ] **Step 1: Replace the hook body**

Replace everything from `export function useChatHistory` to the end of the file:

```ts
export function useChatHistory(opts: UseChatHistoryOptions): UseChatHistoryResult {
    const {roomId, pageSize = 40, isE2EMock = false, localUserId, receivedSet, broadcast, upsertHistory} = opts;

    const [pageCursor, setPageCursor] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState<boolean>(false);
    const [hasMore, setHasMore] = useState<boolean>(true);

    // Refs, not state, because a programmatic backfill calls the fetcher many
    // times inside one render: a state-closed cursor would still be page one
    // on every iteration.
    const cursorRef = useRef<string | null>(null);
    const hasMoreRef = useRef<boolean>(true);
    const lastCursorRef = useRef<string | null>(null);
    // Single-flight. The scroll handler and the backfill both fetch, and
    // handing the second caller the promise already running is what keeps
    // them from interleaving pages against a shared cursor.
    const inFlightRef = useRef<Promise<void> | null>(null);

    // Reset cursor/state when room changes
    useEffect(() => {
        setPageCursor(null);
        setHasMore(true);
        cursorRef.current = null;
        hasMoreRef.current = true;
        lastCursorRef.current = null;
        inFlightRef.current = null;
    }, [roomId]);

    const fetchOnePage = useCallback(async (): Promise<void> => {
        if (isE2EMock || !hasMoreRef.current) return;
        if (inFlightRef.current) return inFlightRef.current;

        const run = (async () => {
            setIsFetching(true);
            try {
                const {prev, items} = await fetchHistoryPage(
                    {roomId, cursor: cursorRef.current, limit: pageSize},
                    {localUserId, receivedSet, broadcast},
                );

                if (items && Array.isArray(items)) {
                    // Reverse items before inserting to match ascending render order
                    upsertHistory(roomId, items.reverse());
                }

                // For backfill, use `prev` to continue going backward.
                const prevCursor = (typeof prev === 'string' && prev.length > 0) ? prev : null;
                const sameCursor = prevCursor !== null && prevCursor === lastCursorRef.current;

                if (!prevCursor || sameCursor) {
                    cursorRef.current = null;
                    hasMoreRef.current = false;
                    setPageCursor(null);
                    setHasMore(false);
                } else {
                    lastCursorRef.current = prevCursor;
                    cursorRef.current = prevCursor;
                    hasMoreRef.current = true;
                    setPageCursor(prevCursor);
                    setHasMore(true);
                }
            } finally {
                setIsFetching(false);
                inFlightRef.current = null;
            }
        })();

        inFlightRef.current = run;
        return run;
    }, [isE2EMock, roomId, pageSize, localUserId, receivedSet, broadcast, upsertHistory]);

    // The public action keeps swallowing errors exactly as it always did --
    // its callers are scroll handlers that have nowhere to show one. The
    // backfill uses `fetchOnePage` directly, because a panel that pulled half
    // a room's history and then hit a network error does have something to say.
    const fetchHistory = useCallback(async () => {
        try {
            await fetchOnePage();
        } catch (e) {
            console.error('[useChatHistory] fetchHistory failed', e);
        }
    }, [fetchOnePage]);

    const loadOlderUntilDone = useCallback(
        (loadOpts?: {signal?: AbortSignal; onPage?: (pagesLoaded: number) => void}) =>
            runBackfill({
                fetchOnePage,
                hasMore: () => hasMoreRef.current,
                signal: loadOpts?.signal,
                onPage: loadOpts?.onPage,
            }),
        [fetchOnePage],
    );

    const reset = useCallback(() => {
        setPageCursor(null);
        setHasMore(true);
        setIsFetching(false);
        cursorRef.current = null;
        hasMoreRef.current = true;
        lastCursorRef.current = null;
        inFlightRef.current = null;
    }, []);

    return {
        state: {pageCursor, hasMore, isFetching},
        actions: {fetchHistory, reset, loadOlderUntilDone},
    };
}
```

Update the imports at the top of the file:

```ts
import {useCallback, useEffect, useRef, useState} from 'react';
import {fetchHistoryPage} from '@/modules/chat/utils/chatSocketUtils';
import {runBackfill, type BackfillOutcome} from '@/modules/chat/hooks/historyBackfill';
import {ChatMessage} from "108heros-client";
```

and extend the result type:

```ts
export type UseChatHistoryResult = {
    state: {
        pageCursor: string | null;
        hasMore: boolean;
        isFetching: boolean;
    };
    actions: {
        fetchHistory: () => Promise<void>;
        reset: () => void;
        /**
         * Pull older pages until the room is exhausted or the caller cancels.
         * Used by the media panel and by search, which both need history the
         * user has not scrolled to. Rejects if a page fails.
         */
        loadOlderUntilDone: (opts?: {
            signal?: AbortSignal;
            onPage?: (pagesLoaded: number) => void;
        }) => Promise<BackfillOutcome>;
    };
};
```

- [ ] **Step 2: Verify nothing regressed**

```bash
pnpm exec tsc --noEmit 2>&1 | head -20
pnpm test:unit 2>&1 | tail -6
```

Expected: no type errors; the full suite still passes. `ChatRoomView`'s two existing callers of `fetchHistory` are unchanged.

- [ ] **Step 3: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/hooks/useChatHistory.ts
git commit -m "refactor(chat): drive history paging from a cursor ref

A state-closed cursor meant a programmatic loop re-fetched page one
forever. Single-flight keeps the scroll handler and the backfill from
interleaving pages."
```

---

## Task 13: The chat panel store

**Files:**
- Create: `src/modules/chat/store/chatPanelStore.ts`
- Test: `src/modules/chat/store/chatPanelStore.test.ts`

**Why a store and not context:** `JobFlowSidebar` renders the sidebar node inside its own `<aside>`, so a provider mounted in `ChatRoomView` is not an ancestor of it and its context would not resolve. Six chat stores already exist in this directory; this is the established way to talk across that boundary.

**Interfaces:**
- Produces: `useChatPanelStore` with state
  `{sidebarTab: "orders" | "media"; mediaTab: "imageVideo" | "files"; isSearchOpen: boolean; backfillByRoom: Record<string, BackfillState>; pendingJumpMessageId: string | null; highlightedMessageId: string | null}`
  and actions `setSidebarTab`, `setMediaTab`, `openSearch`, `closeSearch`, `setBackfill(roomId, patch)`, `requestJump(messageId)`, `consumeJump()`, `setHighlight(id)`, `clearHighlight()`.
  Plus module functions `registerBackfillRunner(roomId, runner): () => void`, `startBackfill(roomId)`, `cancelBackfill(roomId)`.
  `type BackfillState = {phase: "idle" | "running" | "complete" | "cancelled" | "capped" | "error"; pagesLoaded: number; error?: string}`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/chat/store/chatPanelStore.test.ts`:

```ts
import {beforeEach, describe, expect, it, vi} from "vitest";

import {
  cancelBackfill,
  registerBackfillRunner,
  startBackfill,
  useChatPanelStore,
} from "@/modules/chat/store/chatPanelStore";

const reset = () =>
  useChatPanelStore.setState({
    sidebarTab: "orders",
    mediaTab: "imageVideo",
    isSearchOpen: false,
    backfillByRoom: {},
    pendingJumpMessageId: null,
    highlightedMessageId: null,
  });

describe("chatPanelStore", () => {
  beforeEach(reset);

  it("starts on Orders so the existing panel is what people see", () => {
    expect(useChatPanelStore.getState().sidebarTab).toBe("orders");
    expect(useChatPanelStore.getState().mediaTab).toBe("imageVideo");
  });

  it("switches tabs", () => {
    useChatPanelStore.getState().setSidebarTab("media");
    useChatPanelStore.getState().setMediaTab("files");
    expect(useChatPanelStore.getState().sidebarTab).toBe("media");
    expect(useChatPanelStore.getState().mediaTab).toBe("files");
  });

  it("opens and closes search", () => {
    useChatPanelStore.getState().openSearch();
    expect(useChatPanelStore.getState().isSearchOpen).toBe(true);
    useChatPanelStore.getState().closeSearch();
    expect(useChatPanelStore.getState().isSearchOpen).toBe(false);
  });

  it("tracks backfill per room, merging partial updates", () => {
    const {setBackfill} = useChatPanelStore.getState();
    setBackfill("room-1", {phase: "running", pagesLoaded: 2});
    setBackfill("room-2", {phase: "complete"});
    setBackfill("room-1", {phase: "complete"});

    expect(useChatPanelStore.getState().backfillByRoom["room-1"]).toEqual({
      phase: "complete",
      pagesLoaded: 2,
    });
    expect(useChatPanelStore.getState().backfillByRoom["room-2"]?.phase).toBe("complete");
  });

  it("hands a jump request over exactly once", () => {
    useChatPanelStore.getState().requestJump("m-1");
    expect(useChatPanelStore.getState().pendingJumpMessageId).toBe("m-1");

    expect(useChatPanelStore.getState().consumeJump()).toBe("m-1");
    expect(useChatPanelStore.getState().pendingJumpMessageId).toBeNull();
    expect(useChatPanelStore.getState().consumeJump()).toBeNull();
  });

  it("highlights and clears", () => {
    useChatPanelStore.getState().setHighlight("m-1");
    expect(useChatPanelStore.getState().highlightedMessageId).toBe("m-1");
    useChatPanelStore.getState().clearHighlight();
    expect(useChatPanelStore.getState().highlightedMessageId).toBeNull();
  });

  it("routes start and cancel to the room's registered runner", () => {
    const start = vi.fn();
    const cancel = vi.fn();
    const unregister = registerBackfillRunner("room-1", {start, cancel});

    startBackfill("room-1");
    cancelBackfill("room-1");

    expect(start).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);

    unregister();
    startBackfill("room-1");
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for a room with no runner instead of throwing", () => {
    expect(() => startBackfill("nobody")).not.toThrow();
    expect(() => cancelBackfill("nobody")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/modules/chat/store/chatPanelStore.test.ts
```

Expected: FAIL — cannot resolve `@/modules/chat/store/chatPanelStore`.

- [ ] **Step 3: Write the implementation**

Create `src/modules/chat/store/chatPanelStore.ts`:

```ts
import {create} from 'zustand';

export type SidebarTab = 'orders' | 'media';
export type MediaTab = 'imageVideo' | 'files';

export type BackfillPhase =
  | 'idle'
  | 'running'
  | 'complete'
  | 'cancelled'
  | 'capped'
  | 'error';

export type BackfillState = {
  phase: BackfillPhase;
  pagesLoaded: number;
  error?: string;
};

const IDLE: BackfillState = {phase: 'idle', pagesLoaded: 0};

interface ChatPanelState {
  sidebarTab: SidebarTab;
  mediaTab: MediaTab;
  isSearchOpen: boolean;
  backfillByRoom: Record<string, BackfillState>;
  /** A jump the message list has not acted on yet. */
  pendingJumpMessageId: string | null;
  /** The message currently wearing the "you jumped here" ring. */
  highlightedMessageId: string | null;
}

interface ChatPanelActions {
  setSidebarTab: (tab: SidebarTab) => void;
  setMediaTab: (tab: MediaTab) => void;
  openSearch: () => void;
  closeSearch: () => void;
  setBackfill: (roomId: string, patch: Partial<BackfillState>) => void;
  requestJump: (messageId: string) => void;
  /** Takes the pending jump and clears it, so it fires once. */
  consumeJump: () => string | null;
  setHighlight: (messageId: string) => void;
  clearHighlight: () => void;
}

/**
 * UI state for the chat room's side panel and search.
 *
 * A store rather than context because `JobFlowSidebar` renders the sidebar's
 * content inside its own `<aside>`, which is not a descendant of
 * `ChatRoomView` -- a provider mounted there is simply not an ancestor of the
 * component that would consume it. The jump channel has the same shape of
 * problem: the media panel asks, and the virtualized list on the other side of
 * that boundary answers.
 */
export const useChatPanelStore = create<ChatPanelState & ChatPanelActions>((set, get) => ({
  sidebarTab: 'orders',
  mediaTab: 'imageVideo',
  isSearchOpen: false,
  backfillByRoom: {},
  pendingJumpMessageId: null,
  highlightedMessageId: null,

  setSidebarTab: (sidebarTab) => set({sidebarTab}),
  setMediaTab: (mediaTab) => set({mediaTab}),
  openSearch: () => set({isSearchOpen: true}),
  closeSearch: () => set({isSearchOpen: false}),

  setBackfill: (roomId, patch) =>
    set((s) => ({
      backfillByRoom: {
        ...s.backfillByRoom,
        [roomId]: {...(s.backfillByRoom[roomId] ?? IDLE), ...patch},
      },
    })),

  requestJump: (messageId) => set({pendingJumpMessageId: messageId}),

  consumeJump: () => {
    const pending = get().pendingJumpMessageId;
    if (pending !== null) set({pendingJumpMessageId: null});
    return pending;
  },

  setHighlight: (messageId) => set({highlightedMessageId: messageId}),
  clearHighlight: () => set({highlightedMessageId: null}),
}));

/** What a room's backfill can be told to do. */
export type BackfillRunner = {start: () => void; cancel: () => void};

/**
 * Runners live outside the store deliberately: they are functions bound to a
 * live `useChatHistory` instance, and putting them in state would re-render
 * every panel each time a room mounted.
 */
const runners = new Map<string, BackfillRunner>();

/** Returns the unregister function, for a `useEffect` cleanup. */
export function registerBackfillRunner(roomId: string, runner: BackfillRunner): () => void {
  runners.set(roomId, runner);
  return () => {
    if (runners.get(roomId) === runner) runners.delete(roomId);
  };
}

export function startBackfill(roomId: string): void {
  runners.get(roomId)?.start();
}

export function cancelBackfill(roomId: string): void {
  runners.get(roomId)?.cancel();
}

/** A room's backfill state, defaulted, for use as a selector. */
export function selectBackfill(roomId: string) {
  return (s: ChatPanelState): BackfillState => s.backfillByRoom[roomId] ?? IDLE;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run src/modules/chat/store/chatPanelStore.test.ts
```

Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/store/chatPanelStore.ts src/modules/chat/store/chatPanelStore.test.ts
git commit -m "feat(chat): a store for panel tabs, backfill state and jumps"
```

---

## Task 14: Search a room's decrypted messages

**Files:**
- Create: `src/modules/chat/search/searchMessages.ts`
- Test: `src/modules/chat/search/searchMessages.test.ts`

**Interfaces:**
- Consumes: `parseAttachment` (Task 4), `compareNewestFirst` (Task 5).
- Produces: `type SearchHit = {messageId: string; senderId: number; createdAt: string; isOwner: boolean; snippet: string; matchStart: number; matchLength: number}`; `searchMessages(messages: readonly ChatMessage[], rawQuery: string): SearchHit[]`; `searchableText(message: ChatMessage): string | null`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/chat/search/searchMessages.test.ts`:

```ts
import type {ChatMessage} from "108heros-client";
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/modules/chat/search/searchMessages.test.ts
```

Expected: FAIL — cannot resolve `@/modules/chat/search/searchMessages`.

- [ ] **Step 3: Write the implementation**

Create `src/modules/chat/search/searchMessages.ts`:

```ts
import type {ChatMessage} from "108heros-client";

import {parseAttachment} from "@/modules/chat/attachments";
import {compareNewestFirst} from "@/modules/chat/utils/ordering";

export type SearchHit = {
  messageId: string;
  senderId: number;
  createdAt: string;
  isOwner: boolean;
  /** A window of the matched text, ellipsised at either end when clipped. */
  snippet: string;
  /** Where the match starts *within the snippet*, for highlighting. */
  matchStart: number;
  matchLength: number;
};

/** Longest snippet rendered in a result row. */
const MAX_SNIPPET = 120;
/** How much context to keep before the match when windowing. */
const SNIPPET_LEAD = 32;
const ELLIPSIS = "…";

/**
 * What of a message a person could plausibly be searching for.
 *
 * Attachments contribute their filename and caption — things a human typed or
 * chose — but not their URL, which nobody searches for and which would match
 * every attachment in the room on a substring like the proxy path. Workflow
 * messages contribute nothing: they are machine JSON, and matching their raw
 * text would surface a quotation for the word "proposed".
 */
export function searchableText(message: ChatMessage): string | null {
  const content = message?.content;
  if (typeof content !== "string") return null;

  const attachment = parseAttachment(content);
  if (attachment) {
    return [attachment.name, attachment.caption].filter(Boolean).join(" ");
  }

  if (content.trim().startsWith("{")) return null;
  return content;
}

/** A window of `text` around `index`, plus where the match now starts in it. */
function windowAround(text: string, index: number) {
  if (text.length <= MAX_SNIPPET) {
    return {snippet: text, matchStart: index};
  }

  const start = Math.max(0, index - SNIPPET_LEAD);
  const end = Math.min(text.length, start + MAX_SNIPPET);
  const leading = start > 0 ? ELLIPSIS : "";
  const trailing = end < text.length ? ELLIPSIS : "";

  return {
    snippet: `${leading}${text.slice(start, end)}${trailing}`,
    matchStart: index - start + leading.length,
  };
}

/**
 * Every message in the room whose searchable text contains `rawQuery`,
 * newest first.
 *
 * Runs over whatever `chatStore` holds, which is decrypted — the server never
 * sees a query and could not answer one anyway, since it only ever held
 * ciphertext. Results therefore cover exactly as much history as has been
 * loaded, which is why the panel backfills while the user types.
 *
 * Case-insensitive only. Not diacritic- or stem-insensitive: stripping
 * combining marks would broaden Thai matching incorrectly, because Thai vowels
 * and tone marks are semantically load-bearing.
 */
export function searchMessages(
  messages: readonly ChatMessage[],
  rawQuery: string,
): SearchHit[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const hits: SearchHit[] = [];

  for (const message of messages) {
    const text = searchableText(message);
    if (!text) continue;

    const index = text.toLowerCase().indexOf(query);
    if (index < 0) continue;

    const {snippet, matchStart} = windowAround(text, index);
    hits.push({
      messageId: String(message.id),
      senderId: Number(message.senderId) || 0,
      createdAt: message.createdAt,
      isOwner: Boolean(message.isOwner),
      snippet,
      matchStart,
      matchLength: query.length,
    });
  }

  return hits.sort(compareNewestFirst);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run src/modules/chat/search/searchMessages.test.ts
```

Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/search/
git commit -m "feat(chat): search a room's decrypted messages client-side"
```

---

## Task 15: Translations

**Files:**
- Modify: `src/translations/en.ts`, `src/translations/th.ts`, `src/translations/vi.ts`

Each file has `jobFlow:` at line 39 inside `profileChat`. Insert the new block **immediately after that line** in each.

**Interfaces:**
- Produces: keys `profileChat.orders`, `profileChat.media`, and the nested `profileChat.mediaPanel.*` and `profileChat.roomSearch.*` groups used by Tasks 17-19.

- [ ] **Step 1: Add the English strings**

After line 39 of `src/translations/en.ts`:

```ts
            orders: "Orders",
            media: "Media",
            mediaPanel: {
                imageVideo: "Image & Video",
                files: "Files",
                loading: "Loading media…",
                loadingOlder: "Loading older media…",
                stopLoading: "Stop",
                partial: "Showing media from the messages loaded so far.",
                error: "Could not load older media.",
                retry: "Try again",
                emptyImageVideo: "No photos or videos in this conversation yet.",
                emptyFiles: "No files in this conversation yet.",
                openItem: "Open",
                download: "Download",
                jumpToMessage: "Go to message",
                closeViewer: "Close",
                sentBy: "Sent by {{name}}",
                you: "You",
                videoUnsupported: "Your browser cannot play this video.",
                thumbnailFailed: "Preview unavailable",
            },
            roomSearch: {
                open: "Search in conversation",
                close: "Close search",
                placeholder: "Search in this conversation",
                clear: "Clear search",
                searching: "Searching…",
                searchingOlder: "Searching older messages…",
                stopSearching: "Stop",
                partial: "Searched the messages loaded so far.",
                error: "Could not search older messages.",
                retry: "Try again",
                hint: "Type to search this conversation.",
                noResults: "No messages match “{{query}}”.",
                resultCount_one: "{{count}} result",
                resultCount_other: "{{count}} results",
                results: "Search results",
            },
```

- [ ] **Step 2: Add the Thai strings**

After line 39 of `src/translations/th.ts`:

```ts
            orders: "คำสั่งงาน",
            media: "สื่อ",
            mediaPanel: {
                imageVideo: "รูปภาพและวิดีโอ",
                files: "ไฟล์",
                loading: "กำลังโหลดสื่อ…",
                loadingOlder: "กำลังโหลดสื่อเก่า…",
                stopLoading: "หยุด",
                partial: "แสดงสื่อจากข้อความที่โหลดมาแล้ว",
                error: "ไม่สามารถโหลดสื่อเก่าได้",
                retry: "ลองอีกครั้ง",
                emptyImageVideo: "ยังไม่มีรูปภาพหรือวิดีโอในการสนทนานี้",
                emptyFiles: "ยังไม่มีไฟล์ในการสนทนานี้",
                openItem: "เปิด",
                download: "ดาวน์โหลด",
                jumpToMessage: "ไปที่ข้อความ",
                closeViewer: "ปิด",
                sentBy: "ส่งโดย {{name}}",
                you: "คุณ",
                videoUnsupported: "เบราว์เซอร์ของคุณเล่นวิดีโอนี้ไม่ได้",
                thumbnailFailed: "ไม่สามารถแสดงตัวอย่างได้",
            },
            roomSearch: {
                open: "ค้นหาในการสนทนา",
                close: "ปิดการค้นหา",
                placeholder: "ค้นหาในการสนทนานี้",
                clear: "ล้างการค้นหา",
                searching: "กำลังค้นหา…",
                searchingOlder: "กำลังค้นหาข้อความเก่า…",
                stopSearching: "หยุด",
                partial: "ค้นหาจากข้อความที่โหลดมาแล้ว",
                error: "ไม่สามารถค้นหาข้อความเก่าได้",
                retry: "ลองอีกครั้ง",
                hint: "พิมพ์เพื่อค้นหาในการสนทนานี้",
                noResults: "ไม่พบข้อความที่ตรงกับ “{{query}}”",
                resultCount_other: "{{count}} รายการ",
                results: "ผลการค้นหา",
            },
```

Thai has no plural distinction, so only `resultCount_other` is defined — i18next falls back to it for every count.

- [ ] **Step 3: Add the Vietnamese strings**

After line 39 of `src/translations/vi.ts`:

```ts
            orders: "Đơn hàng",
            media: "Phương tiện",
            mediaPanel: {
                imageVideo: "Ảnh và video",
                files: "Tệp",
                loading: "Đang tải phương tiện…",
                loadingOlder: "Đang tải phương tiện cũ hơn…",
                stopLoading: "Dừng",
                partial: "Hiển thị phương tiện từ các tin nhắn đã tải.",
                error: "Không thể tải phương tiện cũ hơn.",
                retry: "Thử lại",
                emptyImageVideo: "Chưa có ảnh hoặc video trong cuộc trò chuyện này.",
                emptyFiles: "Chưa có tệp nào trong cuộc trò chuyện này.",
                openItem: "Mở",
                download: "Tải xuống",
                jumpToMessage: "Đến tin nhắn",
                closeViewer: "Đóng",
                sentBy: "Gửi bởi {{name}}",
                you: "Bạn",
                videoUnsupported: "Trình duyệt của bạn không phát được video này.",
                thumbnailFailed: "Không có bản xem trước",
            },
            roomSearch: {
                open: "Tìm trong cuộc trò chuyện",
                close: "Đóng tìm kiếm",
                placeholder: "Tìm trong cuộc trò chuyện này",
                clear: "Xóa tìm kiếm",
                searching: "Đang tìm…",
                searchingOlder: "Đang tìm trong tin nhắn cũ hơn…",
                stopSearching: "Dừng",
                partial: "Đã tìm trong các tin nhắn đã tải.",
                error: "Không thể tìm trong tin nhắn cũ hơn.",
                retry: "Thử lại",
                hint: "Nhập để tìm trong cuộc trò chuyện này.",
                noResults: "Không có tin nhắn nào khớp với “{{query}}”.",
                resultCount_other: "{{count}} kết quả",
                results: "Kết quả tìm kiếm",
            },
```

- [ ] **Step 4: Verify all three parse and agree**

```bash
pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: no errors. Then read all three inserted blocks side by side and confirm they declare the same key names — `tsc` will not catch a key that exists in `en` but is missing from `vi`, because each translation file is an independent object literal.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "i18n: strings for the media panel and in-room search"
```

---

## Task 16: Bind the backfill to the store

**Files:**
- Create: `src/modules/chat/hooks/useHistoryBackfill.ts`

**Interfaces:**
- Consumes: `loadOlderUntilDone` (Task 12), `useChatPanelStore`/`registerBackfillRunner` (Task 13).
- Produces: `useHistoryBackfill({roomId, loadOlderUntilDone}): void` — registers a runner and mirrors its progress into the store.

- [ ] **Step 1: Write the hook**

Create `src/modules/chat/hooks/useHistoryBackfill.ts`:

```ts
'use client';

import {useCallback, useEffect, useRef} from 'react';

import type {UseChatHistoryResult} from '@/modules/chat/hooks/useChatHistory';
import {registerBackfillRunner, useChatPanelStore} from '@/modules/chat/store/chatPanelStore';

type Options = {
  roomId: string;
  loadOlderUntilDone: UseChatHistoryResult['actions']['loadOlderUntilDone'];
};

/**
 * Makes this room's history backfill reachable from panels that are not in
 * `ChatRoomView`'s subtree.
 *
 * The runner has to be created here, because it closes over the live
 * `useChatHistory` instance -- there is only one per room, and a second,
 * independent pager would return nothing at all: `mapIncomingToChatMessage`
 * dedupes against a `receivedSet` shared with this one. So the hook registers
 * the runner centrally and mirrors its progress into the store, which is what
 * the media panel and the search panel actually read.
 */
export function useHistoryBackfill({roomId, loadOlderUntilDone}: Options): void {
  const abortRef = useRef<AbortController | null>(null);
  const setBackfill = useChatPanelStore((s) => s.setBackfill);

  const start = useCallback(() => {
    // Already running: the second asker just watches the same progress.
    if (abortRef.current) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setBackfill(roomId, {phase: 'running', pagesLoaded: 0, error: undefined});

    loadOlderUntilDone({
      signal: controller.signal,
      onPage: (pagesLoaded) => setBackfill(roomId, {phase: 'running', pagesLoaded}),
    })
      .then((outcome) => setBackfill(roomId, {phase: outcome}))
      .catch((e: unknown) =>
        setBackfill(roomId, {
          phase: 'error',
          error: e instanceof Error ? e.message : String(e),
        }),
      )
      .finally(() => {
        abortRef.current = null;
      });
  }, [roomId, loadOlderUntilDone, setBackfill]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => registerBackfillRunner(roomId, {start, cancel}), [roomId, start, cancel]);

  // Leaving the room stops the pull; nothing is left fetching in the
  // background for a conversation nobody is looking at.
  useEffect(() => () => abortRef.current?.abort(), []);
}
```

Note the outcome mapping is direct: `runBackfill` returns `"complete" | "cancelled" | "capped"`, all of which are valid `BackfillPhase` values.

- [ ] **Step 2: Verify types**

```bash
pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/hooks/useHistoryBackfill.ts
git commit -m "feat(chat): expose a room's history backfill to the side panels"
```

---

## Task 17: Jump to and highlight a message

**Files:**
- Modify: `src/modules/chat/components/ChatRoomMessages/index.tsx`
- Modify: `src/modules/chat/components/ChatMessageBubble/index.tsx`

**Interfaces:**
- Consumes: `useChatPanelStore` (Task 13).
- Produces: `ChatMessageItem` accepts `isHighlighted?: boolean`.

- [ ] **Step 1: Act on a pending jump in the message list**

In `src/modules/chat/components/ChatRoomMessages/index.tsx`, add the import:

```ts
import {useChatPanelStore} from "@/modules/chat/store/chatPanelStore";
```

Inside the component, after `const [isAtBottom, setIsAtBottom] = React.useState(true);`, add:

```tsx
    const pendingJumpMessageId = useChatPanelStore((s) => s.pendingJumpMessageId);
    const highlightedMessageId = useChatPanelStore((s) => s.highlightedMessageId);

    // A jump can arrive before the message it names is in `data` -- the panel
    // that asked may still be backfilling the page it lives on. Leaving the
    // request pending and re-running on `data` is what makes it land once the
    // page arrives, instead of silently doing nothing.
    React.useEffect(() => {
        if (!pendingJumpMessageId) return;

        const index = data.findIndex((m) => String((m as any)?.id) === pendingJumpMessageId);
        if (index < 0) return;

        const {consumeJump, setHighlight, clearHighlight} = useChatPanelStore.getState();
        consumeJump();

        virtuosoRef.current?.scrollToIndex({index, behavior: 'smooth', align: 'center'});
        setHighlight(pendingJumpMessageId);

        const timer = setTimeout(() => clearHighlight(), 2000);
        return () => clearTimeout(timer);
    }, [pendingJumpMessageId, data]);
```

Then pass the flag down in `itemContent` — replace the `<ChatMessageItem .../>` line:

```tsx
                <ChatMessageItem
                    message={msg}
                    partnerAvatar={partnerAvatar}
                    partnerId={partnerId}
                    isHighlighted={highlightedMessageId === String((msg as any)?.id)}
                />
```

and add `highlightedMessageId` to that `useCallback`'s dependency array:

```tsx
    }, [data, currentLocale, partnerAvatar, partnerId, highlightedMessageId]);
```

- [ ] **Step 2: Render the highlight on the bubble**

In `src/modules/chat/components/ChatMessageBubble/index.tsx`, extend the props interface:

```ts
interface ChatMessageItemProps {
    message: ChatMessage;
    partnerAvatar?: string | StaticImageData;
    partnerId: LocalUserId;
    /** Briefly ringed after the user jumped here from search or media. */
    isHighlighted?: boolean;
}
```

Destructure it in the component signature (`isHighlighted = false`), then apply it to the outermost wrapper — replace the opening `<div>` of the return:

```tsx
        <div
            data-testid="chat-message"
            data-status={viewMsg.status}
            className={`flex ${isIncoming ? "justify-start" : "justify-end"} ${
                isHighlighted
                    // A static ring rather than a keyframe pulse, so this needs
                    // no prefers-reduced-motion special case.
                    ? "rounded-xl ring-2 ring-amber-400 ring-offset-2 ring-offset-white"
                    : ""
            }`}
        >
```

- [ ] **Step 3: Verify types and the suite**

```bash
pnpm exec tsc --noEmit 2>&1 | head -20
pnpm test:unit 2>&1 | tail -6
```

Expected: no type errors; suite still green.

- [ ] **Step 4: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/components/ChatRoomMessages/index.tsx src/modules/chat/components/ChatMessageBubble/index.tsx
git commit -m "feat(chat): jump to a message and ring it briefly"
```

---

## Task 18: Render video attachments as video

**Files:**
- Modify: `src/modules/chat/components/ChatMessageBubble/index.tsx`

**Interfaces:**
- Consumes: `parseAttachment` (Task 4).

- [ ] **Step 1: Parse the attachment with the shared module**

Add the import:

```ts
import {parseAttachment} from "@/modules/chat/attachments";
```

After the existing `const isFileMsg = parsed && parsed.type === "file";` line, add:

```ts
    // The generic `parsed` memo above still serves the workflow cards; this is
    // the one place a file envelope is read, and it is the same reader the
    // media panel uses, so the two cannot drift.
    const attachment = useMemo(
        () => (isFileMsg ? parseAttachment(viewMsg?.content) : null),
        [isFileMsg, viewMsg?.content],
    );
```

- [ ] **Step 2: Replace the file branch's thumbnail with a kind-aware one**

Inside the `isFileMsg ?` branch, replace the whole `{String((parsed as any)?.mime || "").startsWith("image/") && (parsed as any)?.url ? (…) : (…)}` conditional with:

```tsx
                                {attachment?.kind === "image" ? (
                                    <a
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block flex-shrink-0"
                                    >
                                        <img
                                            src={attachment.url}
                                            alt={attachment.name}
                                            className="w-16 h-16 object-cover rounded-md ring-1 ring-black/5"
                                        />
                                    </a>
                                ) : attachment?.kind === "video" ? (
                                    <video
                                        src={attachment.url}
                                        controls
                                        preload="metadata"
                                        // Never autoplay: a room full of clips
                                        // would all start talking at once.
                                        className="w-40 sm:w-56 rounded-md ring-1 ring-black/5 bg-black"
                                    >
                                        {t("profileChat.mediaPanel.videoUnsupported")}
                                    </video>
                                ) : (
                                    <div
                                        className="w-12 h-12 rounded-md flex items-center justify-center bg-white ring-1 ring-black/5 text-gray-600"
                                        aria-hidden
                                    >
                                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                            <path
                                                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM8 18h8v2H8v-2zm0-4h8v2H8v-2zm6-7v5h5"
                                            />
                                        </svg>
                                    </div>
                                )}
```

Then, in the same branch, replace the remaining `(parsed as any)?.name`, `(parsed as any).url`, `(parsed as any)?.mime` and `(parsed as any)?.caption` reads with `attachment?.name`, `attachment?.url`, `attachment?.mime` and `attachment?.caption`, guarding the whole inner block on `attachment` being non-null.

- [ ] **Step 3: Verify**

```bash
pnpm exec tsc --noEmit 2>&1 | head -20
pnpm lint 2>&1 | tail -10
pnpm test:unit 2>&1 | tail -6
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/components/ChatMessageBubble/index.tsx
git commit -m "feat(chat): show a video attachment as video, not a file card"
```

---

## Task 19: The media panel and the sidebar tabs

**Files:**
- Create: `src/modules/chat/components/ChatMediaPanel/MediaStates.tsx`
- Create: `src/modules/chat/components/ChatMediaPanel/MediaLightbox.tsx`
- Create: `src/modules/chat/components/ChatMediaPanel/MediaGrid.tsx`
- Create: `src/modules/chat/components/ChatMediaPanel/MediaFileList.tsx`
- Create: `src/modules/chat/components/ChatMediaPanel/index.tsx`
- Create: `src/modules/chat/components/ChatSidebarTabs/index.tsx`
- Modify: `src/modules/chat/components/ChatRoomView/index.tsx`

**Interfaces:**
- Consumes: `collectAttachments`/`AttachmentItem` (Task 5), `useChatPanelStore`/`selectBackfill`/`startBackfill`/`cancelBackfill` (Task 13), `useHistoryBackfill` (Task 16), translations (Task 15).
- Produces: `<ChatSidebarTabs roomId partnerName orders={ReactNode} />`.

**Store subscription rule (get this wrong and the panel loops):** select the array itself with a module-level constant fallback, never a fresh `[]` per call:

```ts
const NO_MESSAGES: ChatMessage[] = [];
const messages = useChatStore((s) => s.messagesByRoom[roomId] ?? NO_MESSAGES);
```

- [ ] **Step 1: Write the shared state blocks**

Create `src/modules/chat/components/ChatMediaPanel/MediaStates.tsx`:

```tsx
"use client";

import React from "react";
import {useTranslation} from "react-i18next";

/** Centred, quiet block used for every non-content state in the panel. */
export const MediaNotice: React.FC<{children: React.ReactNode}> = ({children}) => (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-gray-500">
        {children}
    </div>
);

export const MediaEmpty: React.FC<{messageKey: string}> = ({messageKey}) => {
    const {t} = useTranslation();
    return <MediaNotice>{t(messageKey)}</MediaNotice>;
};

export const MediaError: React.FC<{onRetry: () => void}> = ({onRetry}) => {
    const {t} = useTranslation();
    return (
        <MediaNotice>
            <p role="alert">{t("profileChat.mediaPanel.error")}</p>
            <button
                type="button"
                onClick={onRetry}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-[#063a68] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {t("profileChat.mediaPanel.retry")}
            </button>
        </MediaNotice>
    );
};

/** The progressive-history banner: what is happening, and how to stop it. */
export const MediaBackfillBanner: React.FC<{
    phase: "running" | "capped";
    onCancel: () => void;
}> = ({phase, onCancel}) => {
    const {t} = useTranslation();

    if (phase === "capped") {
        return (
            <p className="px-3 py-2 text-xs text-gray-600 bg-amber-50 border-b border-amber-100">
                {t("profileChat.mediaPanel.partial")}
            </p>
        );
    }

    return (
        <div
            className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-gray-600 bg-blue-50 border-b border-blue-100"
            role="status"
            aria-live="polite"
        >
            <span>{t("profileChat.mediaPanel.loadingOlder")}</span>
            <button
                type="button"
                onClick={onCancel}
                className="rounded px-2 py-1 font-medium text-primary hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {t("profileChat.mediaPanel.stopLoading")}
            </button>
        </div>
    );
};
```

- [ ] **Step 2: Write the lightbox**

Create `src/modules/chat/components/ChatMediaPanel/MediaLightbox.tsx`:

```tsx
"use client";

import React from "react";
import {useTranslation} from "react-i18next";
import {X} from "lucide-react";

import type {AttachmentItem} from "@/modules/chat/attachments";

type Props = {
    item: AttachmentItem;
    onClose: () => void;
    onJump: (messageId: string) => void;
};

/**
 * Full-size viewer for one image or video.
 *
 * Video is `controls` + `preload="metadata"` and never autoplays — opening a
 * viewer is not the same as asking for sound.
 */
export const MediaLightbox: React.FC<Props> = ({item, onClose, onJump}) => {
    const {t} = useTranslation();
    const closeRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        closeRef.current?.focus();
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col bg-black/90"
            role="dialog"
            aria-modal="true"
            aria-label={item.attachment.name}
        >
            <div className="flex items-center justify-between gap-2 p-3">
                <p className="min-w-0 flex-1 truncate text-sm text-white">{item.attachment.name}</p>
                <button
                    type="button"
                    onClick={() => onJump(item.messageId)}
                    className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
                >
                    {t("profileChat.mediaPanel.jumpToMessage")}
                </button>
                <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label={t("profileChat.mediaPanel.closeViewer")}
                    className="rounded-md p-2 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="flex flex-1 items-center justify-center overflow-auto p-4">
                {item.attachment.kind === "video" ? (
                    <video
                        src={item.attachment.url}
                        controls
                        preload="metadata"
                        className="max-h-full max-w-full"
                    >
                        {t("profileChat.mediaPanel.videoUnsupported")}
                    </video>
                ) : (
                    <img
                        src={item.attachment.url}
                        alt={item.attachment.name}
                        className="max-h-full max-w-full object-contain"
                    />
                )}
            </div>
        </div>
    );
};
```

- [ ] **Step 3: Write the grid**

Create `src/modules/chat/components/ChatMediaPanel/MediaGrid.tsx`:

```tsx
"use client";

import React from "react";
import {useTranslation} from "react-i18next";
import {Play} from "lucide-react";

import type {AttachmentItem} from "@/modules/chat/attachments";

import {MediaEmpty} from "./MediaStates";

type Props = {
    items: AttachmentItem[];
    onOpen: (item: AttachmentItem) => void;
    onJump: (messageId: string) => void;
};

/** One tile. Falls back to a plain label when the bytes will not render. */
const Tile: React.FC<{item: AttachmentItem; onOpen: () => void; onJump: () => void}> = ({
    item,
    onOpen,
    onJump,
}) => {
    const {t} = useTranslation();
    const [failed, setFailed] = React.useState(false);
    const isVideo = item.attachment.kind === "video";

    return (
        // `group` belongs on the li, not the tile button: the jump control is
        // the button's sibling, so a group on the button would never reach it.
        <li className="group relative">
            <button
                type="button"
                onClick={onOpen}
                aria-label={item.attachment.name}
                className="block aspect-square w-full overflow-hidden rounded-md bg-gray-100 ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {failed ? (
                    <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-gray-500">
                        {t("profileChat.mediaPanel.thumbnailFailed")}
                    </span>
                ) : isVideo ? (
                    // preload="metadata" gives a first frame without pulling
                    // the whole clip down for a thumbnail nobody may open.
                    <video
                        src={item.attachment.url}
                        preload="metadata"
                        muted
                        onError={() => setFailed(true)}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <img
                        src={item.attachment.url}
                        alt=""
                        onError={() => setFailed(true)}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                )}
            </button>

            {isVideo && !failed && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white"
                >
                    <Play className="h-4 w-4" />
                </span>
            )}

            <button
                type="button"
                onClick={onJump}
                title={t("profileChat.mediaPanel.jumpToMessage")}
                aria-label={`${t("profileChat.mediaPanel.jumpToMessage")}: ${item.attachment.name}`}
                className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white group-hover:opacity-100 hover:opacity-100"
            >
                ↗
            </button>
        </li>
    );
};

export const MediaGrid: React.FC<Props> = ({items, onOpen, onJump}) => {
    if (items.length === 0) {
        return <MediaEmpty messageKey="profileChat.mediaPanel.emptyImageVideo" />;
    }

    return (
        <ul className="grid grid-cols-3 gap-1.5 p-2 sm:gap-2 sm:p-3">
            {items.map((item) => (
                <Tile
                    key={item.messageId}
                    item={item}
                    onOpen={() => onOpen(item)}
                    onJump={() => onJump(item.messageId)}
                />
            ))}
        </ul>
    );
};
```

- [ ] **Step 4: Write the file list**

Create `src/modules/chat/components/ChatMediaPanel/MediaFileList.tsx`:

```tsx
"use client";

import React from "react";
import {useTranslation} from "react-i18next";
import {FileText} from "lucide-react";

import type {AttachmentItem} from "@/modules/chat/attachments";
import {formatDateToLong} from "@/utils";
import {getLocale} from "@/utils/date";

import {MediaEmpty} from "./MediaStates";

type Props = {
    items: AttachmentItem[];
    partnerName: string;
    onJump: (messageId: string) => void;
};

/** Short type badge: the mime's subtype, or the filename's extension. */
function typeLabel(name: string, mime?: string): string {
    if (mime) {
        const subtype = mime.split("/").pop();
        if (subtype) return subtype.toUpperCase();
    }
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1).toUpperCase() : "";
}

export const MediaFileList: React.FC<Props> = ({items, partnerName, onJump}) => {
    const {t, i18n} = useTranslation();

    if (items.length === 0) {
        return <MediaEmpty messageKey="profileChat.mediaPanel.emptyFiles" />;
    }

    return (
        <ul className="divide-y divide-gray-100">
            {items.map((item) => (
                <li key={item.messageId} className="flex items-start gap-3 px-3 py-3">
                    <span
                        aria-hidden
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500"
                    >
                        <FileText className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900" title={item.attachment.name}>
                            {item.attachment.name}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                            <span>{typeLabel(item.attachment.name, item.attachment.mime)}</span>
                            <span aria-hidden> · </span>
                            {/* A date, not a time: these are files from across
                                the whole conversation, so "14:32" alone says
                                nothing about which day it landed. */}
                            <span>{formatDateToLong(item.createdAt, getLocale(i18n?.language))}</span>
                            <span aria-hidden> · </span>
                            <span>
                                {t("profileChat.mediaPanel.sentBy", {
                                    name: item.isOwner ? t("profileChat.mediaPanel.you") : partnerName,
                                })}
                            </span>
                        </p>

                        <div className="mt-1.5 flex items-center gap-3">
                            <a
                                href={item.attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            >
                                {t("profileChat.mediaPanel.openItem")}
                            </a>
                            <button
                                type="button"
                                onClick={() => onJump(item.messageId)}
                                className="text-xs font-medium text-gray-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            >
                                {t("profileChat.mediaPanel.jumpToMessage")}
                            </button>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
};
```

- [ ] **Step 5: Write the panel that owns the nested tabs**

Create `src/modules/chat/components/ChatMediaPanel/index.tsx`:

```tsx
"use client";

import type {ChatMessage} from "108heros-client";
import React from "react";
import {useTranslation} from "react-i18next";

import {collectAttachments, type AttachmentItem} from "@/modules/chat/attachments";
import {useChatStore} from "@/modules/chat/store/chatStore";
import {
    cancelBackfill,
    selectBackfill,
    startBackfill,
    useChatPanelStore,
    type MediaTab,
} from "@/modules/chat/store/chatPanelStore";

import {MediaFileList} from "./MediaFileList";
import {MediaGrid} from "./MediaGrid";
import {MediaLightbox} from "./MediaLightbox";
import {MediaBackfillBanner, MediaError, MediaNotice} from "./MediaStates";

/** Stable empty array — returning a fresh `[]` from the selector on every read
 *  would make zustand see a new value each render and loop. */
const NO_MESSAGES: ChatMessage[] = [];

const TABS: Array<{id: MediaTab; labelKey: string}> = [
    {id: "imageVideo", labelKey: "profileChat.mediaPanel.imageVideo"},
    {id: "files", labelKey: "profileChat.mediaPanel.files"},
];

type Props = {roomId: string; partnerName: string};

export const ChatMediaPanel: React.FC<Props> = ({roomId, partnerName}) => {
    const {t} = useTranslation();
    const messages = useChatStore((s) => s.messagesByRoom[roomId] ?? NO_MESSAGES);
    const mediaTab = useChatPanelStore((s) => s.mediaTab);
    const setMediaTab = useChatPanelStore((s) => s.setMediaTab);
    const requestJump = useChatPanelStore((s) => s.requestJump);
    const backfill = useChatPanelStore(selectBackfill(roomId));

    const [viewing, setViewing] = React.useState<AttachmentItem | null>(null);

    // Opening Media pulls the rest of the room's history, so the panel shows
    // everything rather than only what the user happened to scroll past.
    // Search shares this runner, so if it already ran this is instant.
    React.useEffect(() => {
        if (backfill.phase === "idle") startBackfill(roomId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    const items = React.useMemo(() => collectAttachments(messages), [messages]);
    const gridItems = React.useMemo(
        () => items.filter((i) => i.attachment.kind !== "file"),
        [items],
    );
    const fileItems = React.useMemo(
        () => items.filter((i) => i.attachment.kind === "file"),
        [items],
    );

    const onJump = React.useCallback(
        (messageId: string) => {
            setViewing(null);
            requestJump(messageId);
        },
        [requestJump],
    );

    const onTabKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const index = TABS.findIndex((tab) => tab.id === mediaTab);
        const next = e.key === "ArrowRight" ? index + 1 : index - 1;
        setMediaTab(TABS[(next + TABS.length) % TABS.length].id);
    };

    const isFirstLoad = backfill.phase === "running" && items.length === 0;

    return (
        <div className="flex h-full flex-col">
            <div
                role="tablist"
                aria-label={t("profileChat.media")}
                onKeyDown={onTabKeyDown}
                className="flex border-b border-gray-200 px-2"
            >
                {TABS.map((tab) => {
                    const selected = tab.id === mediaTab;
                    return (
                        <button
                            key={tab.id}
                            id={`media-tab-${tab.id}`}
                            role="tab"
                            type="button"
                            aria-selected={selected}
                            aria-controls={`media-panel-${tab.id}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => setMediaTab(tab.id)}
                            className={`mr-4 border-b-2 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                selected
                                    ? "border-primary text-primary"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            {t(tab.labelKey)}
                        </button>
                    );
                })}
            </div>

            {(backfill.phase === "running" || backfill.phase === "capped") && (
                <MediaBackfillBanner
                    phase={backfill.phase}
                    onCancel={() => cancelBackfill(roomId)}
                />
            )}

            <div
                id={`media-panel-${mediaTab}`}
                role="tabpanel"
                aria-labelledby={`media-tab-${mediaTab}`}
                tabIndex={0}
                className="flex-1 overflow-y-auto focus:outline-none"
            >
                {backfill.phase === "error" && items.length === 0 ? (
                    <MediaError onRetry={() => startBackfill(roomId)} />
                ) : isFirstLoad ? (
                    <MediaNotice>{t("profileChat.mediaPanel.loading")}</MediaNotice>
                ) : mediaTab === "imageVideo" ? (
                    <MediaGrid items={gridItems} onOpen={setViewing} onJump={onJump} />
                ) : (
                    <MediaFileList items={fileItems} partnerName={partnerName} onJump={onJump} />
                )}
            </div>

            {viewing && (
                <MediaLightbox item={viewing} onClose={() => setViewing(null)} onJump={onJump} />
            )}
        </div>
    );
};

export default ChatMediaPanel;
```

- [ ] **Step 6: Write the top-level tabs**

Create `src/modules/chat/components/ChatSidebarTabs/index.tsx`:

```tsx
"use client";

import React from "react";
import {useTranslation} from "react-i18next";

import ChatMediaPanel from "@/modules/chat/components/ChatMediaPanel";
import {useChatPanelStore, type SidebarTab} from "@/modules/chat/store/chatPanelStore";

const TABS: Array<{id: SidebarTab; labelKey: string}> = [
    {id: "orders", labelKey: "profileChat.orders"},
    {id: "media", labelKey: "profileChat.media"},
];

type Props = {
    roomId: string;
    partnerName: string;
    /** The existing job-flow panel, rendered verbatim under Orders. */
    orders: React.ReactNode;
};

/**
 * Orders and Media as siblings inside the sidebar container that already
 * exists. Orders is the panel that was always here; nothing about it changes.
 */
export const ChatSidebarTabs: React.FC<Props> = ({roomId, partnerName, orders}) => {
    const {t} = useTranslation();
    const sidebarTab = useChatPanelStore((s) => s.sidebarTab);
    const setSidebarTab = useChatPanelStore((s) => s.setSidebarTab);

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const index = TABS.findIndex((tab) => tab.id === sidebarTab);
        const next = e.key === "ArrowRight" ? index + 1 : index - 1;
        setSidebarTab(TABS[(next + TABS.length) % TABS.length].id);
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div
                role="tablist"
                aria-label={t("profileChat.jobFlow")}
                onKeyDown={onKeyDown}
                className="flex flex-shrink-0 border-b border-blue-100 bg-blue-50 px-3 sm:px-4"
            >
                {TABS.map((tab) => {
                    const selected = tab.id === sidebarTab;
                    return (
                        <button
                            key={tab.id}
                            id={`sidebar-tab-${tab.id}`}
                            role="tab"
                            type="button"
                            aria-selected={selected}
                            aria-controls={`sidebar-panel-${tab.id}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => setSidebarTab(tab.id)}
                            className={`mr-6 border-b-2 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-base ${
                                selected
                                    ? "border-primary text-primary"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            {t(tab.labelKey)}
                        </button>
                    );
                })}
            </div>

            <div
                id={`sidebar-panel-${sidebarTab}`}
                role="tabpanel"
                aria-labelledby={`sidebar-tab-${sidebarTab}`}
                className="flex min-h-0 flex-1 flex-col"
            >
                {sidebarTab === "orders" ? (
                    orders
                ) : (
                    <ChatMediaPanel roomId={roomId} partnerName={partnerName} />
                )}
            </div>
        </div>
    );
};

export default ChatSidebarTabs;
```

- [ ] **Step 7: Wire it into `ChatRoomView`**

Add the imports:

```ts
import ChatSidebarTabs from "@/modules/chat/components/ChatSidebarTabs";
import {useHistoryBackfill} from "@/modules/chat/hooks/useHistoryBackfill";
```

Destructure the new action from the history hook — change:

```ts
    const {
        state: {hasMore, isFetching},
        actions: {fetchHistory, loadOlderUntilDone},
    } = useChatHistory({
```

Register the runner, immediately after that hook call:

```ts
    useHistoryBackfill({roomId, loadOlderUntilDone});
```

Then wrap the sidebar content — in the `useLayoutEffect` that calls `setContent`, replace the `setContent(...)` argument:

```tsx
        setContent(
            <ChatSidebarTabs
                roomId={roomId}
                partnerName={partnerName || "User"}
                orders={
                    <JobFlowContent
                        setIsFlowOpen={setIsFlowOpen}
                        renderFlowContent={renderFlowContent}
                        setShowJobDetailModal={setShowJobDetailModal}
                        currentRoom={currentRoom}
                    />
                }
            />
        );
```

and add `roomId` and `partnerName` to that effect's dependency array.

- [ ] **Step 8: Verify**

```bash
pnpm exec tsc --noEmit 2>&1 | head -20
pnpm lint 2>&1 | tail -10
pnpm test:unit 2>&1 | tail -6
```

Expected: clean, suite green.

- [ ] **Step 9: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/components/ChatMediaPanel/ src/modules/chat/components/ChatSidebarTabs/ src/modules/chat/components/ChatRoomView/index.tsx
git commit -m "feat(chat): a Media tab beside Orders in the room sidebar"
```

---

## Task 20: Header search and the search panel

**Files:**
- Create: `src/modules/chat/components/ChatSearchPanel/SearchResultItem.tsx`
- Create: `src/modules/chat/components/ChatSearchPanel/index.tsx`
- Modify: `src/modules/chat/components/ChatHeader/index.tsx`
- Modify: `src/modules/chat/components/ChatRoomView/index.tsx`

**Interfaces:**
- Consumes: `searchMessages`/`SearchHit` (Task 14), `useChatPanelStore` (Task 13), backfill controls (Tasks 13/16), translations (Task 15).
- Produces: `<ChatSearchPanel roomId partnerName />`; `ChatHeader` gains `onToggleSearch?: () => void` and `isSearchOpen?: boolean`.

- [ ] **Step 1: Write the result row**

Create `src/modules/chat/components/ChatSearchPanel/SearchResultItem.tsx`:

```tsx
"use client";

import React from "react";
import {useTranslation} from "react-i18next";

import type {SearchHit} from "@/modules/chat/search/searchMessages";
import {formatDateToLong} from "@/utils";
import {getLocale, toLocalTime} from "@/utils/date";

type Props = {hit: SearchHit; partnerName: string; onSelect: (messageId: string) => void};

export const SearchResultItem: React.FC<Props> = ({hit, partnerName, onSelect}) => {
    const {t, i18n} = useTranslation();

    const before = hit.snippet.slice(0, hit.matchStart);
    const match = hit.snippet.slice(hit.matchStart, hit.matchStart + hit.matchLength);
    const after = hit.snippet.slice(hit.matchStart + hit.matchLength);

    return (
        <li>
            <button
                type="button"
                onClick={() => onSelect(hit.messageId)}
                className="w-full px-3 py-2.5 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
                <p className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">
                        {hit.isOwner ? t("profileChat.mediaPanel.you") : partnerName}
                    </span>
                    {/* Date and time both: a result may be from any point in
                        the conversation, so the time alone does not place it. */}
                    <span>{formatDateToLong(hit.createdAt, getLocale(i18n?.language))}</span>
                    <span>{toLocalTime(hit.createdAt, i18n?.language || "th-TH")}</span>
                </p>
                <p className="mt-0.5 break-words text-sm text-gray-800">
                    {before}
                    <mark className="rounded bg-amber-200 px-0.5 text-gray-900">{match}</mark>
                    {after}
                </p>
            </button>
        </li>
    );
};
```

- [ ] **Step 2: Write the panel**

Create `src/modules/chat/components/ChatSearchPanel/index.tsx`:

```tsx
"use client";

import type {ChatMessage} from "108heros-client";
import React from "react";
import {useTranslation} from "react-i18next";
import {Search, X} from "lucide-react";

import {searchMessages} from "@/modules/chat/search/searchMessages";
import {useChatStore} from "@/modules/chat/store/chatStore";
import {
    cancelBackfill,
    selectBackfill,
    startBackfill,
    useChatPanelStore,
} from "@/modules/chat/store/chatPanelStore";

import {SearchResultItem} from "./SearchResultItem";

/** Stable empty array; see the note in ChatMediaPanel. */
const NO_MESSAGES: ChatMessage[] = [];
const DEBOUNCE_MS = 250;

type Props = {roomId: string; partnerName: string};

/**
 * Search within the open room.
 *
 * There is no server-side search and cannot be one: message content reaches
 * the server encrypted. So this runs over what `chatStore` holds — and starts
 * pulling the rest of the room's history the moment there is a query, because
 * otherwise "no results" would only ever mean "not in the pages you scrolled".
 */
export const ChatSearchPanel: React.FC<Props> = ({roomId, partnerName}) => {
    const {t} = useTranslation();
    const [rawQuery, setRawQuery] = React.useState("");
    const [query, setQuery] = React.useState("");

    const messages = useChatStore((s) => s.messagesByRoom[roomId] ?? NO_MESSAGES);
    const closeSearch = useChatPanelStore((s) => s.closeSearch);
    const requestJump = useChatPanelStore((s) => s.requestJump);
    const backfill = useChatPanelStore(selectBackfill(roomId));

    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useEffect(() => inputRef.current?.focus(), []);

    React.useEffect(() => {
        const timer = setTimeout(() => setQuery(rawQuery), DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [rawQuery]);

    // Only once there is something to search for -- opening the box should not
    // pull a year of history on its own.
    React.useEffect(() => {
        if (query.trim() && backfill.phase === "idle") startBackfill(roomId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, roomId]);

    const hits = React.useMemo(() => searchMessages(messages, query), [messages, query]);

    const onSelect = React.useCallback(
        (messageId: string) => {
            requestJump(messageId);
            if (typeof window !== "undefined" && window.innerWidth < 640) closeSearch();
        },
        [requestJump, closeSearch],
    );

    const trimmed = query.trim();
    const isSearchingOlder = Boolean(trimmed) && backfill.phase === "running";

    return (
        <div className="absolute inset-x-0 top-0 z-30 flex max-h-[70%] flex-col border-b bg-white shadow-lg">
            <div className="flex items-center gap-2 border-b px-3 py-2">
                <Search className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
                <input
                    ref={inputRef}
                    type="search"
                    value={rawQuery}
                    onChange={(e) => setRawQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                    placeholder={t("profileChat.roomSearch.placeholder")}
                    aria-label={t("profileChat.roomSearch.placeholder")}
                    className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
                />
                <button
                    type="button"
                    onClick={closeSearch}
                    aria-label={t("profileChat.roomSearch.close")}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {isSearchingOlder && (
                <div
                    className="flex items-center justify-between gap-2 border-b border-blue-100 bg-blue-50 px-3 py-2 text-xs text-gray-600"
                    role="status"
                    aria-live="polite"
                >
                    <span>{t("profileChat.roomSearch.searchingOlder")}</span>
                    <button
                        type="button"
                        onClick={() => cancelBackfill(roomId)}
                        className="rounded px-2 py-1 font-medium text-primary hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {t("profileChat.roomSearch.stopSearching")}
                    </button>
                </div>
            )}

            {trimmed && backfill.phase === "capped" && (
                <p className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-gray-600">
                    {t("profileChat.roomSearch.partial")}
                </p>
            )}

            {trimmed && backfill.phase === "error" && (
                <p className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
                    {t("profileChat.roomSearch.error")}
                </p>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto">
                {!trimmed ? (
                    <p className="px-3 py-6 text-center text-sm text-gray-500">
                        {t("profileChat.roomSearch.hint")}
                    </p>
                ) : hits.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-gray-500">
                        {isSearchingOlder
                            ? t("profileChat.roomSearch.searching")
                            : t("profileChat.roomSearch.noResults", {query: trimmed})}
                    </p>
                ) : (
                    <>
                        <p className="px-3 pt-2 text-xs text-gray-500" role="status" aria-live="polite">
                            {t("profileChat.roomSearch.resultCount", {count: hits.length})}
                        </p>
                        <ul aria-label={t("profileChat.roomSearch.results")}>
                            {hits.map((hit) => (
                                <SearchResultItem
                                    key={hit.messageId}
                                    hit={hit}
                                    partnerName={partnerName}
                                    onSelect={onSelect}
                                />
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatSearchPanel;
```

- [ ] **Step 3: Add the header control**

In `src/modules/chat/components/ChatHeader/index.tsx`, add `Search` to the lucide import, extend the props:

```ts
interface ChatHeaderProps {
    avatarUrl?: string;
    displayName: string;
    partnerId: LocalUserId;
    typingText?: string;
    onToggleFlow?: () => void;
    isFlowOpen?: boolean;
    onToggleSearch?: () => void;
    isSearchOpen?: boolean;
}
```

Destructure `onToggleSearch` and `isSearchOpen`, add `useTranslation`, and put the button first inside the right-hand `<div className="flex items-center gap-2">`:

```tsx
                <button
                    type="button"
                    onClick={onToggleSearch}
                    aria-label={t("profileChat.roomSearch.open")}
                    aria-expanded={Boolean(isSearchOpen)}
                    className={`rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isSearchOpen ? "bg-gray-100 text-primary" : "text-gray-600 hover:bg-gray-100"
                    }`}
                >
                    <Search className="h-5 w-5" />
                </button>
```

- [ ] **Step 4: Wire it into `ChatRoomView`**

Add the imports:

```ts
import ChatSearchPanel from "@/modules/chat/components/ChatSearchPanel";
import {useChatPanelStore} from "@/modules/chat/store/chatPanelStore";
```

Inside the component:

```ts
    const isSearchOpen = useChatPanelStore((s) => s.isSearchOpen);
    const openSearch = useChatPanelStore((s) => s.openSearch);
    const closeSearch = useChatPanelStore((s) => s.closeSearch);
```

Pass the props to `ChatHeader`:

```tsx
                        onToggleSearch={() => (isSearchOpen ? closeSearch() : openSearch())}
                        isSearchOpen={isSearchOpen}
```

The panel is absolutely positioned, so its container needs to be a positioning context. Change the message-area wrapper and render the panel inside it — replace:

```tsx
                    <ChatRoomMessages
```

with:

```tsx
                    <div className="relative flex min-h-0 flex-1 flex-col">
                        {isSearchOpen && (
                            <ChatSearchPanel roomId={roomId} partnerName={partnerName || "User"} />
                        )}
                        <ChatRoomMessages
```

and close the new wrapper `</div>` immediately after `ChatRoomMessages`'s closing tag.

Finally, close search when the room changes so it does not carry a stale query across conversations:

```ts
    useEffect(() => () => closeSearch(), [roomId, closeSearch]);
```

- [ ] **Step 5: Verify**

```bash
pnpm exec tsc --noEmit 2>&1 | head -20
pnpm lint 2>&1 | tail -10
pnpm test:unit 2>&1 | tail -6
```

Expected: clean, suite green.

- [ ] **Step 6: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/modules/chat/components/ChatSearchPanel/ src/modules/chat/components/ChatHeader/index.tsx src/modules/chat/components/ChatRoomView/index.tsx
git commit -m "feat(chat): search within the open conversation"
```

---

## Task 21: Full verification

**Files:** none changed unless a check fails.

- [ ] **Step 1: Frontend**

```bash
cd /Users/koeyl/108-ecosystem/108heros/108heros-clean/.worktrees/chat-media-search
pnpm test:unit 2>&1 | tail -8
pnpm lint 2>&1 | tail -10
pnpm build 2>&1 | tail -20
```

Expected: all three succeed. The suite must be **at least** 18 files / 160 tests plus the new ones (7 new test files, ~54 new tests).

- [ ] **Step 2: Backend — bring up a clean database**

```bash
cd /Users/koeyl/108-ecosystem/108heros/api-108jobs/.worktrees/chat-attachment-asset-id
export app_108heros_DATABASE_URL="postgres://app_108heros:password@localhost:5432/app_108heros"
export DATABASE_URL="$app_108heros_DATABASE_URL"
export app_108heros_CONFIG_LOCATION="$PWD/config/config.ci.hjson"
export app_108heros_TEST_FAST_FEDERATION=1
```

Read `api-108jobs/CLAUDE.md` before running these — it documents the exact database bring-up, why the config path must be absolute, and why `--profile ci` (which pins `test-threads = 1`) is not optional.

- [ ] **Step 3: Backend — the three gates**

```bash
RUSTFMT="$(rustup which --toolchain nightly rustfmt)" cargo +nightly fmt --all -- --check
cargo clippy --workspace --tests --all-targets -- -D warnings
cargo nextest run --workspace --no-fail-fast --profile ci 2>&1 | tail -20
```

Never a bare `cargo fmt --all` — `rust-toolchain.toml` pins stable and the config needs nightly. The `RUSTFMT=` prefix is the whole fix.

- [ ] **Step 4: Report**

Report, with actual command output rather than a summary:

1. every file changed, per repo;
2. the final attachment wire contract;
3. how encrypted-history search works and what it shows while loading;
4. the commands run and their results;
5. the deliberate limitations from the spec's final section.

---

## Self-Review

**Spec coverage.** Sidebar Orders/Media tabs → Task 19. Nested Image & Video / Files → Task 19. Header search → Task 20. Shared attachment module reused by bubble and panel → Tasks 3-6, 18, 19. Legacy attachments preserved → Task 3's extension fallback, Task 4's no-`assetId` case. Video rendered as video in chat → Task 18. Newest first → Task 5. Lightbox, no autoplay, file metadata, jump-to-message → Tasks 17, 19. Loading/empty/error/progressive states → Tasks 19, 20. Original filename preserved separately from the asset id → Tasks 7, 8. Typed upload metadata with `assetId` → Task 7. `assetId` in the envelope, backward compatible → Tasks 6, 10. Correct MAD kind inference → Task 8. Chat uploads stay private, never a direct MAD URL → unchanged `assetUrl`, asserted by the pre-existing test kept green in Task 7. Explicit websocket attachment field → Tasks 1, 9. `media_proxy` membership preserved and tightened → Task 2. Client-side search over decrypted messages, case-insensitive, debounced, empty/no-results, jump and highlight → Tasks 14, 17, 20. Progressive authorized history with cancel → Tasks 11, 12, 16. Translations in three languages → Task 15. Unit tests for parsing, classification, search, and envelope generation → Tasks 3-8, 11, 13, 14. Component tests → deliberately omitted, with the reason recorded in Global Constraints and the spec. Generated client files → Task 9 edits one hand-written source type and rebuilds rather than editing `dist/`.

**Placeholders.** None: every code step carries the actual code, and the two places that say "follow the surrounding style" (Task 2's DB helpers, Task 9's `makeDeps`) name the exact existing test to copy from.

**Type consistency.** `AttachmentKind`, `ChatAttachment`, `AttachmentItem`, `SearchHit`, `BackfillOutcome`, `BackfillPhase`, `BackfillState`, `UploadedFile` and `UploadedAsset` are each defined once and referenced with the same names and fields throughout. `runBackfill`'s three outcomes are exactly three of `BackfillPhase`'s six values, which is what makes Task 16's direct `{phase: outcome}` assignment type-check.

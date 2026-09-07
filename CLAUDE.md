# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in
this repository.


## Bugs: open the issue before you fix it

Standing rule from the owner (2026-08-18) — **"กรณีเจอบักให้เปิด issue ก่อนทำงาน"**.

Before writing a fix, search — **including closed issues**, because a closed one is the
record that this was already resolved:

```
gh issue list --state all --search "<symptom keywords>"
```

Most repos here exist twice — `108-Plaza/<name>` and a `yuthstyle88/<name>-dev` mirror — so search **both** issue lists.

If there is none, open one **in the repo where the PR will merge** (`Fixes #N` only
auto-closes an issue in the same repo, and trunk is often the mirror, not the org copy).
Title it after the *symptom*, never the fix; label it `bug`; put the repro and the
evidence that proves it (file:line, sha, the actual response) in the body.

Then carry `Fixes #N` in the PR body so the merge closes the issue — that auto-close is
the whole resolution record. One issue per finding; a batched PR carries one `Fixes #N`
line per issue it closes.

A finding that turns out to be by-design or a false alarm still gets its issue **closed
with that reason** — that is what stops the next sweep re-investigating it. A bug you are
not fixing yet still gets an issue; deferred work with no issue is invisible work.

Narrow exceptions: something you broke and fixed inside your own unmerged branch, or a
typo in code being written this minute. Anything already merged, deployed, or reported by
the owner is a bug → issue first.

## Chat room ids arrive percent-encoded (2026-09-07)

A room id is `dm:<luid>:<luid>:post:<postId>`. **Next.js does not decode dynamic
route segments**, so the `[roomId]` param arrives as
`dm%3A8051%3A8052%3Apost%3A1305938` — from a `<Link>` click, a hard refresh and a
typed URL alike. Everything else in the app (the rooms store, API responses, the
`chat_message.room_id` column) uses the decoded form.

Always read it through `decodeRoomIdParam` (`src/modules/chat/utils/roomId.ts`),
never `params.roomId` directly.

Getting this wrong is silent, which is why it survived: the chat layout passed
the raw param to `WebSocketProvider`, so the client joined a room id matching
nothing. The join was accepted, heartbeats flowed, and every message was
addressed to a room nobody read — the UI showed "Sent" and no row was ever
written, with no error on either side. `MessageClient` decoded its own copy
inline, so the message list and the socket disagreed about which room was open.
Fixed in #134; the helper is now the single spelling for both.

## Two things that read as text but are configuration (2026-09-07)

**Category names come from the server, not only the catalogue.** Labels are
keyed off the ltree path (`0.logo_design` → `catalogs.logoDesign`), and `t()`
**echoes the key back** when there is no entry — so `|| "-"` never fires and
the raw string `catalogs.0` reaches the screen for any category added after the
translation files were written. Use `categoryLabel(t, category)`
(`src/utils/categoryLabel.ts`), which defaults to the server's `title`/`name`.
Several call sites already passed `{defaultValue: …name}` by hand; the helper
makes that uniform. Fixed in #139.

**Name a chat participant with `participantDisplayName`, never `.name`.**
`name` is the actor name, generated as `user_<8 hex>` for everyone provisioned
through Identity — i.e. everyone who signs in by phone. `displayName` rides in
the same payload. This was fixed twice (the room header in #138, then the room
list in #144, missed the first time and leaving one screen naming a person two
ways), so the rule now lives in `src/modules/chat/utils/participantName.ts`
rather than in each component's memory.

**`NEXT_PUBLIC_APP_NAME` is a display name, nothing more.** It is *not* the
auth cookie name any more — that is the fixed literal `"108_auth"` in
`src/utils/config.ts`, with `legacyAuthCookieNames` migrated on read. The
`.env` comment claiming otherwise was stale and had kept the browser tab
reading "108Heros" on the jobs app. Changing it logs nobody out. Fixed in #140.

## The chat room payload already carries the workflow (2026-09-07)

`GET /chat/rooms/{id}` returns `workflow` beside `room`, `participants`, `post`
and `lastMessage` — it comes from `Workflow::get_current_by_room_id`, and its
`status` uses the **same union** as the stepper's `StatusKey`, so there is no
mapping to write.

That field went unread for a long time. The workflow stepper is a client-only
Zustand store (`stateMachineStore`) that starts at
`WaitForFreelancerQuotation` and is advanced by local clicks, so reopening a
room showed a finished job as not started and the Orders tab rendered no stage
at all (#136). `MessageClient` now adopts the server's status through
`hydratableWorkflowStatus`, which refuses three cases: no workflow yet, a
workflow the server marked inactive, and a status this client does not know
(the server's enum can gain a variant first, and an unknown key renders a blank
panel).

**Do not reach for `getBillingByRoom` for this.** It returns only the billing
row — never `workflow.status`, a different and shorter lifecycle — and filters
on a `billingStatus` the caller must already know, defaulting to
`QuotePendingReview`, so it 404s for any job past the quote stage. It has no
callers in this app and is not the right tool.

## `AGENTS.md` — the same file, for Codex (2026-09-02)

`AGENTS.md` beside this file is a **symlink to this file**, so Codex / ChatGPT —
which looks for `AGENTS.md` and never loads `CLAUDE.md` — starts with the same
control document Claude Code does. A symlink rather than a copy on purpose: a
copy drifts the day one side is edited. Keep it a symlink; edit only this file.
Rolled out across the ecosystem 2026-09-02; `CLAUDE.md` stays the canonical name
because the control-doc standard names it (`108-ting-ecosystem-docs/CONTROL_DOC_COVERAGE.md`).

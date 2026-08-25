# Design: Dead Backend-Feature Cleanup

Date: 2026-07-02
Status: Approved

## Problem

`108heros-clean` was forked from Lemmy and later had a surface-level rename pass (`lemmy-js-client` → `108heros-client`, Lemmy identifiers stripped — see commit `7379962`). The sibling backend, `api-108jobs`, has since gone through a phased cleanup (`phase-1` through `phase-7`, plus follow-up chores) that fully removed several Lemmy-era forum-governance features. The frontend's vendored API client (`src/lib/108heros-client`) and a handful of app-level files still carry type, route, and enum surface for those removed features. None of it is reachable from real UI, but it's misleading — it implies backend capabilities that no longer exist — and it's a hazard for anyone building against a client method that calls a nonexistent endpoint.

Confirmed against the backend's current complete route table (`api-108jobs/src/api_routes.rs`) that the following have **no** backend route at all:

- Federation / ActivityPub
- Voting / likes on posts and proposals
- Modlog
- Instance allow/block admin actions
- Registration-application admin management (self-registration via `/account/auth/register` still exists — only the *admin review* surface is gone)
- Post/proposal report creation and admin report review (`/account/report_count` still exists and must be kept)
- Saved/read/hidden/liked post and proposal actions
- Mention/reply inbox notifications (`listNotifications`, `markNotificationAsRead`, `markAllNotificationsAsRead` in the client call endpoints that don't exist)

## Scope

### Remove

1. **Client library** (`src/lib/108heros-client/src`): types/DTOs and `index.ts` exports for `FederationMode`, `apId`/`local` federation fields, `PostActions`/`CommentActions` vote+save+hide+read fields, `VoteShow`, `PersonActions`, `InstanceActions`, `reportCount`/`unresolvedReportCount`/`reportsEmailAdmins`, `listNotifications`/`markNotificationAsRead`/`markAllNotificationsAsRead` and their Notification/`PersonCommentMention`/`CommentReply` types, and any `http.ts` methods calling the above.
2. **App code**:
   - `VoteType` / `VoteContentType` enums (`src/utils/types.ts`)
   - `CommentNodeView`'s `personCommentMention` / `commentReply` fields (`src/utils/types.ts`)
   - Dead `ImmutableListKey` union members in `src/utils/helpers.ts`: `registrationApplication`, `postReport`, `commentReport`, `privateMessageReport`
   - The `registration-applications` / `reports` / `activitypub.*?` segments of the route-guard regex in `src/utils/app.ts`
3. **Adjacent findings surfaced during implementation** — confirm each against `api_routes.rs` before removing:
   - `PurgeType.Category` (only `/admin/purge/{person,post,proposal}` exist — no category purge route)
   - `PersonDetailsView.Saved` (no saved-posts feature)
   - Any other dead enum members or type fields turned up while touching these files

### Explicitly keep (do not touch)

Rider ratings/reviews, `report_count` endpoint, chat/presence system, and anything else currently wired to a live route in `api_routes.rs`.

## Approach

Single implementation plan (not phased into separate branches, unlike the backend's phase-1..7 — this is small enough for one pass). Likely executed via `subagent-driven-development` given the number of small, largely-independent files.

Order of operations:

1. Prune the client library first: remove the dead types/exports/`http.ts` methods identified above.
2. Run `pnpm tsc --noEmit` in the frontend to let the compiler surface every now-broken import across the app, rather than grepping blind for consumers.
3. Fix each surfaced compile error by deleting the dead consumer code (not by re-adding stubs).
4. Repeat steps 2–3 until `tsc --noEmit` is clean.
5. Run `pnpm lint` and `pnpm build`, fix anything they surface.
6. Final grep sweep for the 8 category keywords (see Validation) to confirm nothing dead remains outside explicitly-kept code.

## Validation

- `pnpm tsc --noEmit` — clean
- `pnpm lint` — clean
- `pnpm build` — clean
- Final grep for `federation|activitypub|VoteType|VoteShow|InstanceActions|registrationApplication|postReport|commentReport|privateMessageReport|listNotifications|PersonCommentMention|CommentReply` under `src/` returns nothing outside intentionally-kept code (e.g. rider reviews, `report_count`).

## Out of scope

- Any feature still backed by a live route in `api_routes.rs`.
- Regenerating or re-architecting the `108heros-client` package's build tooling (tsoa config, etc.) — this is a deletion pass, not a client-generation overhaul.
- Backend changes — `api-108jobs` is already clean; this spec only touches `108heros-clean`.

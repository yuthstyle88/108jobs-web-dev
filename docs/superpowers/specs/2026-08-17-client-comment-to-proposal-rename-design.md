# Finishing the Comment → Proposal rename in `108jobs-client`

## Context

`api-108jobs` renamed its whole comment domain to **proposal** — types,
routes, DB columns, and enum variants. On `origin/main` today there is not a
single `Comment*` API type and not one `CommentSortType`; the routes are
`/proposal`, `/proposal/list`, `/proposal/delete`, and the columns are
`collapse_bot_proposals`, `newest_proposal_time_at`, `read_proposals_at`.

`108jobs-clean`'s hand-maintained client package never got the memo. It
still ships 11 `Comment*` type files, and — because the package is synced by
hand with no CI check ([[project-108jobs-client-type-sync]]) — the drift went
past the type names into the wire contract itself.

This is not dead code. The proposal feature runs on these types: 14
references across `job-board/[jobId]/proposal/page.tsx`,
`JobBoardProposal/index.tsx`, `QuotationModal/index.tsx`, and
`utils/types.ts`. The app already *speaks* proposal everywhere — the route
folder is `proposal/`, the variables are `proposals` and `proposalId`. Only
the imported names lag.

The client is also visibly stuck mid-rename: field names were updated while
type names weren't, so files read like `proposals: Array<CommentView>` and
`proposal: Comment`.

### What the drift actually costs

Renaming a type is cosmetic. Renaming a **JSON key** is not: a mismatched key
does not fail loudly, it deserializes to `undefined`. Four such bugs are live
in shipped code, each verified against `origin/main` (all the structs
involved carry `#[serde(rename_all = "camelCase")]`, so the wire keys are
exactly as compared):

| Where | Client sends/reads | Backend expects/sends | Effect |
|---|---|---|---|
| [ChatRoomView/index.tsx:125](src/modules/chat/components/ChatRoomView/index.tsx:125) | reads `room.currentCommentId` | sends `currentProposalId` | `roomProposalId` is **always `undefined`** |
| [job-board/edit/[jobId]/page.tsx:17](src/app/[lang]/(job)/job-board/edit/[jobId]/page.tsx:17) | sends `commentId` | `GetPost.proposalId` | proposal context **silently dropped** |
| [useWorkflowActions.ts:161](src/modules/chat/hooks/useWorkflowActions.ts:161) | sends `commentId` | `CreateInvoiceForm.proposalId` | invoice loses its proposal link |
| [site-settings/page.tsx:32,387-388](src/app/[lang]/admin/site-settings/page.tsx:32) | offers `"MostComments"`/`"NewComments"` | `MostProposals`/`NewProposals` | **400** if an admin picks either |

The last one is ours: the Site Settings page shipped in PR #46 offers two
`defaultPostSortType` options the backend's enum cannot deserialize.

## Design

### A. The wire contract governs — rename only what the backend renamed

The temptation with a rename this mechanical is `sed s/Comment/Proposal/`.
That would break the app. Of the 28 client files mentioning "Comment", many
carry names the backend **did not** rename, and a field name is only correct
if it matches the JSON key byte-for-byte.

So every name below was checked individually against `origin/main`, and the
plan changes a name only where the backend changed it. Three concrete cases
where the answer was "leave it alone":

- **`PostNotificationsMode`** (`"AllComments"`) — the backend has no such
  enum, under any spelling. There is nothing to align to; renaming it would
  invent a contract. Left untouched and flagged below.
- **`ModRemoveProposalForm.comment_id` / `PersonProposalMentionInsertForm.comment_id`**
  — still `comment_id` on the backend, but these are internal DB insert forms
  that never reach the client. Irrelevant here.
- **`useNotification.ts`'s `review.success.*` keys** — app-internal
  translation-map keys, not a wire contract.

### B. The three field-level defects come along in the same pass

`Comment`/`CommentView` are not merely misnamed, they are wrong:

1. `CommentView.category: Category` — backend is `Option<Category>`. The
   non-optional declaration tells TypeScript a nullable field is always
   present.
2. `CommentView.categoryActions?: CategoryActions` — **phantom field**;
   `ProposalView` has no `category_actions`. Always `undefined`.
3. `Comment` is missing `pending: boolean` — present and serialized on the
   backend (only `hot_rank`/`controversy_rank` are `serde(skip)`).

A fourth sits on `Billing.commentId: CommentId`, which is non-optional
against a backend `Option<ProposalId>` — so that one field needs both a
rename and an optionality fix.

These live on the very files being renamed. Splitting them into a follow-up
would mean editing the same files twice for no benefit.

### C. No compatibility aliases

No `export type CommentView = ProposalView` shims. This is a private,
hand-maintained package whose every consumer is in this repo, and the
complete consumer list is known and small. Aliases would preserve exactly the
ambiguity this change exists to remove.

### D. Method names rename too

`useHttpGet("getComments")` passes a method name as a **string key**, so the
client's method names are part of the app's API surface, not an internal
detail. `createComment`/`editComment`/`deleteComment`/`getComments` become
`createProposal`/`editProposal`/`deleteProposal`/`getProposals`, and the four
call sites move with them. The routes they decorate are already `/proposal`
and do not change.

### E. `CommentSortType` is deleted, not renamed

`ProposalSortType.ts` already exists, is value-identical
(`"Hot" | "Top" | "New" | "Old" | "Controversial"`), and is already used by
the Site Settings page. `CommentSortType.ts` is a duplicate with the stale
name; its two importers point at the existing file instead.

## The full inventory

Every item verified against `api-108jobs` `origin/main`.

**Type files renamed (10) + 1 deleted**

`Comment`→`Proposal`, `CommentActions`→`ProposalActions`,
`CommentId`→`ProposalId`, `CommentResponse`→`ProposalResponse`,
`CommentView`→`ProposalView`, `CreateComment`→`CreateProposal`,
`DeleteComment`→`DeleteProposal`, `EditComment`→`EditProposal`,
`GetComments`→`GetProposals`, `GetCommentsResponse`→`GetProposalsResponse`;
`CommentSortType` deleted.

**Wire field renames (10 fields across 8 files)**

| File | Field | Becomes |
|---|---|---|
| `GetPost.ts` | `commentId` | `proposalId` |
| `ChatRoom.ts` | `currentCommentId` | `currentProposalId` |
| `CreateChatRoomRequest.ts` | `currentCommentId` | `currentProposalId` |
| `Billing.ts` | `commentId: CommentId` | `proposalId?: ProposalId` (also optional) |
| `CreateInvoiceForm.ts` | `commentId?` | `proposalId?` |
| `LocalUser.ts` | `collapseBotComments`, `defaultCommentSortType` | `collapseBotProposals`, `defaultProposalSortType` |
| `SaveUserSettings.ts` | `collapseBotComments?`, `defaultCommentSortType?` | `collapseBotProposals?`, `defaultProposalSortType?` |
| `Post.ts` | `newestCommentTimeAt` | `newestProposalTimeAt` |
| `PostActions.ts` | `readCommentsAt`, `readCommentsAmount` | `readProposalsAt`, `readProposalsAmount` |

**Enum literal renames (4 literals across 3 files)**

`PostSortType`: `"MostComments"`→`"MostProposals"`, `"NewComments"`→`"NewProposals"`.
`SearchType`: `"Comments"`→`"Proposals"`.
`CategorySortType`: `"Comments"`→`"Proposals"`.
`SearchCombinedView`: discriminator `{type_: "Comment"}`→`{type_: "Proposal"}`.

**App-side changes**

`utils/types.ts` (`CommentNodeView`→`ProposalNodeView`), `other_types.ts`
(`GetCommentsI`→`GetProposalsI`), the four method call sites, the three live
wire-field bugs, and the Site Settings sort options plus their en/th/vi
translation keys.

## Out of scope

- **Backend handler function names.** `api-108jobs` still calls its handlers
  `create_comment`, `list_comments`, and carries a stale
  `// …add the comment() rate limiter`. Internal to that repo, zero wire
  impact, and a change there is its own PR.
- **`PostNotificationsMode` and `PostActions.notifications`.** The backend has
  no counterpart to either. Possibly dead, possibly drift of a different
  kind — a separate investigation, not something to guess at inside a rename.
- **The three unserved `/proposal` routes** (`GET /proposal`,
  `/proposal/remove`, `/proposal/distinguish`). Deliberately absent from the
  client since the dead-code pass.
- **`useNotification.ts`'s `postComment`/`updateComment`/`deleteComment`
  keys.** App-internal naming with no wire meaning.

## Testing

The package has no test infrastructure, matching every prior batch here. The
gates are:

- `npx tsc --noEmit` clean — this is the real net. Renaming a type or a
  string-keyed method breaks every stale reference at compile time, so a
  clean run proves the rename is complete and internally consistent.
- `npx eslint` clean on touched files.
- **Both** `cd src/lib/108jobs-client && npm run build && cd -` **and**
  `pnpm install` after package edits. `node_modules/108jobs-client` resolves
  to a hard copy, not a link to `src/lib/`, so building without reinstalling
  leaves `tsc` reading the old shape ([[project-108jobs-client-type-sync]]).

`tsc` cannot see a wrong JSON key, so the four live bugs are verified by hand
against the running dev API:

- A chat room opened on a proposal yields a defined `roomProposalId`.
- Editing a job from a proposal keeps its proposal context.
- An invoice created from the workflow carries its proposal link.
- Site Settings saves `defaultPostSortType` as "Most Proposals" without a 400,
  and the value survives a reload.

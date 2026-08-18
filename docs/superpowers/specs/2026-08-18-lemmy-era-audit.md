# Lemmy-era remnants: audit

Findings only. No code changed. Every claim below was checked against source, the
live schema, or both; where I did not chase something to the end, it says so.

This fork descends from Lemmy. `Category` was `community`, `Proposal` was
`comment`. Two renames have already landed; what follows is the furniture that
came with them and never got a job.

## The pattern that blocks almost everything

`108jobs-flutter`'s domain entities are Freezed classes whose generated parsers
read fields with no default:

```dart
usersActiveDay: (json['usersActiveDay'] as num).toInt(),
```

An absent key is `null as num`, which **throws** — not a blank field, a failed
parse of the entire entity. So removing any wire-facing field from a response
breaks every Flutter screen that loads it, until a coordinated client change
lands first.

This is the single reason most items below are "blocked" rather than "do it".

---

## 1. Federation / ActivityPub — mostly gone, remnants dangling

There is **no `apub` or `federate` crate** in the workspace. Federation is not
implemented. What survives:

| Remnant | Status |
|---|---|
| `tag.ap_id` | **Removed** (PR #237) — was the last `ap_id` column |
| `person.private_key` | **Removed** (#240) — no query, no trigger, no view |
| `person.instance_id` | Real FK to `instance` |
| `category.instance_id` | Column exists with **no FK constraint** — dangling |
| `person.last_refreshed_at`, `category.last_refreshed_at` | `#[serde(skip)]`; refresh-from-remote timestamps with no remote |
| `instance` table | 229 rows, and the contents are the finding — see below |

**`instance` deserves attention.** Its rows are overwhelmingly test detritus:
`localhost` plus a long tail of `cu-test-<uuid>.tld` domains created by
integration tests that never clean up. Only `person` FK-references it.
`Category.instance_id` points at nothing. 91 Rust files mention `instance`,
so it is deeply threaded — this is not a quick removal, but it is storing
nothing real.

## 2. Voting and karma — unreachable, still 19 columns

**There is no vote or like endpoint.** I grepped `api_routes.rs` for any
like/vote route and found none. The scoring columns are therefore write-only
from the application's perspective — nothing can change them.

Columns: `post.{score,upvotes,downvotes}`, `proposal.{score,upvotes,downvotes}`,
`person.{post_score,proposal_score}`, `post_actions.like_score`,
`proposal_actions.like_score`, `person_liked_combined.like_score`,
`search_combined.score`, plus the derived `hot_rank`, `hot_rank_active`,
`controversy_rank`, `scaled_rank`.

Live data: **3 posts and 1 proposal** carry a non-zero value. Test residue.

**Blocked, and doubly so:**
- Flutter declares `upvotes`/`downvotes` `required` on `PostDetail` and
  `Proposal`.
- The derived ranks back real sort variants — `Hot`, `Scaled`, `Controversial`
  on `PostSortType`; `Hot`/`Controversial` on `ProposalSortType`. Those sorts
  currently order by values that are always 0, which makes them meaningless
  rather than broken, but they are wired and reachable.

Removing scoring means deciding what `Hot` and `Scaled` should mean for a job
board — a product question, not a cleanup.

## 3. Forum-activity metrics on Category — handled

`users_active_day/week/month/half_year`, `subscribers_local`,
`interactions_month`, and the `report_count`/`unresolved_report_count`
pseudo-columns are removed on `chore/drop-lemmy-category-metrics`, together
with five now-unbacked `CategorySortType` variants (`ActiveDaily`,
`ActiveWeekly`, `ActiveMonthly`, `ActiveSixMonths`, `SubscribersLocal` — no
client ever sent them; the only references anywhere were the generated
TypeScript enum declaration).

`interactions_month` kept its **column**: `impls/post.rs` reads it to compute
`post.scaled_rank`. Only the struct field went.

Still open elsewhere: `local_site` carries its own `users_active_*` set, which
the admin dashboard genuinely displays. That one is real, not furniture.

## 4. Pseudo-columns — 6 of them, all one story

`report_count` and `unresolved_report_count` on `Category`, `Post`, and
`Proposal` are zero-sized marker types from `crate::pseudo_columns` that render
a SQL literal `0`. The tables have no such columns; the report system and its
triggers were deleted.

They exist solely because three Flutter entities declare them `required`.
Category's pair is removed on the branch above; **Post's and Proposal's remain**
and are blocked on the same Flutter change.

## 5. Lemmy tables still present

| Table | Rows | Reachable? |
|---|---|---|
| `tagline` | 0 | No route in `api_routes.rs`; 11 Rust files reference it |
| `admin_purge_post` | 0 | **Reachable — see correction below** |
| `instance` | 229 (test detritus) | No route; 91 Rust files |

`tagline` is Lemmy's rotating homepage quote and is genuinely dead — removed in
api-108jobs #240.

> **Correction (2026-08-18).** This section originally listed `admin_purge_post`
> as unreachable. It is not. `POST /admin/site/purge/post` routes to
> `purge_post`, which writes an audit row (`api_routes.rs:459`); sibling routes
> purge persons and proposals. The error was in the method: I grepped
> `api_routes.rs` for the **table name**, which never appears there because
> routes name the *handler*. Row count is not evidence of deadness either — an
> audit table is empty until someone purges something. `admin_purge_post` stays.

## 6. `ModlogActionType` — 16 variants, no modlog

There is **no modlog route**. The enum still carries
`ModRemovePost`, `ModLockPost`, `ModFeaturePost`, `ModRemoveProposal`,
`ModRemovecategory`, `ModBanFromcategory`, `ModAddcategory`,
`ModTransfercategory`, `ModAdd`, `ModBan`, `ModChangecategoryVisibility`,
`AdminPurgePerson`, `AdminPurgecategory`, `AdminPurgePost`,
`AdminPurgeProposal`.

Note the casing: `ModRemovecategory`, `AdminPurgecategory` — artifacts of a
find-and-replace during the community→category rename, not deliberate names.
That is a reliable tell for Lemmy-era code nobody has read since.

## 7. Client type files with no consumer

In `108jobs-clean`'s client package, app references (excluding the package's own
sources and `dist/`):

| Type | App refs |
|---|---|
| `InstanceActions`, `InstanceId`, `LocalSiteId`, `SiteResponse`, `TaglineId` | **0** |
| `Instance` | **0 genuine** — all 69 matches are `UserService.Instance`, a singleton accessor, or comments |
| `Tagline`, `LanguageId`, `RegistrationMode` | 2 each |
| `SiteView` | 4 |

`RegistrationMode` is genuinely used by the Site Settings page. The others are
worth a closer look individually.

## Suggested order, if this is pursued

1. **Client-type deletions** (§7) — frontend-only, no wire change, no risk.
2. **`tagline`** — empty, unreachable, optional-and-always-null on the wire.
   Done in api-108jobs #240, together with `ModlogActionType` and
   `person.private_key`. (`admin_purge_post` was in this tier and has been
   removed from it — it is live.)
3. **`ModlogActionType`** — unreachable enum; check nothing serializes it first.
4. **One coordinated Flutter change** making the required-but-meaningless fields
   optional: `reportCount`/`unresolvedReportCount` on Category, Post, Proposal;
   `upvotes`/`downvotes` on PostDetail and Proposal; and `PostView.tags`, which
   is already outstanding for the tags feature. Batch these — each one alone
   costs a release cycle.
5. **Post/Proposal pseudo-columns** — unblocked by step 4.
6. **Voting** — only after deciding what `Hot` and `Scaled` mean here.
7. **`instance`** — largest and least urgent; 91 files, and the payoff is
   deleting a table that stores test garbage.

## Two ways this audit was wrong, and the method behind both

Both errors came from asking a question that was easier to grep than the one
that mattered.

**A struct field can be dead while its column is alive.** Diesel queries
reference *columns* (`category::random_number`, `key::users_active_month`), not
struct fields, so "no Rust reads `self.foo`" says nothing about whether the
column is load-bearing. This has now caught three fields:

- `category.interactions_month` — read by `impls/post.rs` to compute
  `post.scaled_rank`
- `category.users_active_*` / `subscribers_local` — backed five `CategorySortType`
  sort variants
- `category.random_number` — orders random category selection (the MediaWiki
  algorithm)

In every case the struct field was removable and the column was not. Check both
separately, always.

**Route greps must name the handler, not the table.** `api_routes.rs` never
mentions a table name, so grepping it for one always returns nothing — which
reads as "unreachable" and is meaningless. `admin_purge_post` was declared dead
this way and is in fact written by a live purge endpoint. Grep for the handler,
or work backwards from the route list.

A corollary: **an empty table is not evidence of deadness.** An audit table is
empty until someone does the thing it audits.

## What I did not check

- Whether `person.private_key`, `last_refreshed_at`, or the `instance` columns
  are read by SQL (triggers, views, `replaceable_schema`) rather than Rust. The
  Category work proved this matters: a `search_combined_category_score` trigger
  depended on `users_active_month` and blocked its `DROP COLUMN` outright.
- The `search_combined` / `*_combined` tables, which are a Lemmy pattern and
  likely carry more of this.
- `108jobs-flutter` beyond the entity fields named above.
- Anything in `108bipbyte`, `108plaza-pos`, or the platform services.

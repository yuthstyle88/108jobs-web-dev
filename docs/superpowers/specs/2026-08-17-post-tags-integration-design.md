# Putting the tag system to use

## Context

`api-108jobs` has a complete post-tagging system that neither client uses.

A `Tag` is owned by a category (`Tag.category_id`), created by admins through
`POST`/`PUT`/`DELETE /category/tag`. Posts carry tags through a `post_tag` join
table. `CreatePost.tags` and `EditPost.tags` accept `Vec<TagId>`, and the
assignment is validated against the owning category — a post cannot wear a tag
belonging to a category it is not in. `PostView.tags` returns them for display,
and `CategoryView.post_tags` lists what is available.

None of it is reachable. The web app references tags nowhere; every `tag=` in
the codebase is the unrelated `InputField` `tag="input" | "textarea"` prop. The
client package has the *types* — `Tag`, `TagId`, `TagsView`, and the three
`*CategoryTag` request types — but no methods that call the endpoints.

Three defects sit between here and a working feature.

### 1. Tags would render blank — the wire casing is wrong

`Tag` carries no `#[serde(rename_all = "camelCase")]`. There are 131 such
attributes across `crates/db/src/source`; `tag.rs` has zero, which makes it the
anomaly rather than the rule. So the backend sends `ap_id`, `display_name`,
`category_id`, `published_at`, while the client declares `apId`, `displayName`,
`categoryId`, `publishedAt`. `displayName` — the only field anyone renders —
resolves to `undefined`.

The cause is `src/lib/108jobs-client/src/convert-to-camel.ts`, a codemod that
rewrites every type property from snake to camel without checking whether the
Rust struct opted in. It is the same mechanism that left `PostActions` and
`ProposalActions` mis-cased.

### 2. No client methods for the three tag endpoints

The request types exist and nothing calls them, so an admin has no way to
create, rename, or delete a tag.

### 3. The Flutter app will crash on the first tagged post

`108jobs-flutter`'s `PostView` declares `List<String> tags`, and its generated
parser does `(json['tags'] as List).map((e) => e as String)`. The backend sends
`TagsView` — `#[serde(transparent)]` over `Vec<Tag>` — an array of *objects*.
This is invisible today only because no post has tags.

## The model

| Object | Role of tags |
|---|---|
| Category | Owns the allowed tag list — the controlled vocabulary |
| Post | Selects up to 5 of them, describing that job's requirements |
| Proposal | Inherits the post's tags; has none of its own |

Tags describe **what the job requires**, not who is offering. A rider post in
`Delivery riders` carries `motorcycle`, `food-delivery`, `Sukhumvit`,
`evening-shift`, `own-vehicle`; a `Design` post carries `graphic-design`,
`Figma`, `menu-design`, `social-media`. The rider's proposal answers with their
price, availability, vehicle and message — it does not repeat the requirements.

This is already what the backend implements, which is why the feature needs no
new data model:

- `Tag.category_id` is non-nullable, and `update_post_tags` rejects any tag
  outside the post's category (`crates/api/api_utils/src/tags.rs:27`).
- `ProposalView.post_tags` is populated by the *same* `post_tags_fragment()`
  that fills `PostView.tags` — genuine inheritance from the associated post.
- There is **no `proposal_tag` table and no `ProposalTag` type anywhere** in the
  repo. Proposals having no tags of their own is a deliberate absence, not an
  oversight.

Separate proposal tags would duplicate the job's requirements at best and
contradict them at worst. If it later becomes necessary to describe what a
rider or freelancer *can do* — "motorcycle delivery", "Thai/English",
"refrigerated delivery" — that belongs in **profile skills**, a different model
attached to the person, not tags on each proposal.

### Tags are optional, capped at 5

`update_post_tags` validates membership only; it enforces no count. The form
caps selection at 5 and imposes **no minimum** — a post may carry none.

An earlier draft required 2 when the category offered at least 2. That was
dropped, and the reason is worth recording because it is not a UX preference:

**A minimum makes tagging compulsory, and compulsory tagging is unsafe while
`108jobs-flutter` is unfixed.** With a minimum, an admin adding two tags to a
category means any author editing a post in that category — even to correct a
budget — cannot save without selecting tags. That produces the first tagged
post, and the first tagged post throws a `TypeError` parsing the whole
`PostView` in every Flutter client. A rule intended to encourage adoption would
instead have forced the exact event the release-order constraint exists to
prevent.

Optional tags keep the feature opt-in: nothing tags a post until someone
chooses to. A minimum can be reintroduced the day the Flutter retype lands, as
a one-line change.

**A second reason, independent of Flutter:** clearing a post's last tag is
impossible through the API. `update_post_tags` is called only when `tags` is
`Some`, so an absent value leaves existing tags untouched; and `PostTag::set`
derives its `post_id` from `tags.first()`, so an empty list resolves to post id
0 — deleting nothing and inserting nothing. Neither route clears. With tags
optional, a post that was never tagged cannot reach that state at all, which
shrinks the blast radius of a backend gap this plan does not fix. Fixing it
properly means giving `PostTag::set` an explicit `post_id`; see Out of scope.

## Design

### A. Fix the casing on the backend, not in the client

Make `Tag` serialize camelCase in `crates/db/src/source/tag.rs`, so the client's
existing camelCase declaration becomes correct as written.

**The attribute must be the directional form.** This is the single most
important detail in this document, because the obvious version is wrong:

```rust
#[serde(rename_all(serialize = "camelCase"))]     // correct
#[cfg_attr(feature = "ts-rs", ts(optional_fields, export, rename_all = "camelCase"))]
```

A plain `#[serde(rename_all = "camelCase")]` was tried first and **broke the
database read path.** `post_tags_fragment()` and `category_post_tags_fragment()`
build tag JSON with raw SQL `json_agg(tag.*)`, so Postgres emits the real
snake_case column names, and `impl FromSql<Nullable<Json>, Pg> for TagsView`
deserializes through the *same* serde impl. A bidirectional rename therefore
makes any post, proposal, or category that has a tag fail to load — server-side,
for every client. It was caught by the `post_tags_present` test failing with
`missing field apId`.

`Tag` is serialized only into HTTP responses and deserialized only from that
`json_agg` — no handler takes it as a request body, and no request struct embeds
it — so the two directions can safely have different rules.

The separate `ts(rename_all = ...)` is required because **ts-rs does not parse
the directional form** and silently falls back to raw field names, which would
regenerate a snake_case TypeScript binding contradicting the camelCase wire.

The earlier claim that this change was free because "nothing consumes tags"
was wrong in exactly this way: the database read path consumes `Tag`'s serde
impl. It remains true that no *client* consumes tags yet, which is what makes
the HTTP-facing half of the change safe.

`PostTag` needs no change. It appears only on the write path
(`api_utils/src/tags.rs`, `impls/post_tag.rs`) and in two error variants; it is
never serialized into a response.

`Tag.ap_id` is vestigial. This fork has no `apub` or `federate` crate, so the
column federates nothing and the rename carries no federation risk.

**Not fixed here:** `convert-to-camel.ts` still ignores whether a struct opted
in, so the next regeneration can reintroduce this class of bug. Fixing the
codemod is its own change against its own audit of which structs lack
`rename_all` — see Out of scope.

### B. Three client methods, mirroring the routes

`createCategoryTag` / `updateCategoryTag` / `deleteCategoryTag`, wrapping
`POST` / `PUT` / `DELETE /category/tag` with the existing request types. Names
follow the handler names on the backend (`create_category_tag`, …), matching how
every other method in `http.ts` is named.

### C. Tag management belongs in Manage Category

Tags are owned by a category — `Tag.category_id` is not nullable, and the API
scopes their whole CRUD under `/category/tag`. Putting them anywhere else would
invent a hierarchy the data does not have. `/admin/manage-category` already
holds full category CRUD, so tags become a section of the category it belongs
to: list the category's tags, add one, rename one, delete one.

### D. The picker needs no new request

`PostForm` already calls `useCategories()`, which returns
`ListCategoriesResponse.categories: Array<CategoryView>` — and `CategoryView`
carries `postTags`. So when a category is selected, its tags are already in
memory. The picker reads them from the loaded list rather than fetching
anything.

Behaviour: the tag section appears only when the selected category has at least
one tag; selecting a different category clears any selection made under the
previous one, because a tag from another category would be rejected by the
backend's own validation. On edit, the post's existing tags arrive on
`PostView.tags` and pre-select.

Selection is capped at 5 with no minimum. The remaining allowance is worth
showing — "3 of 5" reads better than discovering the ceiling by hitting it —
and unselected options disable once 5 are chosen, rather than allowing a sixth
click that is then rejected.

### E. Display

Tag chips on the job-board cards and the job detail view, read from
`PostView.tags` — `displayName` only. Chips are not links and not filters; see
below.

**Proposals get no chips.** `ProposalView.postTags` exists and is correctly
populated, but every proposal under one job inherits the *same* tags from that
job — rendering them on each would repeat the job's requirements once per
offer, which is noise rather than information. The tags belong to the post, and
that is where they are shown.

## Release-order constraint — this is not optional

**The Flutter fix must ship before the web picker is enabled in production.**

Flutter is out of scope by choice, but the ordering is not a preference. The
moment any post carries a tag, every Flutter client that loads that post throws
a `TypeError` parsing the feed — not a blank chip, a failed parse of the whole
`PostView`. Backend casing, client methods, and admin tag management are all
safe to deploy: creating a tag harms nothing while no post uses it. **Assigning
a tag to a post is the unsafe step.**

So either `108jobs-flutter`'s `PostView.tags` is retyped from `List<String>` to
`List<Tag>` first, or the PostForm picker stays out of the production build
until it is.

## Out of scope

- **Filtering and matching by tag.** This is the most likely thing to be
  assumed already working, so stating it plainly: it does not exist. `Tag`'s own
  doc comment says tags are "displayed and filtered on", but only display is
  real — the only `post_tag` references in the query layer are test fixtures,
  and no request struct carries a tag filter. Tagging posts is what makes
  matching *possible* later; it does not make it happen. Real filtering means
  new query support in `post_view`, a new request field, and filter UI. Its own
  change.
- **Profile skills.** Describing what a rider or freelancer *can do* —
  "motorcycle delivery", "Thai/English", "refrigerated delivery" — is a separate
  model attached to the person. It is named here so that the need for it is
  never met by adding tags to proposals, which would duplicate or contradict the
  job's own requirements.
- **Proposal tags.** There is no `proposal_tag` table and none should be added.
  Proposals inherit the post's tags; see The model above.
- **Clearing a post's last tag.** Not expressible through the API: `PostTag::set`
  derives `post_id` from `tags.first()`, so an empty list targets post id 0. The
  fix is to pass `post_id` explicitly, in `api-108jobs`. Out of scope here, and
  made largely unreachable by tags being optional.
- **Backend enforcement of a tag count.** `update_post_tags` validates
  membership only. Making the count a real invariant across every client means
  changing that function, and would reject edits to existing untagged posts from
  any client. Out of scope; the count stays a web-form convention.
- **The Flutter retype.** Separate repo, flagged above as a release-order
  constraint rather than ignored.
- **Fixing `convert-to-camel.ts`.** Needs an audit of every struct lacking
  `rename_all`, which is a wider wire-drift pass.
- **Tag chips as links or filters**, which depends on filtering existing.

## Testing

`api-108jobs` has the four CI gates (fmt, clippy, nextest, config check); the
`Tag` change is an attribute addition, so the gate that matters is that nothing
which asserts on serialized tag JSON breaks.

`108jobs-clean` has no component-test infrastructure, matching every prior batch
here. `npx tsc --noEmit` and `npx eslint` are the mechanical gates, and after
any edit under `src/lib/108jobs-client/src/` **both** `npm run build` in the
package and `pnpm install` at the root are required — `node_modules/108jobs-client`
resolves to a hard copy, so building without reinstalling leaves `tsc` reading
the old shape.

`tsc` cannot see a wrong JSON key, so the casing fix is verified by hand against
a running dev API: a tag created through the admin UI comes back with a
non-empty `displayName`, and a tagged post renders its chip rather than a blank
one.

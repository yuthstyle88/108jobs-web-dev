# Admin Site Settings: read + edit site configuration

## Context

Sixth batch in this initiative, and a different kind of work from the
prior five: those were bug fixes on existing pages; this adds a genuinely
new capability. The backend (`api-108jobs`) has a complete, admin-gated
`PUT /api/v4/site` endpoint (`update_site`) supporting edits to the site's
name, description, sidebar, registration mode, email verification, OAuth
registration, several moderation/content-default toggles, and all 7
rate-limit pairs — confirmed by reading the handler and its
`EditSiteRequest` struct directly, today. None of it is wired into the
frontend's `108jobs-client` TS package (confirmed: no `editSite`/
`updateSite` method exists in `http.ts`, and no `EditSiteRequest` type
file exists at all).

`POST /site` (`create_site`) is a one-time site-bootstrap action — it sets
`site_setup: true` and is meant to run once when a fresh instance is first
configured, not as a repeatable admin action. Since this instance is
already live and set up, "Create" doesn't apply in any meaningful CRUD
sense, and "Delete" doesn't apply to a singleton config at all. This batch
is really Read (already works, via the existing `getSite`/dashboard) +
Update — "CRUD" in the sense the term is normally meant for a settings
object, not a literal four-operations build.

Two things surfaced during re-verification that shape this spec:

- **Captcha is not just missing an edit endpoint — it was fully removed
  from the backend three weeks ago.** Commit `891b7d851` ("remove
  captcha (broken by construction — CaptchaAnswer::insert had zero
  production callers and no challenge-issuing route ever existed)")
  deleted the `captcha_enabled`/`captcha_difficulty` database columns,
  removed them from every API response, and explicitly notes captcha
  "will be redesigned and reintroduced in a future sub-project." The
  frontend's generated `PlatformConfig.ts` type still declares
  `captchaEnabled: boolean` and `captchaDifficulty: string` as always-
  present — a live type/reality mismatch that predates this batch (the
  backend change is three weeks old; today's dashboard batch, PR #42,
  even added translated labels for `captchaDifficulty` without anyone
  catching that the field is now permanently absent from the real API
  response). Per an explicit scope decision: captcha is excluded from
  the settings-edit feature entirely, and the stale type/display gets
  corrected as part of this same batch, since fixing it means touching
  the exact same `PlatformConfig` type area this batch already needs to
  work in.
- Per an explicit scope decision, this batch builds the **full** set of
  backend-supported fields in one pass (not a curated MVP subset) —
  organized into sections so the size is manageable, not deferred.

## Design

### A. Wire up the client (`src/lib/108jobs-client/`)

This package is hand-maintained, not auto-generated across repos (every
existing type file's `ts-rs`-generated header is a snapshot from when it
was created, not something this repo re-runs) — new types are authored by
hand, matching the backend Rust struct field-for-field, converting
`snake_case` → `camelCase` per the existing convention, mirroring
`Option<T>` as an optional TS field, and Rust enums to their already-
existing TS union types (`RegistrationMode`, `ListingType`,
`PostSortType`, `PostListingMode`, `ProposalSortType` — confirmed all 5
already exist as generated types).

**New file:** `src/lib/108jobs-client/src/types/EditSiteRequest.ts` — one
optional field per `EditSiteRequest` field on the backend (36 fields:
`name`, `sidebar`, `description`, `categoryCreationAdminOnly`,
`requireEmailVerification`, `applicationQuestion`, `defaultTheme`,
`defaultPostListingType`, `defaultPostListingMode`, `defaultPostSortType`,
`defaultPostTimeRangeSeconds`, `defaultProposalSortType`,
`legalInformation`, `applicationEmailAdmins`, `slurFilterRegex`,
`actorNameMaxLength`, 14 rate-limit fields (7 pairs ×
`rateLimit{Kind}MaxRequests`/`rateLimit{Kind}IntervalSeconds` for
`message`/`post`/`register`/`image`/`proposal`/`search`/
`importUserSettings`), `registrationMode`, `reportsEmailAdmins`,
`contentWarning`, `oauthRegistration`, `disallowSelfPromotionContent`,
`disableEmailNotifications`).

**New file:** `src/lib/108jobs-client/src/types/SiteResponse.ts` — the
backend's `update_site` handler returns `SiteResponse {site_view}`, a
different (smaller) shape than the existing `GetSiteResponse` (which also
carries `admins`/`version`/`tagline`/`oauthProviders`/etc.). New type:
`{siteView: SiteView}`, reusing the already-existing `SiteView` type.

**Modify `http.ts`:** add `updateSite`, matching the existing
`getSite`/`adminVerifyBankAccount`-style pattern exactly:
```tsx
async updateSite(@Body() form: EditSiteRequest, @Inject() options?: RequestOptions) {
    return this.#wrapper<EditSiteRequest, SiteResponse>(HttpType.Put, "/site", form, options);
}
```

**Modify `index.ts`:** add `export type {EditSiteRequest} from
"./types/EditSiteRequest";` and `export type {SiteResponse} from
"./types/SiteResponse";`, matching the existing one-line-per-type pattern.

### B. Fix the stale captcha type

**`src/lib/108jobs-client/src/types/PlatformConfig.ts`:** remove
`captchaEnabled`/`captchaDifficulty` — these fields no longer exist in
the real API response and the type has been lying about them being
always-present since the backend change three weeks ago.

**`src/app/[lang]/admin/dashboard/page.tsx`:** remove the "Captcha" row
from the site-info bar (the `AlertTriangle` icon row showing Enabled/
Disabled + difficulty) — there's nothing real left to display.

**Translations:** remove the now-dead `dashboard.siteInfo.captcha`,
`dashboard.siteInfo.enabled`, `dashboard.siteInfo.disabled`, and the
`dashboard.siteInfo.captchaDifficulty.*` object (added by today's
dashboard batch) from `en.ts`/`th.ts`/`vi.ts`, since nothing will
reference them anymore. (`dashboard.siteInfo.registrationMode.*`, the
sibling lookup added in the same task, stays — registration mode is a
real, live field.)

### C. New page: `/admin/site-settings`

A new admin page, added to `AdminSidebar`'s `navigationItems` array
(`{key: "siteSettings", url: "/admin/site-settings", icon: Settings}`,
`Settings` already available from `lucide-react`, used elsewhere in this
codebase) with new `admin.layout.sidebar.nav.siteSettings.title`/
`.description` translation keys.

**Data flow:** the page reads current values from `useSiteStore()`
(already populated app-wide, the same store the dashboard reads from) to
pre-fill the form — no separate fetch needed on mount, matching how the
dashboard already works. On submit, calls `useHttpPut("updateSite")` with
only the fields the form actually changed (not a full-object overwrite —
matching the backend's own `Option<T>`-everywhere design, which treats an
absent field as "leave unchanged," confirmed by reading `update_site`'s
`PlatformConfigUpdateForm` construction), then refreshes `useSiteStore`
via `callHttp("getSite")` on success — the exact same
`callHttp("getSite")` → `setSiteRes` refresh pattern `manage-picture`
already established for its own edit actions.

**Form library:** `react-hook-form` + `zod` + `@hookform/resolvers`
(already-established dependencies; `manage-category`'s edit flow is the
precedent for the mutation-hook side of this, though its own form itself
predates the react-hook-form adoption — this page is a fresh build using
the modern combination directly).

**Validation:** zod schema matching the backend's own known constraints
where they're identifiable (site name 1–20 characters, description ≤150
characters — both confirmed by reading the backend's
`site_name_length_check`/`site_or_category_description_length_check`
constants directly); everything else gets reasonable type-level validation
(non-negative integers for rate limits and max-lengths) without inventing
unconfirmed business rules.

**Sections** (each its own card, matching the visual pattern established
across the admin panel — a heading + a `grid` of labeled fields):

1. **Site Identity** — name (text, 1-20 chars), description (text, ≤150
   chars), sidebar (markdown textarea), content warning (text), legal
   information (markdown textarea)
2. **Registration & Access** — registration mode (select: Open/Closed/
   RequireApplication, reusing the same 3 options already established for
   the dashboard's read-only display), require email verification
   (toggle), category creation admin-only (toggle), application question
   (markdown textarea, only meaningfully relevant when registration mode
   is RequireApplication — shown always for simplicity, not conditionally
   hidden, since the backend accepts it regardless), notify admins on new
   application (toggle), OAuth registration allowed (toggle)
3. **Moderation** — slur filter regex (text, monospace), actor name max
   length (number), block self-promotion content (toggle), notify admins
   on new reports (toggle), disable email notifications (toggle)
4. **Content Defaults** — default theme (text — the backend accepts any
   string, "usually browser" per its own doc comment, no fixed enum to
   validate against), default post listing type (select, reusing the
   existing `ListingType` union), default post listing mode (select,
   `PostListingMode` union), default post sort type (select,
   `PostSortType` union), default post time range seconds (number, 0 =
   none per the backend's own doc comment), default proposal sort type
   (select, `ProposalSortType` union)
5. **Rate Limits** — 7 two-column rows (max requests + interval seconds),
   one per kind: Messages, Posts, Registrations, Image uploads, Proposals
   (the field itself is named `proposal` — its doc comment still says
   "comments," a stale leftover from this backend's Lemmy-forked history,
   predating the rename to this codebase's own domain vocabulary; the UI
   uses "Proposals," matching the current field name and how this app
   refers to the concept everywhere else), Search, Settings import/export

**Submit UX:** a single "Save Changes" action for the whole form (not
per-section saves) — the backend's `update_site` already accepts a
partial payload in one call, so there's no technical reason to fragment
this into multiple round-trips, and a single save matches how every other
edit flow in this admin panel already works (one form, one submit).
Success shows a toast and refreshes the store; failure shows a toast with
the real error, form values are preserved (the admin doesn't lose their
edits on a failed save — matching the financial-trio batch's established
principle for failure states).

### Out of scope for this batch

- **Captcha** — the backend subsystem was removed, not just missing an
  edit endpoint; reviving it means building a real challenge/verification
  mechanism from scratch, which the backend's own removal commit already
  scoped as a separate future project.
- **`sort` field validation beyond type-checking** — none of the four
  sort-type selects have documented interdependencies with other fields
  worth encoding as cross-field zod validation; if the backend rejects an
  invalid combination, the existing failure-toast path surfaces it.
- **A "reset to defaults" action** — no such backend capability exists
  (there's no documented set of defaults to reset to beyond what's
  already in the database), and nothing in this spec's scope calls for
  inventing one.
- **Live-updating other open admin tabs/sessions** when settings change —
  the existing `useSiteStore` refresh-on-success already updates the
  current session; propagating to other tabs/sessions in real time is a
  separate, unrelated concern (this app has no established pattern for
  that anywhere today).

## Testing

No component-test infrastructure exists for any of the touched/new files
(matches every prior batch). Verify manually in the browser preview:

- The Site Settings page appears in the admin sidebar, navigates
  correctly, and pre-fills every field with the site's actual current
  values on load.
- Changing a single field (e.g. the site name) and saving updates only
  that field — reloading the page (or checking the dashboard's read-only
  display) shows the change persisted, and other fields are unaffected.
- Site name validation rejects an empty value and a value over 20
  characters with real inline error copy, in all three locales.
- A simulated save failure shows a real error toast and leaves the form's
  edited values intact (not reset to the pre-edit state).
- All 7 rate-limit pairs save and persist correctly.
- The dashboard's Captcha row is gone entirely, and its removal doesn't
  leave a visual gap or leftover translated-but-unused strings.
- Switching locale on the Site Settings page shows every label, section
  heading, and validation message in the selected language.

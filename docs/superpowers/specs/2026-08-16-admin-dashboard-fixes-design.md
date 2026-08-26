# Admin bug-fix batch: dashboard

## Context

Fourth batch from the original admin audit, following the merged systemic
fixes (PR #37), the merged manage-category/manage-job-board batch (PR #38),
and the manage-picture/manage-users/manage-riders batch (PR #40, currently
in review). This batch covers `dashboard` — the last remaining
non-financial admin page before the financial trio
(bank-accounts/topup-coins/withdraw-coins).

All findings below were re-verified against current source immediately
before this spec (not recalled from the earlier audit) — every citation is
the current file:line, confirmed accurate.

A separate, larger piece of work came up during this batch's brainstorm:
the backend (`api-108heros`) already has a complete, admin-gated
`PUT /api/v4/site` endpoint (`update_site`, in
`crates/http/src/crud/site/update.rs`) supporting edits to name, sidebar,
description, registration mode, email verification, OAuth registration, and
all 7 rate-limit pairs — none of which is currently wired into the
frontend's `108heros-client` TS package. Per an explicit sequencing decision,
that becomes its own follow-on batch ("Site Settings") with its own
brainstorm/spec/plan, once this batch ships. Nothing in this spec touches
that endpoint or adds any editing capability — this batch is a read-only
display-bug fix pass only.

## Design

**1. Invisible event-indicator dots** (`page.tsx:187, 200`)
Both status dots use `className="w-2 h-2 bg-blue rounded-full"`. `bg-blue`
is not a valid Tailwind class — the project's Tailwind config only defines
a bare (unshaded) `blue` color nowhere; Tailwind's default palette requires
a shade suffix (e.g. `blue-500`). The class generates no CSS, so the dots
render with no background color at all — an empty, invisible 8px circle.
Fix: `bg-blue` → `bg-primary` (the project's existing brand-color token,
already used elsewhere in the admin UI for equivalent "informational"
indicators).

**2. Registration badge bypasses the design-token system** (`page.tsx:79`)
`className={localSite?.registrationMode === "Open" ? "text-green-700" :
"text-red-800"}` hardcodes raw Tailwind colors instead of the `success`/
`destructive` tokens the systemic-fixes batch (PR #37) established
(`--success: #16A34A`, `--destructive: #DC2626`, wired into
`tailwind.config.ts` as `text-success`/`text-destructive`). Fix: swap to
`text-success`/`text-destructive`.

**3. Dead `common.*` translation keys** (`page.tsx:81, 207`)
`t("common.unknown")` and `t("common.launch")` reference a `common`
namespace that does not exist anywhere in `src/translations/*.ts` (grep
confirms zero matches) — i18next's missing-key fallback renders the literal
key string (`"common.unknown"`, `"common.launch"`) directly in the UI, with
no `|| "fallback"` guard on either call site. Fix: move both under the
`dashboard.*` namespace. `dashboard.siteInfo.unknown` is a new key (added
alongside fix #5's new keys, same object). For the launch-date fallback,
add a new `dashboard.events.launch` key ("Launch") rather than reusing the
existing-but-unused `dashboard.events.never` ("Never") — the fallback fills
the `{{date}}` slot in "Since {{date}}", so it needs to read as "Since
Launch," not the semantically contradictory "Since Never" (this code path
only runs once `localSite.posts > 0`, so the site has clearly already
launched).

**4. Stray broken className** (`page.tsx:68`)
`className="font-medium tex"` — `tex` is not a real Tailwind class (dead,
meaningless fragment, most likely a typo/leftover). Fix: drop it, leaving
`className="font-medium"`.

**5. Raw backend enum values shown untranslated** (`page.tsx:81, 95`)
`localSite?.registrationMode` (`"Open"` / `"Closed"` / `"RequireApplication"`,
per the generated `RegistrationMode` type) and `localSite?.captchaDifficulty`
(a raw backend string, e.g. `"easy"`/`"medium"`/`"hard"`) are interpolated
directly into the page with no translation layer — a Thai or Vietnamese
admin sees the raw English enum value. Fix: add two small local lookup
maps (or nested translation objects) under new `dashboard.siteInfo.*` keys
— `dashboard.siteInfo.registrationMode.{open,closed,requireApplication}`
and `dashboard.siteInfo.captchaDifficulty.{easy,medium,hard}` — with real
English/Thai/Vietnamese copy, falling back to the raw value only if an
unrecognized string somehow appears (defensive, not expected in practice).

**6. No indication when site data hasn't loaded** (whole file)
`siteRes` comes from `useSiteStore`, populated once at app-hydration time
(`UserServiceContext.tsx`) — not fetched by this page directly. If it's
ever `null` when the dashboard renders (a cold client-only render, or the
ISO hydration payload didn't include site data), every stat and info field
silently falls back to `0`/`"N/A"`/`"108heros"` with zero indication
anything is missing or wrong — unlike the loading/error-state pattern
every other admin page in this initiative now has. Since there's no
page-level fetch to show a spinner for, the right shape here is different:
if `localSite` is null, render a clear "Unable to load site information"
card with a manual Retry action, reusing the exact `callHttp("getSite")` →
`isSuccess`/`setSiteRes` pattern `manage-picture`'s Task 4 already
established (`callHttp`/`isSuccess` from `@/services/HttpService`,
`setSiteRes` from `useSiteStore`) — instead of a silent, misleading wall of
zeros.

**7. "Recent System Events" isn't a real event feed** (`page.tsx:176–215`)
The card presents two lines as if they were a timestamped activity log,
but both are synthesized from existing site-summary data: the first
admin's name (always shown, not tied to any actual "just became active"
event) and the total post count (shown once posts exist, framed as "since
launch"). Per the sequencing decision: relabel rather than build a real
backend-driven event feed (out of scope, would need new backend work).
Rename the card title from `dashboard.events.title` ("Recent System
Events") to a new key reading "Site Summary" (or equivalent, in all three
locales), and adjust `dashboard.events.adminActive`/`postsPublished`
copy so it reads as a summary rather than an implied real-time log entry
(e.g. "Admin on record: @{name}" instead of "Admin account active:
@{name}"). The underlying data shown does not change — only the framing.
Two existing, currently-unused translation keys
(`dashboard.events.siteRefreshed` and `dashboard.events.never`) get dropped
as dead — nothing in the page renders either of them (fix #3 above adds a
distinct, correctly-worded `dashboard.events.launch` key rather than
reusing `never`), and neither fits the corrected framing.

**8. Broken `{minutes}` interpolation in `vi.ts`** (translation file, discovered
while gathering exact translation content for the implementation plan)
`dashboard.limits.perMinute` uses single-brace `{minutes}` in `vi.ts`
("bài / {minutes} phút") while `en.ts` ("posts / {{minutes}} min") and
`th.ts` ("โพสต์ / {{minutes}} นาที") both correctly use double-brace
`{{minutes}}` — the exact same i18next interpolation bug fixed repeatedly
in prior batches (single braces don't interpolate; i18next needs `{{ }}`).
The call site (`page.tsx:147-149`) already passes a `{minutes: ...}`
interpolation object correctly — only `vi.ts`'s string itself is wrong.
Fix: `{minutes}` → `{{minutes}}` in `vi.ts`, no other change.

### Out of scope for this batch

- **Site Settings / config CRUD** (site name, registration mode, email
  verification, rate limits, etc.) — confirmed the backend already
  supports this via `PUT /api/v4/site`, entirely unwired from the frontend.
  Deliberately deferred to its own follow-on brainstorm/spec/plan, per the
  explicit sequencing decision — this batch does not touch editing at all.
- **Captcha settings editability** — not part of the deferred Site Settings
  work either, since `EditSiteRequest` (the backend's edit-site payload)
  has no captcha fields at all; captcha isn't editable via any existing
  API. Would need real backend work if ever wanted.
- **A real backend-driven activity/audit-log feed** to replace the
  relabeled "Site Summary" card — would require new backend work (an
  actual events/audit table and endpoint); this batch only fixes the
  existing card's honesty, not its capability.
- **i18next-native pluralization** for the manual `=== 1`/`> 0` ternaries
  (`dashboard.activity.user`/`users`, `dashboard.limits.activeAdmin`/
  `activeAdmins`) — matches the existing app-wide convention (used
  identically elsewhere in this codebase), not a bug introduced or
  compounded by this page.
- **`StatsCard`'s unused `trend` prop** and its hardcoded English "vs
  previous month" string — never rendered on this page (no trend data is
  ever passed), and `StatsCard` has no other current consumer in the
  codebase. Not touched.
- **The financial trio** (bank-accounts/topup-coins/withdraw-coins) — still
  queued per the original sequencing decision, after both this batch and
  the follow-on Site Settings batch.

## Testing

No component-test infrastructure exists for this file (matches every prior
batch's situation). Verify manually in the browser preview:

- The two "Site Summary" indicator dots are now visibly colored, not
  invisible.
- The registration-mode badge shows green when the site is "Open" and red
  otherwise, using the same red/green as the rest of the admin UI's
  success/error states.
- No literal `common.unknown`/`common.launch` text appears anywhere on the
  page.
- The instance-name label's className has no stray text.
- Registration mode and captcha difficulty display as real, translated
  words in all three locales (not raw English enum values) when switching
  locale.
- Temporarily forcing `localSite` to be null (e.g. via React DevTools, or
  by testing a fresh unauthenticated-then-authenticated flow if
  reproducible) shows the new "Unable to load site information" card with
  a working Retry button, instead of a page full of zeros.
- The former "Recent System Events" card now reads as "Site Summary" (or
  equivalent per-locale copy) in all three locales, with copy that doesn't
  imply a real-time event log.
- The Post Rate Limit card's "posts / N min" line shows the actual number
  in Vietnamese, not the literal text "{minutes}".

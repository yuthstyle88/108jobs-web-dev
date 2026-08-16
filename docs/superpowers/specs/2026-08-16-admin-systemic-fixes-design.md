# Admin systemic fixes: design tokens + shared layout

## Context

A comprehensive UI/UX audit of all 9 admin pages (6 parallel code-review
agents + a live authenticated walkthrough, desktop and mobile) found the
admin section reads as "nine different apps" — each page has its own card
language, status-badge palette, and confidence level for similar actions.
Full findings: see the published audit artifact (not part of this repo).

Two root causes explain most of the *systemic* part of that impression
(page-specific findings — category's dead save, job-board's dead filter,
etc. — are separate follow-up work, not part of this spec):

1. **Broken design tokens.** `tailwind.config.ts` only defines
   `primary` (`#08439B`), `secondary` (`#e3edfd`), `third` (`#1d6ce2`),
   `fourth` (`#f6f7f8`), `fifth` (`#1754b0`) — all blues and neutrals, no
   red or green anywhere. But 56 occurrences inside the admin section alone
   (68+ counting the rest of the app) reference a *different* token
   vocabulary that was never defined here — `bg-muted`,
   `text-muted-foreground`, `bg-destructive`, `text-destructive`,
   `bg-gradient-card`, `bg-gradient-primary` — the generic shadcn/v0
   defaults, apparently carried over from a template scaffold and never
   reconciled with this project's real palette. Confirmed by diffing actual
   compiled CSS, not just source: these classes generate zero rules.
   Concretely, every dashboard `StatsCard` icon sits on a
   `bg-gradient-primary` backdrop that resolves to nothing — a white icon
   on a fully transparent chip.

2. **`AdminHeader` and `AdminSidebar` render on all 9 pages**, so their
   problems multiply by 9: header text/icons fall through to near-black on
   the navy header background (~1.95:1 contrast against a 4.5:1
   requirement), the header hardcodes a fake identity ("Admin User" /
   `admin@108jobs.com`) instead of the real logged-in admin, the
   notification bell and Settings menu item have no handlers at all, and
   neither file imports `useTranslation` — all 9 sidebar nav
   titles/descriptions and every header string are hardcoded English, on
   top of the 2-page gap the audit found elsewhere.

Decided during brainstorming (continuing the "enhance all admin features"
initiative, sequenced as: audit everything first, then fix systemic issues
before per-page work): fix both of these first, since they're each a single
change that repairs multiple pages at once, and later per-page fixes are
easier to evaluate once the shared chrome and the token vocabulary are
correct.

## Design

### A. Token repair (`tailwind.config.ts`, `globals.css`)

Rather than remapping every broken class to the existing 5 tokens — not
viable, since none of them are red or green, and a destructive/danger
action can't become navy blue without losing its meaning — add the missing
semantic tokens for real, reusing existing hues where one already fits
rather than inventing new ones:

| New token | Light value | Source |
|---|---|---|
| `--destructive` | `#DC2626` | New — matches the ad-hoc `red-500`/`red-800` already scattered across these same pages |
| `--destructive-foreground` | `#FFFFFF` | New |
| `--success` | `#16A34A` | New — matches the ad-hoc `green-600`/`green-700` already in use |
| `--success-foreground` | `#FFFFFF` | New |
| `--muted` | `var(--fourth)` (`#f6f7f8`) | Reuses the existing near-white neutral |
| `--muted-foreground` | `#6B7280` | New — readable gray on `--muted` |
| `--accent` | `var(--fourth)` (`#f6f7f8`) | Reuses the existing near-white neutral, dark literal foreground — not the brand blue, since accent doubles as a hover/focus surface for shared UI primitives (Button, DropdownMenu) across the whole app, not just admin |
| `--accent-foreground` | `#171717` | New — matches this file's own `--foreground` light literal |
| `--card` | `#FFFFFF` | Reuses the existing white surface (literal, not `var(--background)`, to avoid chaining through a token that could later gain its own dark-mode override) |
| `--card-foreground` | `#171717` | Literal, matches `--foreground`'s light value (same reasoning as `--card`) |

All 5 new token families are light-only — none of them get a dark-mode override (see "Out of scope" below).

Added inside `globals.css`'s existing `:root { }` block and its existing
`@media (prefers-color-scheme: dark)` block (both already exist for
`--background`/`--foreground` — this just extends the same pattern to the
new tokens, it doesn't introduce a new mechanism). `tailwind.config.ts`
gets matching entries under `theme.extend.colors` following the exact
shape already used for `primary`/`secondary`/etc.
(`destructive: "var(--destructive)"`, and so on).

The `bg-gradient-primary` / `bg-gradient-card` classes aren't real
Tailwind syntax to begin with — Tailwind's actual gradient utilities are
`bg-gradient-to-{dir}` combined with `from-*`/`to-*` stop utilities, so
these were never going to work even with the variable defined. Each of
these call sites gets rewritten to real gradient syntax using existing
tokens (e.g. `bg-gradient-to-br from-primary to-third`) rather than adding
a same-named custom utility that would perpetuate the non-standard class
name.

This one change is expected to visibly repair a large share of the 56
in-admin occurrences without touching their call sites — e.g. `AdminHeader`
and `AdminSidebar` already reference `text-muted-foreground`,
`bg-destructive`, `text-destructive`, and `hover:bg-muted/80`; they start
resolving correctly as soon as the tokens exist, no JSX change needed for
those specific classes.

### B. `AdminHeader` fixes

- **Contrast**: header text/icons currently have no explicit color and
  fall through to the default near-black body text on the navy
  (`bg-primary`) header. Add explicit white/light text and icon color.
- **Real identity**: replace the hardcoded "Admin User" /
  `admin@108jobs.com` with the actual logged-in admin, read the same way
  `UserProfileSection` (the main site's equivalent header widget) already
  does — `useUserStore().userInfo?.localUserView`, giving
  `person.displayName ?? person.name` and `localUser.email`. No new data
  fetching: `userInfo` is already populated in the store by the time any
  admin page renders (the same store the main site header already reads
  from).
- **Bell and Settings**: neither has a handler today. Remove both from the
  dropdown/header rather than build real notifications or a settings page
  — that's new feature scope, not a systemic fix, and there's already a
  precedent for this exact call in this codebase: the main site's own
  `UserProfileSection` has its `NotificationDropdown` commented out
  (`{/*<NotificationDropdown/>*/}`) for the same reason. Logout is the only
  menu item with a real handler; it stays.
- **i18n**: every string in this file (avatar fallback "AD", "Admin User",
  the email, "Settings", "Logout") moves behind `t()`, under a new
  `admin.layout.header.*` namespace, following the existing nested-by-page
  convention already used for `admin.withdraw.*` etc.
- **Landmark**: no change needed here specifically — `<header>` is already
  the correct element.

### C. `AdminSidebar` fixes

- **i18n**: the 9-item `navigationItems` array's `title`/`description`
  pairs move to `t()` calls against new `admin.layout.sidebar.nav.<key>.*`
  keys (one key per page, e.g. `dashboard`, `manageUsers`, `bankAccounts`,
  ...), added to all three locale files (en/th/vi).
- **Nav landmark**: wrap the `<SidebarMenu>` list in a
  `<nav aria-label={t("admin.layout.sidebar.navLabel")}>` at the
  `AdminSidebar` call site. Scoped to this file rather than the shared
  `Sidebar` UI primitive (`components/ui/Sidebar`), since that primitive is
  generic and changing its root semantics would be a broader change than
  this fix calls for.
- **Broken gradient class**: `bg-gradient-card` on `SidebarContent`
  (line 95) is one of the rewrites from part A.

### Out of scope for this spec

- **Full dark-mode support for the admin section.** The app has no active
  theme *toggle* — Tailwind's `darkMode` is unset, which defaults to the
  `media` strategy, so `dark:` classes already respond to OS-level dark
  mode with no code required. The new tokens above are deliberately
  light-only, not dark-aware: they get no entries in `globals.css`'s
  `@media (prefers-color-scheme: dark)` block. Giving them dark values
  would have introduced a dark-mode inconsistency where the shared `Card`
  primitive (used app-wide, not just in admin) would go near-black under
  OS dark preference while the rest of the app — which has no real
  dark-mode support anywhere else — stays light. The audit's finding that
  Riders uses `dark:` classes while Users doesn't (and every other
  page-specific dark-mode gap) is unaffected by this change and stays out
  of scope.
- **Real notification and settings functionality.** Removing the dead
  bell/Settings menu item is in scope; building the features behind them
  is a separate, future initiative.
- **The sidebar's collapsed-state cookie only covering desktop width**
  (flagged as Minor in the audit). Traced into `SidebarProvider`
  (`components/ui/Sidebar/index.tsx`): desktop's collapsed/expanded state
  persists via cookie, mobile's open/closed state is separate in-memory
  state that always starts closed — they don't appear to actually leak
  into each other the way the audit's short description suggested. Given
  the shared `Sidebar` primitive would need touching to change this at
  all, and the original finding was Minor and not fully pinned down, this
  is deferred rather than risking a fix for a mechanism that isn't fully
  confirmed.
- **Every other per-page finding from the audit** (manage-category's dead
  save, manage-job-board's dead filter, the broken `{reason}`/`{name}`
  interpolation strings, etc.) — separate follow-up work, per the agreed
  sequencing.

## Testing

No existing test coverage exists for `AdminHeader`/`AdminSidebar` to
extend (no `*.test.tsx` alongside either file). Verify manually in the
browser preview instead, across all 9 admin pages where relevant:

- Every previously-invisible/broken-token element now renders with real
  color — dashboard `StatsCard` icons, header bell badge, sidebar active-
  state highlighting, sidebar hover state.
- Header text and icons pass a contrast check against the navy background.
- Header shows the actual logged-in admin's name and email, not the
  hardcoded placeholder — confirm by checking it matches the admin account
  used to log in.
- Bell and Settings are gone from the header; Logout still works.
- Switching the app language changes every sidebar nav item and header
  string (en/th/vi).
- Sidebar's primary nav is reachable as a landmark (browser accessibility
  tree, not just visually).
- Spot-check light and OS-level dark mode on at least the dashboard and
  one other page — new tokens should look intentional in both, not just
  copy-pasted.

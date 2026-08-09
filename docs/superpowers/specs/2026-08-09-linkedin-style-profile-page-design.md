# Design: LinkedIn-Style Profile Page Refactor

Date: 2026-08-09
Status: Approved

## Problem

`/profile/[username]` (rendered by [CurrentProfileUser](../../../src/app/[lang]/(profile)/profile/components/CurrentProfileUser/index.tsx)) uses a gradient-banner header plus a 1/3-sidebar + 2/3-content grid ([ProfileHeader](../../../src/components/Profile/ProfileHeader/index.tsx), [ProfileSidebar](../../../src/components/Profile/ProfileSidebar/index.tsx)). The ask is to restructure it to match LinkedIn's actual profile layout: a single main column of full-width stacked cards (cover photo + overlapping avatar + name/badges/actions in one hero card, then About/Skills/Contact/etc. as separate cards below), not a persistent sidebar.

Separately, the Portfolio (image-gallery) feature is being replaced with a LinkedIn-style single resume-file upload/download, which needs new backend support that doesn't exist today.

## Scope

### In scope

- Rebuild `/profile/[username]` into a single-column stacked-card layout.
- Replace the Portfolio image gallery (display + account-setting management) with a single-file Resume upload/download feature.
- Display the existing but currently-unused `Person.banner` field as the cover photo (read-only; fallback to today's gradient+logo when unset).
- Backend migration in `api-108jobs` adding `resume_url`/`resume_file_name` to `person`.
- Generalize the upload path (`useFileUpload` / `uploadToMad`) to send `kind: "file"` for the resume instead of the hardcoded `kind: "image"`.

### Explicitly out of scope

- Experience / Education / Certifications sections. The `Person` data model has no backing fields for these (the unused `profile.experienceTitle`/`educationTitle`/`certificationTitle` translation keys are leftovers from a design that predates the current data model). No placeholder/empty sections are added for them.
- Any "connections"/"endorsements"/social-graph concept — 108jobs is a job marketplace, not a social network, and has no data model for it.
- Banner **upload** UI — only display of the existing field. No upload control exists for it today and none is being added.
- Deploying MAD (`NEXT_PUBLIC_MEDIA_GATEWAY_URL` stays whatever it is per environment).
- Dropping the `portfolio_pics` column or any existing user portfolio data — see "Backend changes" below.

### Repos touched

- `api-108jobs` — migration + Diesel model + save-settings handler + ts-rs type regen.
- `108jobs-clean` — page layout, new Resume components, upload hook generalization, account-setting nav/page swap, removal of the Portfolio feature.
- `Media-Platform-dev` — **no code changes.** Confirmed by direct investigation: `media-service`'s upload-session API (`POST /uploads` → `PUT /uploads/{id}/bytes` → `POST /uploads/complete`, owned by `media-service/src/api/uploads.rs`, proxied verbatim by `media-gateway`) already has a `MediaKind::File` variant (`media-service/src/domain/kind.rs`) for generic file attachments — no transcoding, stored/served verbatim — and there is no content-type allowlist anywhere in the validation path (`UploadSession::open` only bounds `declared_content_length` ≤ 50MB). `application/pdf`/`.doc`/`.docx` already pass through unmodified with `kind: "file"`.

## Backend changes (`api-108jobs`)

**Migration** — added directly into the existing base migration rather than a new incremental one, per explicit direction: [migrations/2026-06-29-000009_create_person/up.sql](../../../../api-108jobs/migrations/2026-06-29-000009_create_person/up.sql) gains two nullable columns in the `CREATE TABLE person` statement:

```sql
resume_url text,
resume_file_name text,
```

`down.sql` needs no change — it already does `DROP TABLE IF EXISTS public.person CASCADE;`, which covers any columns added above.

**Note on convention / risk**: every other recent field addition in this repo (`add_portfolio_media_migrated_at_to_person`, `add_username_is_provisional_to_local_user`, etc.) is its own incremental `ALTER TABLE` migration, not an edit to `create_person`. Editing an already-applied migration in place means any environment where `create_person` has already run will **not** pick up the new columns — Diesel tracks migrations as applied by name and will not re-run an edited one. This is being done anyway per explicit instruction; call this out at merge/review time and confirm every environment that matters is rebuilt from a fresh migration run, not incrementally upgraded.

**Model** (`crates/db/src/source/person.rs`) — add `resume_url: Option<DbUrl>` and `resume_file_name: Option<String>` to `Person`, `PersonInsertForm` (`#[new(default)]`), and `PersonUpdateForm` (`Option<Option<T>>`), mirroring the existing `banner` field exactly.

**Save-settings wiring** (`crates/http/src/api/local_user/save_settings.rs`, request struct in `crates/db/src/source/site_view/api.rs`) — add `resume_url: Option<String>` / `resume_file_name: Option<String>` to `SaveUserSettings`; validate `resume_url` through `DbUrl::from_str` exactly like `avatar_url` (save_settings.rs:65-71) and set both fields on `PersonUpdateForm` alongside the existing `avatar`/`bio` assignment.

**Portfolio data is not dropped.** `portfolio_pics` (jsonb column on `person`) and `crates/api/api_utils/src/portfolio_media_migration.rs` stay untouched — dropping a column is a destructive, hard-to-reverse action against real uploaded user data, and nothing here requires reclaiming that storage. The frontend simply stops reading/writing it (see Cleanup below). Purging it later, if ever wanted, is a separate explicit decision.

**Type regen** — after the Rust changes, regenerate the ts-rs output under `src/lib/108jobs-client/` (`Person.ts` gains `resumeUrl?`/`resumeFileName?`; `SaveUserSettings.ts` gains the same two optional fields).

## Frontend architecture (`108jobs-clean`)

### Page layout — `/profile/[username]`

Single column, `max-w-3xl mx-auto` (replaces the old `max-w-7xl` + `grid-cols-1 lg:grid-cols-3` split):

```
CurrentProfileUser
 └─ ProfileHero              (NEW — merges old ProfileHeader + the avatar half of ProfileSidebar)
 └─ AboutCard                (renamed/restyled from ProfileSidebar's BioSection)
 └─ SkillsCard                (renamed/restyled from ProfileSidebar's SkillsSection)
 └─ ContactCard               (renamed/restyled from ProfileSidebar's ContactInfoSection)
 └─ ResumeCard                (NEW — replaces PortfolioSlider)
 └─ WorkSamplesSlider         (kept; restyled to match the new card rhythm)
 └─ Reviews                   (kept; restyled to match the new card rhythm)
```

**ProfileHero** (one white card):
- Cover: `profile.banner` if set, else today's gradient+logo fallback. `h-48 sm:h-64`, rounded top corners.
- Avatar: 128–160px, overlapping the cover at roughly `-mt-16`/`-mt-20`, white border — same visual treatment as today, just relocated into the hero.
- Below avatar: name/displayName; a verified checkmark badge next to the name when `isVerified`; an "Open to work"-style pill when `available` (this existing boolean maps directly onto LinkedIn's `#OpenToWork` concept); a small stat row for rating (`ratings`) and `averageResponseTime`.
- Action row: own profile → an "Edit profile" pencil link to `account-setting/basic-information` (same affordance pattern used elsewhere today); visiting another profile → the existing `ChatNoWorkButton`, restyled inline instead of full-width in a sidebar.

**AboutCard / SkillsCard / ContactCard**: same data/logic as today's `BioSection`/`SkillsSection`/`ContactInfoSection` (including the bio "see more" clamp and the per-section edit-pencil-to-account-setting pattern), moved into their own files under `src/components/Profile/` and restyled from "sidebar section" to "standalone card."

**ResumeCard**: if `profile.resumeUrl` is set — a file-tile (document icon, `resumeFileName`, "Download" link to `resumeUrl`). If unset — an empty state ("No resume uploaded yet"). Own profile gets an "Upload"/"Replace" link to `account-setting/resume`.

### Resume upload (account-setting)

- Route rename: `account-setting/portfolio` → `account-setting/resume`.
- New `ResumeUpload` component replaces `PortfolioImages`: single file input (`accept=".pdf,.doc,.docx"` — a picker-level filter only; neither backend validates content-type), using `useFileUpload` with a new `kind: 'file'` option (`visibility: 'public'`, same as portfolio images today).
- New `useResumeForm` hook mirrors `usePortfolioImagesForm`'s upload → `saveUserSettings({resumeUrl, resumeFileName, ...})` → optimistic store update, but without the field-array/multi-item machinery since it's single-file.
- Nav: [AccountSettingWrapper](../../../src/containers/AccountSettingWrapper/index.tsx) swaps the "Portfolio" item's label/icon (`SquareUserRound`) for "Resume" (`FileText` from `lucide-react`), same href pattern.

### Upload hook generalization

`uploadToMad`'s hardcoded `kind: "image"` ([madUpload.ts:99](../../../src/services/media/madUpload.ts)) becomes a parameter threaded through `useFileUpload`'s options, defaulting to `"image"` so every existing caller (avatar upload, chat attachments) is unaffected. The resume flow is the only caller passing `kind: "file"`.

### Cleanup (dead code removal)

Confirmed by checking actual importers before listing these as removable:
- `PortfolioSlider`, `PortfolioImages`, `usePortfolioImagesForm` — deleted, replaced by `ResumeCard`/`ResumeUpload`/`useResumeForm`.
- `Common/Modal/PortfolioImageModal`, `Common/Modal/FullScreenImageModal` — only imported by `PortfolioImages`; deleted with it.
- `Common/Modal/ImageModal` — only imported by `CurrentProfileUser` (for the portfolio image click-to-enlarge); deleted once Portfolio is removed from that page. (Distinct from `Common/Modal/AvatarUploadModal`, which `BasicInformation` uses for the avatar and is unrelated/kept.)
- Frontend stops sending `portfolioPics` in `SaveUserSettings` payloads (backend field/column untouched, per above).
- Remove now-dead `profile.portfolio*` / `profileInfo.*PortfolioImages*` translation keys from `en.ts`/`th.ts`/`vi.ts`; add `profile.resume*` / `profileNavbar.resume` equivalents.

## Approach

1. Backend first: migration + model + save-settings + type regen, so the frontend has real types to build against.
2. Frontend data layer: generalize `useFileUpload`/`uploadToMad` for `kind`, add `useResumeForm`.
3. Frontend account-setting: `ResumeUpload` component + route rename + nav update.
4. Frontend profile page: `ProfileHero`, `AboutCard`, `SkillsCard`, `ContactCard`, `ResumeCard`, wire into `CurrentProfileUser`, restyle `WorkSamplesSlider`/`Reviews` wrappers.
5. Delete dead Portfolio code (component files, modals, translation keys) once nothing references it.
6. Manual verification in a browser: own-profile view (edit affordances, resume upload/replace/remove) and visited-profile view (message button, resume download, empty states) at both desktop and mobile widths.

## Testing / Validation

- Vitest: extend `madUpload.test.ts` with a `kind: "file"` case; new component tests for `ResumeCard` (download link vs. empty state) and `ProfileHero` (verified/available badges, banner-vs-gradient fallback).
- Playwright: update/replace whatever portfolio e2e flow exists today with an upload-resume → view-on-profile → download flow.
- `pnpm tsc --noEmit`, `pnpm lint`, `pnpm build` clean after the Portfolio deletion pass (same discipline as the prior dead-code cleanup spec).
- Final grep for `PortfolioSlider|PortfolioImages|portfolioPics|PortfolioImageModal|FullScreenImageModal` under `src/` (excluding backend-mirroring type files) returns nothing outside intentionally-kept type-generation surface.

## Out of scope

- Backend content-type validation for uploaded documents (none exists today for either `kind`; not being added here).
- Regenerating/re-architecting the `108jobs-client` build tooling itself.
- Any change to `Media-Platform-dev` — confirmed unnecessary.
- Dropping/migrating away `portfolio_pics` data.

# Giving `/account-setting/manage` real content: the Secure Chat setting

## Context

`/account-setting/manage` is currently a page with a header and nothing
under it. It got that way honestly: its entire content was a 2FA section
calling `POST /account/auth/totp/generate`, an endpoint the backend does not
have, so enabling 2FA could only 404 while the toggle implied the account
was protected. That section was removed. The route survived because three
places link to it — the profile dropdown, the account-settings sidebar
(labelled "Consent management"), and the privacy policy.

The obvious reading of that sidebar label is that the page should become a
PDPA consent screen, matching the purposes the privacy policy enumerates.
**It can't, and shouldn't be faked.** Checked directly:

- `SaveUserSettings` on the backend has no consent field of any kind, and
  there is no per-purpose consent model anywhere in `crates/db`. The only
  adjacent flag is `LocalUser.accepted_terms`, a single boolean set at
  registration.
- The Flutter app has no consent screen either. Its only consent concept is
  rider face-consent, which is part of the rider application flow and has
  nothing to do with account settings.

Building a consent UI now would repeat exactly the mistake this page is
recovering from: an interface implying a guarantee nothing behind it can
honour.

What *is* ready is the setting the web is missing. Comparing the two
clients' settings surfaces:

| | Flutter | Web |
|---|---|---|
| Account info, Portfolio/Resume, Work sample, Bank | yes | yes |
| Availability | yes | yes ("Job Availability") |
| **Secure chat** | **yes** | **no** |
| Theme | yes | handled globally |

And the backend just fixed it. `api-108jobs` PR #233,
`fix(settings): persist secure_chat_enabled on save_user_settings`, merged
into `main`, whose commit message reads: *"PUT /account/settings/save
accepted `secureChatEnabled` and returned `{"success": true}`, but silently
dropped it: SaveUserSettings (the request DTO) had no such field for serde
to deserialize into."* So the endpoint the web would call was, until
recently, the same kind of silent no-op — and is now real.

This spec turns the empty page into the account's Settings page, with the
Secure Chat toggle as its content.

## Design

### A. The copy must not claim end-to-end encryption

This is the part to get right, and it is inherited rather than invented.
Flutter's `secure_chat_enabled_page.dart` carries a documented decision in
its class comment:

> The copy on this page used to promise end-to-end encryption, in the title,
> the switch, the body text and the confirmation toast. It was never true —
> the key is shared with the server, which decrypts every message to relay
> and moderate it. A wrong claim here is worse than a wrong name in the
> code: somebody could decide what to type on the strength of it.

The web page carries the same two-paragraph explanation, translated into
en/th/vi rather than English-only as Flutter currently has it:

> Messages are encrypted between your device and 108jobs, so nobody on the
> network in between can read them.
>
> This is not end-to-end encryption: 108jobs holds the key and can read your
> messages, which is what lets us act on reports of abuse and scams.

No wording that implies otherwise — not in the section title, the toggle
label, or the success toast.

### B. Client types

Two fields are missing on the web and confirmed present on the backend:

- `LocalUser.secureChatEnabled: boolean` — the backend's
  `local_user.secure_chat_enabled` is a non-null `bool`, so this is
  required, not optional.
- `SaveUserSettings.secureChatEnabled?: boolean` — optional, matching the
  `Option<bool>` the request DTO now carries.

Both are hand-added to the client package the same way the site-settings
types were, then the package is rebuilt — app code imports the package name,
which resolves to `dist/`, so a stale build silently hides the change.

### C. The page

`/account-setting/manage` renders its existing header plus one settings
card: a labelled switch bound to `secureChatEnabled`, with the honesty copy
below it.

Behaviour mirrors Flutter's: **optimistic update, persist, revert on
failure.** Flip the store value immediately so the switch responds, call
`saveUserSettings({secureChatEnabled})`, and on failure put the previous
value back and surface an error. The store already exposes `updateUser` for
a partial `LocalUser` patch, so the optimistic write and the revert are both
one call.

Flutter persists via `updateProfile`; the web uses `saveUserSettings`
(`PUT /account/settings/save`) instead — that is the endpoint PR #233
fixed, the web client already exposes it, and its `SuccessResponse` return
is all this needs. Results go through `isSuccess`/`isFailed`, never a
`try/catch`: these hooks resolve with a failed state rather than throwing,
so a `catch` around them cannot fire.

The toggle is disabled while no user is loaded and while a save is in
flight, so a double-click can't race two writes.

### D. The sidebar label

The entry currently reads "Consent management" and will point at a page that
manages a chat setting. It becomes "Settings" across en/th/vi. The privacy
policy's link is left pointing at the same route — it is a reasonable
destination for "manage your account", and re-pointing legal copy is not a
change to make as a side effect of a settings feature.

## Out of scope

- **Consent management.** No backend model exists; building the UI first is
  the failure mode this page is recovering from. If it is wanted, it starts
  in `api-108jobs` with consent columns and endpoints, and Flutter would
  follow.
- **Theme settings**, which Flutter exposes and the web handles globally.
- **Correcting Flutter's English-only copy** on its own page.
- **`SaveUserProfile`**, whose web shape (`updatePerson`/`card`/
  `updateAddress`) does not match the backend struct of the same name. A
  real mismatch, but a separate one — nothing in this change touches it.

## Testing

No component-test infrastructure exists for these pages, matching every
prior batch. Verified manually against the running dev API:

- The page renders the header, the Secure Chat card, and both honesty
  paragraphs, with the switch reflecting the account's saved value.
- Toggling on persists: a reload shows it still on. Toggling off persists
  the same way.
- The switch moves immediately on click rather than after the round-trip.
- A failed save reverts the switch and shows an error rather than leaving it
  showing a state the server never accepted.
- Switching locale translates the title, the toggle label, both paragraphs,
  and the toasts.
- The sidebar reads "Settings", and the profile-dropdown and privacy-policy
  links still reach the page.

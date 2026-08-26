# Password login (alongside phone+OTP)

## Context

`/login` currently offers only phone+OTP (`PhoneOtpAuthForm`) plus passkey
and Google sign-in — password-based login was deliberately removed from the
UI when the app migrated to phone+OTP (see commit `28b5cea`, "Replace
password register with phone+OTP, matching 108heros-flutter"). Only a stale
`LoginForm/interface.ts` survives from before that migration; the actual
component is gone.

The immediate trigger: testing admin-only pages requires an account with the
`jobs:admin` role, and getting one today means registering via OTP, then
manually granting the role straight against Identity-Platform's RBAC API
(`api-108heros/docs/identity-platform-setup.md`), then logging in *again*
since roles are baked into the JWT at issuance. That doc's own walkthrough
for bootstrapping a local admin account uses **username+password login**
against `POST /account/auth/login/identity-platform` — an endpoint that
already exists, already works, and is already typed on the frontend client
as `Api108Heros.loginWithIdentityPlatform()`. Nothing here reintroduces
retired backend functionality; the only missing piece is a UI form.

Decided during brainstorming: this becomes a permanent, production option
for all users (not a dev-only escape hatch), reachable via a button next to
the existing Google sign-in button, revealed on click rather than shown by
default (OTP stays the primary/first thing shown). Login only — no
password-based registration, no forgot-password flow. Both are real gaps if
password login sees real usage, but neither is needed for the trigger use
case, and building either now would be speculative.

## Design

### No backend changes

`loginWithIdentityPlatform(form: Login)` already exists in
`src/lib/108heros-client/src/http.ts`, takes
`{usernameOrEmail, password, totp2faToken?}`
(`src/lib/108heros-client/src/types/Login.ts`), and returns
`IdentityPlatformLoginResponse {accessToken, refreshToken, expiresIn}`. It
is unused by any current UI. This work wires a form to it via the standard
`useHttpPost` hook — the same pattern every other mutation in this app
already uses.

### New component: `PasswordLoginForm`

`src/components/Authentication/PasswordLoginForm/index.tsx`, a sibling to
`PhoneOtpAuthForm`, not a branch inside it. `PhoneOtpAuthForm` is explicitly
documented as the shared widget behind *both* login and register (mirroring
108heros-flutter's `PhoneOtpAuthFlow`); password login is login-only, so it
gets its own component rather than adding login-specific UI to a component
register also renders.

Shape: `usernameOrEmail` + `password` fields via `react-hook-form` +
`zod`, matching `PhoneOtpAuthForm`'s validation pattern
(`CustomInput`, `phoneForm`/`codeForm` style). Submit calls
`useHttpPost("loginWithIdentityPlatform")` with the form values, then on
success hands off to the shared redirect helper below. On failure, shows
`resolveApiErrorMessage(err, t, {fallback: t("authen.apiErrorState")})` —
no known-code special-casing yet (the exact failure codes this endpoint
returns for bad credentials aren't confirmed; verify against a real failed
login during implementation and add known-code copy then if it's worth it).

A "Back" affordance returns to the OTP form, via `AuthFormContainer`'s
existing `onBack` prop.

### Shared redirect logic

`PhoneOtpAuthForm.completeSignIn` (log in via `UserService.Instance.login`,
decode the JWT, redirect to `/admin/dashboard` if the claims are admin, else
to `redirectUrl`) is the one piece of real logic both forms need
identically. Extract it out of `PhoneOtpAuthForm` into a small shared
helper — e.g. `src/services/authRedirect.ts` exporting
`completeSignIn(accessToken, refreshToken, redirectUrl)` — and have both
forms call it, rather than duplicate it.

### `PhoneOtpAuthForm` gets one new optional prop

`onSwitchToPassword?: () => void`. When provided *and* `mode === "login"`,
render a button styled exactly like the existing Google sign-in button
(same bordered/full-width/icon+label treatment) directly below it, in the
same "Or" section. `AuthenticateIcon` has no password/lock icon (only
`fb`/`gg`); use a `lucide-react` icon (`KeyRound`) instead, matching how
`AuthFormContainer` already sources its own one-off icon (`ArrowLeftIcon`)
from the same library rather than adding a new image asset. Gated the same
way the existing "Create account" link two lines below is already gated
(`mode === "login"`), so nothing changes for the register page — it simply
won't pass the prop.

### `login/page.tsx`

Add local state, `const [authMode, setAuthMode] = useState<'otp' |
'password'>('otp')`. Render `<PhoneOtpAuthForm mode="login"
onSwitchToPassword={() => setAuthMode('password')}/>` or
`<PasswordLoginForm onBack={() => setAuthMode('otp')}/>` based on
`authMode`, both inside the existing `AuthFormContainer`.

### Out of scope (confirmed during brainstorming)

- Password-based registration (creating a new account with a password) —
  new accounts still register via phone+OTP or the documented
  curl-based dev flow.
- Forgot-password flow — no password-reset UI or confirmed backend endpoint
  exists yet; a real gap if this sees production usage, worth its own
  design later.
- TOTP 2FA (`Login.totp2faToken`) — accounts with 2FA enabled aren't
  supported by this form in v1.

## Testing

No existing component-level tests exist for `PhoneOtpAuthForm` or anything
under `Authentication/` to mirror — coverage in this area is service-level
(`IdentityOtpService.test.ts`, `IdentityPasskeyService.test.ts`), and
`loginWithIdentityPlatform` goes through the already-typed, already-covered
generated client rather than a new raw-fetch service, so there's no
analogous service file to add a test to either. Verify manually in the
browser preview instead:

- Valid credentials for an admin account → redirects to `/admin/dashboard`.
- Valid credentials for a non-admin account → redirects to the original
  `redirectUrl` (or `/`).
- Invalid credentials → shows an error, form stays usable.
- Toggle round-trips cleanly: OTP → password (button click) → OTP (back)
  without leftover state (e.g. a stale OTP step or error message bleeding
  across modes).

import {jwtDecode} from "jwt-decode";
import {UserService} from "@/services";
import {isAdminClaims, Claims} from "@/services/UserService";

// `redirectUrl` comes straight from the `?redirect=` query param on /login,
// so it's attacker-controlled input. Only a same-origin relative path is
// safe to send a freshly-authenticated user to -- an absolute URL
// (https://evil.example) or a protocol-relative one (//evil.example, which
// browsers still resolve as absolute, inheriting the current scheme) would
// be an open redirect. Anything that doesn't look like a safe relative path
// falls back to the site root instead.
export function sanitizeRedirect(redirectUrl: string): string {
    return redirectUrl.startsWith("/") && !redirectUrl.startsWith("//") ? redirectUrl : "/";
}

// Shared by every login form: persist the session, then route based on
// whether the token carries the admin role -- admins always land on the
// admin dashboard regardless of which form they signed in through.
export async function completeSignIn(
    accessToken: string,
    refreshToken: string | undefined,
    redirectUrl: string,
): Promise<void> {
    await UserService.Instance.login(accessToken, refreshToken);
    const claims = jwtDecode<Claims>(accessToken);
    if (isAdminClaims(claims)) {
        window.location.href = "/admin/dashboard";
        return;
    }
    window.location.href = sanitizeRedirect(redirectUrl);
}

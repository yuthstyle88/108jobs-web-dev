import {jwtDecode} from "jwt-decode";
import {UserService} from "@/services";
import {isAdminClaims, Claims} from "@/services/UserService";

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
    window.location.href = redirectUrl;
}

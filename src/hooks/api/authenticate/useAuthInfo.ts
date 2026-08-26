import {useUserStore} from "@/store/useUserStore";
import {isAdminClaims, UserService} from "@/services/UserService";

export function useAuthInfo() {
    const userInfo = useUserStore((s) => s.userInfo);
    const claims = useUserStore((s) => s.claims);
    const isLoggedIn = !!userInfo;
    const lang = userInfo?.localUserView.localUser.interfaceLanguage;
    const isAdmin = isAdminClaims(claims ?? UserService.Instance.authInfo?.claims);

    return {
        isLoggedIn,
        // In single-user mode, every logged-in user can act as both
        isEmployer: isLoggedIn,
        isFreelancer: isLoggedIn,
        isAdmin,
        userInfo,
        lang
    };
}

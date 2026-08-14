import {NextRequest, NextResponse} from "next/server";
import {getIdentityBase} from "@/utils/env";

// Mirrors 108plaza's storefront pattern: this app -- not the browser -- talks
// to Identity-Platform. Google's registered redirect URI is fixed to this
// app's own /api/auth/google/callback (see Identity-Platform's
// AUTH_GOOGLE_REDIRECT_URI), so Identity-Platform's /auth/google/start and
// /auth/google/callback stay exactly as they are for every caller -- no
// per-app origin parameter or popup handoff needed.
export async function GET(req: NextRequest) {
    const base = getIdentityBase();
    if (!base) {
        return NextResponse.redirect(new URL("/login?error=google", req.url));
    }

    const res = await fetch(`${base}/auth/google/start`, {redirect: "manual"});
    const location = res.headers.get("location");
    if (!location) {
        return NextResponse.redirect(new URL("/login?error=google", req.url));
    }
    return NextResponse.redirect(location);
}

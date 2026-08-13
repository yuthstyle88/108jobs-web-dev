// Phone/OTP sign-up and sign-in against Identity-Platform directly.
//
// Every other credential in this app goes through api-108jobs
// (loginWithIdentityPlatform / registerWithIdentityPlatform). This doesn't:
// the account may not exist yet, and api-108jobs has nothing to look up —
// Identity is the system of record for who you are. It provisions its own
// half (person + local_user) just-in-time on the first call that carries the
// resulting token. Mirrors 108jobs-flutter's identity_otp_api.dart.
//
// registerIfAbsent is always sent true: without it, verifying a code for a
// number nobody holds just confirms the code and stops; with it, Identity
// creates the account (verified, password-less) and returns the same
// credentials a password login would — so the caller never has to ask
// "sign in or sign up?" before it knows which one this is.
import {getIdentityBase} from "@/utils/env";
import {ApiError, FailedRequestState, REQUEST_STATE, SuccessRequestState} from "@/services/HttpService";

// Unlike HttpService's WrappedApiClient, a plain awaited fetch has no
// meaningful "loading"/"empty" moment to report -- narrowing callers to just
// these two members (instead of the full 4-member RequestState<T>) means
// checking `state === REQUEST_STATE.FAILED` is enough for TS to know the
// other branch has `.data`, with no unreachable cases to account for.
type Settled<T> = SuccessRequestState<T> | FailedRequestState;

export interface OtpChallenge {
    challengeId: string;
    /** Seconds since the Unix epoch — Identity's own unit and clock. */
    expiresAt: number;
}

export interface OtpLogin {
    identityId: string;
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    refreshToken: string;
    email?: string;
    emailVerified: boolean;
}

export interface OtpVerifyResult {
    verified: boolean;
    /** True when this call created the account rather than finding one. */
    registered: boolean;
    login: OtpLogin;
}

async function postIdentity<T>(path: string, body: unknown): Promise<Settled<T>> {
    const base = getIdentityBase();
    if (!base) {
        return {
            state: REQUEST_STATE.FAILED,
            err: {error: "identityNotConfigured", message: "NEXT_PUBLIC_IDENTITY_BASE_URL is not set"},
        };
    }
    try {
        const res = await fetch(`${base}${path}`, {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            return {state: REQUEST_STATE.FAILED, err: json as ApiError};
        }
        return {state: REQUEST_STATE.SUCCESS, data: json as T};
    } catch (e) {
        return {
            state: REQUEST_STATE.FAILED,
            err: {message: e instanceof Error ? e.message : String(e)},
        };
    }
}

/** Ask for a code to be sent to `phone` (E.164 — see normalizeThaiPhone). */
export async function requestOtp(phone: string): Promise<Settled<OtpChallenge>> {
    return postIdentity<OtpChallenge>("/auth/otp/request", {destination: phone, channel: "sms"});
}

interface RawOtpVerifyResponse {
    verified: boolean;
    registered?: boolean;
    login?: {
        identityId: string;
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
        email?: string;
        emailVerified: boolean;
    };
}

/**
 * Spend a code. Creates the account if the number is new to Identity.
 *
 * A verified code with no `login` in the response is treated as a failure
 * here even though it isn't a wrong-code error — it should not happen while
 * registerIfAbsent is true, and the caller has nothing to sign in with
 * either way.
 */
export async function verifyOtp(challengeId: string, code: string): Promise<Settled<OtpVerifyResult>> {
    const res = await postIdentity<RawOtpVerifyResponse>("/auth/otp/verify", {
        challengeId,
        code,
        registerIfAbsent: true,
    });
    if (res.state !== REQUEST_STATE.SUCCESS) return res;
    const raw = res.data;
    if (!raw.login?.access_token) {
        return {state: REQUEST_STATE.FAILED, err: {error: "otpLoginNotIssued"}};
    }
    return {
        state: REQUEST_STATE.SUCCESS,
        data: {
            verified: raw.verified,
            registered: raw.registered === true,
            login: {
                identityId: raw.login.identityId,
                accessToken: raw.login.access_token,
                tokenType: raw.login.token_type,
                expiresIn: raw.login.expires_in,
                refreshToken: raw.login.refresh_token,
                email: raw.login.email,
                emailVerified: raw.login.emailVerified,
            },
        },
    };
}

/**
 * Turn what somebody typed into the E.164 form Identity stores.
 *
 * Thai numbers are written locally as "081 234 5678" — a leading zero that's
 * a domestic trunk prefix, not part of the number — so "0812345678" and
 * "+66812345678" are the same phone and must not become two accounts.
 *
 * Returns null when the input isn't a number this can be confident about:
 * guessing is worse than refusing, since a wrong guess sends the code to
 * somebody else's phone.
 */
export function normalizeThaiPhone(input: string): string | null {
    const digits = input.replace(/[^\d+]/g, "");
    if (!digits) return null;

    if (digits.startsWith("+")) {
        const rest = digits.slice(1);
        if (rest.length < 8 || rest.length > 15) return null;
        return `+${rest}`;
    }

    if (digits.startsWith("0066")) return thaiFromNational(digits.slice(4));
    if (digits.startsWith("66") && digits.length >= 11) return `+${digits}`;
    if (digits.startsWith("0")) return thaiFromNational(digits.slice(1));

    return null;
}

function thaiFromNational(national: string): string | null {
    if (national.length !== 9) return null;
    return `+66${national}`;
}

// Passkey (WebAuthn) enrollment and sign-in against Identity-Platform,
// mirroring 108jobs-flutter's identity_passkey_api.dart + passkey_service.dart
// (which wrap native platform authenticator APIs; this wraps the browser's
// own navigator.credentials.create()/get()).
//
// Wire quirk verified against Identity-Platform-dev's actual source
// (crates/auth/src/infrastructure/webauthn_authenticator.rs): the challenge
// endpoints double-wrap their payload -- {"publicKey": {"publicKey": {...}}}
// -- because the `webauthn-rs` crate's own response type is already
// {publicKey: options}, and this service's own contract type wraps THAT in
// another {publicKey: ...} envelope. The inner options object itself matches
// the WebAuthn Level 3 JSON serialization spec exactly (unpadded base64url
// strings), so once unwrapped it's a direct fit for the browser's native
// PublicKeyCredential.parseCreationOptionsFromJSON()/parseRequestOptionsFromJSON().
// The /verify credential field is NOT double-wrapped -- credential.toJSON()'s
// output goes straight through.
import {getIdentityBase} from "@/utils/env";
import {ApiError, FailedRequestState, REQUEST_STATE, SuccessRequestState} from "@/services/HttpService";

type Settled<T> = SuccessRequestState<T> | FailedRequestState;

const REMEMBERED_IDENTIFIER_KEY = "108heros.passkeyIdentifier";

export interface PasskeyLogin {
    identityId: string;
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    refreshToken: string;
    email?: string;
    emailVerified: boolean;
}

interface DoubleWrapped {
    publicKey?: { publicKey?: unknown };
}

function unwrapPublicKey(body: DoubleWrapped): unknown {
    return body.publicKey?.publicKey;
}

async function postIdentity<T>(path: string, body: unknown, accessToken?: string): Promise<Settled<T>> {
    const base = getIdentityBase();
    if (!base) {
        return {state: REQUEST_STATE.FAILED, err: {error: "identityNotConfigured"}};
    }
    try {
        const headers: Record<string, string> = {"content-type": "application/json"};
        if (accessToken) headers.authorization = `Bearer ${accessToken}`;
        const res = await fetch(`${base}${path}`, {method: "POST", headers, body: JSON.stringify(body)});
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            return {state: REQUEST_STATE.FAILED, err: {...(json as ApiError), status: res.status}};
        }
        return {state: REQUEST_STATE.SUCCESS, data: json as T};
    } catch (e) {
        return {state: REQUEST_STATE.FAILED, err: {message: e instanceof Error ? e.message : String(e)}};
    }
}

/** True when this browser can plausibly complete a passkey ceremony. */
export function isPasskeySupported(): boolean {
    return typeof window !== "undefined"
        && "PublicKeyCredential" in window
        && typeof PublicKeyCredential.parseCreationOptionsFromJSON === "function"
        && typeof PublicKeyCredential.parseRequestOptionsFromJSON === "function";
}

/** The identifier (phone/email) this device last enrolled or signed in a passkey for, if any. */
export function rememberedPasskeyIdentifier(): string | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage.getItem(REMEMBERED_IDENTIFIER_KEY);
    } catch {
        return null;
    }
}

function rememberPasskeyIdentifier(identifier: string): void {
    try {
        window.localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, identifier);
    } catch {
        // best-effort -- a failed write just means the device gets asked again next time
    }
}

/**
 * Enroll a passkey for the identity that just signed in. Best-effort: the
 * caller already has a real session regardless of whether this succeeds, so
 * failures (user dismissed the prompt, no authenticator available) should be
 * swallowed rather than surfaced as errors -- there's nothing to recover.
 */
export async function enrollPasskey(identityId: string, accessToken: string, identifier: string): Promise<boolean> {
    if (!isPasskeySupported()) return false;
    try {
        const challengeRes = await postIdentity<DoubleWrapped>(
            "/auth/passkey/register/challenge", {identityId}, accessToken);
        if (challengeRes.state !== REQUEST_STATE.SUCCESS) return false;
        const optionsJson = unwrapPublicKey(challengeRes.data);
        if (!optionsJson) return false;

        const options = PublicKeyCredential.parseCreationOptionsFromJSON(optionsJson as any);
        const credential = await navigator.credentials.create({publicKey: options}) as PublicKeyCredential | null;
        if (!credential) return false;

        const credentialJson = (credential as any).toJSON();
        const verifyRes = await postIdentity<{ credentialId: string }>(
            "/auth/passkey/register/verify", {identityId, credential: credentialJson}, accessToken);
        if (verifyRes.state !== REQUEST_STATE.SUCCESS) return false;

        rememberPasskeyIdentifier(identifier);
        return true;
    } catch {
        // Includes the user cancelling the OS prompt (NotAllowedError) -- not an error to report.
        return false;
    }
}

/** Sign in with a passkey previously enrolled for `identifier`. */
export async function loginWithPasskey(identifier: string): Promise<Settled<PasskeyLogin>> {
    if (!isPasskeySupported()) {
        return {state: REQUEST_STATE.FAILED, err: {error: "passkeyNotSupported"}};
    }
    const challengeRes = await postIdentity<DoubleWrapped>("/auth/passkey/login/challenge", {identifier});
    if (challengeRes.state !== REQUEST_STATE.SUCCESS) return challengeRes;
    const optionsJson = unwrapPublicKey(challengeRes.data);
    if (!optionsJson) {
        return {state: REQUEST_STATE.FAILED, err: {error: "passkeyChallengeMalformed"}};
    }

    let credential: PublicKeyCredential | null;
    try {
        const options = PublicKeyCredential.parseRequestOptionsFromJSON(optionsJson as any);
        credential = await navigator.credentials.get({publicKey: options}) as PublicKeyCredential | null;
    } catch (e) {
        return {state: REQUEST_STATE.FAILED, err: {error: "passkeyCeremonyFailed", message: e instanceof Error ? e.message : String(e)}};
    }
    if (!credential) {
        return {state: REQUEST_STATE.FAILED, err: {error: "passkeyCeremonyFailed"}};
    }

    const credentialJson = (credential as any).toJSON();
    const verifyRes = await postIdentity<{
        identityId: string;
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
        email?: string;
        emailVerified: boolean;
    }>("/auth/passkey/login/verify", {identifier, credential: credentialJson});
    if (verifyRes.state !== REQUEST_STATE.SUCCESS) return verifyRes;

    rememberPasskeyIdentifier(identifier);
    const raw = verifyRes.data;
    return {
        state: REQUEST_STATE.SUCCESS,
        data: {
            identityId: raw.identityId,
            accessToken: raw.access_token,
            tokenType: raw.token_type,
            expiresIn: raw.expires_in,
            refreshToken: raw.refresh_token,
            email: raw.email,
            emailVerified: raw.emailVerified,
        },
    };
}

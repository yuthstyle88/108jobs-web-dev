// --- E2EE bootstrap mounted once at app root (not tied to rooms list) ---
import React, {useEffect} from "react";
import {UserService} from "@/services";
import {
    ensureIdentityKeyPair,
    ensureSharedKeyForLocalUser,
    kdfFromWireName,
} from "@/modules/chat/utils/security/crypto";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {REQUEST_STATE} from "@/services/HttpService";
import {useUserStore} from "@/store/useUserStore";

let __e2eeInitInFlight = false;
let __e2eeInitializedForUser: number | null = null;

export const EnsureSharedKeyBootstrap: React.FC = () => {
    const {user: localUser} = useUserStore();
    const {execute: exchangePublicKey} = useHttpPost('exchangePublicKey');
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const isLoggedIn = UserService.Instance.isLoggedIn;
            const uid = Number((localUser as any)?.id) || 0;
            if (!isLoggedIn || !uid) return;

            // If already initialized for this user and a key exists, skip.
            if (__e2eeInitializedForUser === uid && UserService.Instance.authInfo?.sharedKey) return;
            // Avoid concurrent runs.
            if (__e2eeInitInFlight) return;

            __e2eeInitInFlight = true;
            try {
                const {privateKey, publicKeyHex} = await ensureIdentityKeyPair();
                const resp = await exchangePublicKey({publicKey: publicKeyHex, kdf: 'hkdf-sha256'});
                if (resp.state !== REQUEST_STATE.SUCCESS) throw new Error('Failed to exchange public key');
                const serverPublicKeyHex = resp.data.publicKey;

                // Derive per the server's ECHO, never per what was asked for. A
                // server that predates the field ignores it and derives the old
                // way; deriving the new way against it would produce a key it
                // does not hold, and everything sent under that key would be
                // stored as ciphertext nobody can recover.
                const kdf = kdfFromWireName(resp.data.kdf);

                if (!cancelled) {
                    await ensureSharedKeyForLocalUser(uid, privateKey, serverPublicKeyHex, kdf);

                    // Which of this user's devices this browser is. Without it
                    // the socket falls back to the single `person.shared_key`,
                    // and the last device to exchange leaves every earlier one
                    // unable to be decrypted.
                    UserService.Instance.authInfo = {
                        ...(UserService.Instance.authInfo ?? {}),
                        chatKeyId: resp.data.keyId,
                    };
                    __e2eeInitializedForUser = uid;
                }
            } catch (e) {
                // best effort; allow a retry on next render if needed
            } finally {
                __e2eeInitInFlight = false;
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [localUser?.id, UserService.Instance.isLoggedIn]);

    return null;
};

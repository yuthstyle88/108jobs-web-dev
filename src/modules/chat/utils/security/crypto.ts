import {ID_PRIV_KEY_IDB, ID_PUB_SEC1_HEX_KEY} from "@/modules/chat/constants";
const crypto = globalThis.crypto;
import {UserService} from "@/services";
import {safeStorage} from "@/utils/safeStorage";
import {idbGet, idbSet} from "@/utils";

export type AESKey = CryptoKey;


// WebCrypto handle
const subtle = typeof window !== "undefined" ? window.crypto?.subtle : undefined;

// === Hex helpers ===
const hexToBytes = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)!.map(h => parseInt(h, 16)));
const bytesToHex = (buf: ArrayBuffer | Uint8Array) => {
  const a = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(a).map(b => b.toString(16).padStart(2, "0")).join("");
};

// === Identity keypair (ECDH P-256) ===
export async function ensureIdentityKeyPair(): Promise<{ privateKey: CryptoKey; publicKeyHex: string }> {
  if (!subtle) throw new Error("WebCrypto not available");

  const existingPriv = await idbGet<CryptoKey>(ID_PRIV_KEY_IDB);
  const existingPubHex = safeStorage.getItem(ID_PUB_SEC1_HEX_KEY) || undefined;
  if (existingPriv && existingPubHex) return { privateKey: existingPriv, publicKeyHex: existingPubHex };

  // Generate extractable pair to export public, then re-import private as non-extractable
  const pair = (await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const pubRaw = await subtle.exportKey("raw", pair.publicKey); // 65 bytes, SEC1 uncompressed
  const publicKeyHex = bytesToHex(pubRaw);

  const pkcs8 = await subtle.exportKey("pkcs8", pair.privateKey);
  const privateKey = await subtle.importKey("pkcs8", pkcs8, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);

  await idbSet(ID_PRIV_KEY_IDB, privateKey);
  try { safeStorage.setItem(ID_PUB_SEC1_HEX_KEY, publicKeyHex); } catch {}
  return { privateKey, publicKeyHex };
}

// === Peer public key (strict SEC1 uncompressed hex) ===
async function importServerPublicKeyHex(sec1Hex: string): Promise<CryptoKey> {
  if (!subtle) throw new Error("WebCrypto not available");
  const hex = String(sec1Hex || "").trim().toLowerCase();
  if (hex.length !== 130 || !hex.startsWith("04")) {
    throw new Error("Public key must be uncompressed SEC1 hex (130 chars, starts with 04)");
  }
  return subtle.importKey("raw", hexToBytes(hex), { name: "ECDH", namedCurve: "P-256" }, true, []);
}

/**
 * How the AES key is produced from the ECDH shared point.
 *
 * Negotiated with the server per exchange, and NOT a protocol-wide constant: a
 * client only ever reads content the relay re-encrypted under that client's own
 * key, so a browser on `hkdf-sha256` and a phone on `raw` never decrypt each
 * other's ciphertext and never have to agree.
 */
export type ChatKdf = "raw" | "hkdf-sha256";

/**
 * The `info` string bound into the HKDF expansion, for domain separation.
 *
 * Must match `CHAT_SESSION_KDF_INFO` in api-108jobs
 * (`crates/infra/src/crypto.rs`) and `_kdfInfo` in 108jobs-flutter
 * (`lib/core/crypto/chat_session_key.dart`) byte for byte.
 */
const KDF_INFO = "108jobs chat session key v1";

/**
 * The KDF the server says it used, or `raw` for anything unrecognised.
 *
 * Unrecognised includes absent, which is what an older server answers: it
 * ignores a field it does not know and derives the old way. Deriving what we
 * ASKED for against such a server produces a key it does not hold, and every
 * message sent under it is stored as ciphertext nobody can recover.
 */
export function kdfFromWireName(name: unknown): ChatKdf {
  return String(name ?? "").trim().toLowerCase() === "hkdf-sha256"
    ? "hkdf-sha256"
    : "raw";
}

// === Derive AES-GCM-256 from ECDH ===
//
// `raw` hands the X coordinate of the shared point straight to AES. That
// coordinate is a field element, not a uniform 256-bit string, which is not
// what a block cipher's key schedule expects; `hkdf-sha256` is the standard
// repair and costs one hash.
async function deriveKeyAesGcmKey(
  privateKey: CryptoKey,
  serverPublicKeyHex: string,
  kdf: ChatKdf = "raw",
): Promise<CryptoKey> {
  const peerPub = await importServerPublicKeyHex(serverPublicKeyHex);
  const shared = await subtle!.deriveBits({ name: "ECDH", public: peerPub }, privateKey, 256); // 32 bytes

  if (kdf !== "hkdf-sha256") {
    return subtle!.importKey("raw", shared, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  }

  // An EMPTY salt, which RFC 5869 defines as a HashLen block of zeros. WebCrypto
  // requires the parameter to be present, and an empty one is equivalent here
  // because HKDF-Extract is HMAC keyed by the salt and HMAC zero-pads any key
  // shorter than its block size. That equivalence is asserted rather than
  // assumed: the vector in crypto.test.ts is the same one api-108jobs and
  // 108jobs-flutter pin, so all three HKDF implementations are checked against
  // each other.
  const ikm = await subtle!.importKey("raw", shared, "HKDF", false, ["deriveBits"]);
  const okm = await subtle!.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(KDF_INFO),
    },
    ikm,
    256,
  );
  return subtle!.importKey("raw", okm, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

// In-memory cache: localUserId -> AES key (hex)
const LOCAL_USER_KEYS_MEM = new Map<string, CryptoKey>();

// Ensure a shared AES key for a room using the peer's public key (hex, strict 130)
export async function ensureSharedKeyForLocalUser(
  localUserId: string | number,
  privateKey: CryptoKey,
  sharedOrPubHex: string,
  kdf: ChatKdf = "raw"
): Promise<CryptoKey | null> {
    try {
        // guard: ต้องมี WebCrypto
        if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
        console.log('[crypto] ensureSharedKeyForLocalUser', { localUserId, sharedOrPubHex });
        const keyId = String(localUserId);

        // 1) ใช้ cache ถ้ามี
        const cached = LOCAL_USER_KEYS_MEM.get(keyId);
        if (cached) {
            // sync เข้า global สำหรับ consumer ที่อ่านจาก UserService
            UserService.Instance.authInfo = {
                ...(UserService.Instance.authInfo ?? {}),
                sharedKey: cached,
                claims: UserService.Instance.authInfo?.claims,
            };
            return cached;
        }

        // 2) ทำความสะอาด input
        let hex = String(sharedOrPubHex || '').trim().toLowerCase();
        if (!hex) return null;
        if (hex.startsWith('0x')) hex = hex.slice(2);

        let aes: CryptoKey | null = null;

        // 3) ถ้าเป็น AES-256 (64 hex) → import
        if (hex.length === 64) {
            aes = await importAesKey(hex);
        } else {
            // 4) ถ้าเป็น public key → เติม '04' ถ้าขาด แล้ว derive
            if (hex.length === 128) hex = `04${hex}`;
            if (hex.length === 130 && hex.startsWith('04')) {
                aes = await deriveKeyAesGcmKey(privateKey, hex, kdf);
            }
        }

        if (!aes) return null;

        // 5) cache และ sync เข้า UserService
        LOCAL_USER_KEYS_MEM.set(keyId, aes);
        UserService.Instance.authInfo = {
            ...(UserService.Instance.authInfo ?? {}),
            sharedKey: aes,
            claims: UserService.Instance.authInfo?.claims,
        };

        return aes;
    } catch (err) {
        try { console.warn('[crypto] ensureSharedKeyForLocalUser failed', err); } catch {}
        return null;
    }
}
// Import AES key from hex (64 chars)
export async function importAesKey(sharedKeyHex: string): Promise<AESKey> {
  if (!subtle) throw new Error("WebCrypto not available");
  const hex = String(sharedKeyHex || "").trim().toLowerCase();
  if (hex.length !== 64) throw new Error("AES-256 key must be 32 bytes (64 hex chars)");
  return subtle.importKey("raw", hexToBytes(hex), { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

// Derive AES key hex using a known private key and the server's public key hex
export async function deriveAesGcmKeyHex(
  clientPrivateKey: CryptoKey,
  serverPubHex: string,
  kdf: ChatKdf = "raw",
): Promise<string> {
  if (!subtle) throw new Error("WebCrypto not available");
  const aes = await deriveKeyAesGcmKey(clientPrivateKey, serverPubHex, kdf);
  return bytesToHex(await subtle.exportKey("raw", aes));
}
/**
 * AES-GCM-encrypt a UTF-8 string and return Base64 ciphertext with prepended nonce.
 *
 * The nonce is randomly generated (12 bytes, recommended for GCM) and prepended to the ciphertext.
 * The nonce is included in the output to allow decryption without separate storage.
 *
 * @param data       Plaintext string.
 * @param key        Symmetric `CryptoKey` (AES-GCM, 128/192/256-bit).
 * @returns          Base64 string containing nonce (12 bytes) + ciphertext.
 */
export async function encrypt(
  data: string,
  key: CryptoKey,
): Promise<string> {
    const nonce = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes is recommended for GCM
    const encoded = new TextEncoder().encode(data);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      encoded,
    );

    // Prepend nonce to ciphertext
    const combined = new Uint8Array(nonce.length + ciphertextBuffer.byteLength);
    combined.set(nonce, 0);
    combined.set(new Uint8Array(ciphertextBuffer), nonce.length);

    return Buffer.from(combined).toString("base64");
}

/**
 * Decrypt ciphertext produced by {@link encrypt}.
 *
 * @param ciphertextBase64  Base64 string containing nonce (12 bytes) + ciphertext.
 * @param key               Symmetric `CryptoKey` (same as encryption).
 * @returns                 Decrypted plaintext string (UTF-8).
 */
export async function decrypt(
  ciphertextBase64: string,
  key: CryptoKey,
): Promise<string> {
    const combined = Buffer.from(ciphertextBase64, "base64");
    if (combined.length < 12) {
        throw new Error("Ciphertext too short to contain valid nonce");
    }

    const nonce = combined.slice(0, 12); // Extract first 12 bytes as nonce
    const ciphertext = combined.slice(12); // Remainder is ciphertext

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      ciphertext,
    );

    return new TextDecoder().decode(decryptedBuffer);
}

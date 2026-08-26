import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The chat key derivation, checked against the other two implementations.
 *
 * `crypto.ts` reads `window.crypto.subtle` at module load, so the global has to
 * exist before the import — hence the dynamic import below rather than a
 * top-level one.
 */
let mod: typeof import("./crypto");

beforeAll(async () => {
  // jsdom's `window.crypto` is a getter-only property and carries no `subtle`,
  // so it has to be replaced rather than assigned to. Node's own WebCrypto is
  // the same API the browser gives us, which is what makes this a fair check
  // of what ships.
  if (typeof globalThis.window === "undefined") {
    (globalThis as unknown as { window: unknown }).window = globalThis;
  }
  for (const target of [globalThis, globalThis.window]) {
    if (!(target as { crypto?: Crypto }).crypto?.subtle) {
      Object.defineProperty(target, "crypto", { value: webcrypto, configurable: true });
    }
  }
  mod = await import("./crypto");
});

const hexToBytes = (hex: string) =>
  new Uint8Array(hex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16)));

/**
 * The vector pinned in api-108heros (`crypto::tests::flutter_vector`) and in
 * 108heros-flutter (`chat_session_key_test.dart`). It was produced by the
 * Flutter client's PointyCastle implementation; the derived keys below are what
 * the Rust server asserts. Three unrelated crypto stacks, one set of bytes.
 */
const VECTOR = {
  deviceScalar: "030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dc",
  serverPub:
    "045a7442d7f7154bc4a6224ba60d4e34e55f4fd3d918f3edd9162a94345989590a" +
    "408ba7e007a9fb6190e133e0d45d1a0443a34d410cc8c4397016db1990b4e08c",
  rawKey: "0b9ecdfbb76a77e4c92278414b57c578a468bebf8e6311b0d4347fe37385f635",
  hkdfKey: "8c6a033330827a87121514f36cf258a73e9ee975f30e8f10defffa86f38fd23b",
};

/**
 * Import the vector's private scalar as an ECDH key.
 *
 * WebCrypto will not take a raw scalar, so it goes in as a JWK — `d` is the
 * scalar and `x`/`y` are its public point, which we get by importing the public
 * half separately. Roundabout, but it is the only way to pin a fixed key here.
 */
async function importDeviceKey(): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;

  // Derive the public point for the scalar by letting WebCrypto do it: import
  // the scalar with a placeholder point is not possible, so compute x/y from
  // the known public key of that scalar, pinned alongside the vector.
  const devicePubHex =
    "042475b1acbe8c58c6e92a51791be1142d8a4727933a3e711d95e83ae95d110afa" +
    "650b848a41965cde7f00a25837ec61fc78cb9eaad01b8429564ccfa1c1586c98";
  const pub = hexToBytes(devicePubHex);
  const b64u = (b: Uint8Array) =>
    Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: b64u(hexToBytes(VECTOR.deviceScalar)),
      x: b64u(pub.slice(1, 33)),
      y: b64u(pub.slice(33, 65)),
      ext: true,
    },
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
}

describe("kdfFromWireName", () => {
  it("treats absent, empty and unknown as raw", () => {
    // The failure this guards is silent and unrecoverable: derive HKDF against
    // a server that ignored the field, and every message this browser sends is
    // persisted as ciphertext nobody holds a key for.
    expect(mod.kdfFromWireName(undefined)).toBe("raw");
    expect(mod.kdfFromWireName(null)).toBe("raw");
    expect(mod.kdfFromWireName("")).toBe("raw");
    expect(mod.kdfFromWireName("hkdf-sha512")).toBe("raw");
    expect(mod.kdfFromWireName("raw")).toBe("raw");
  });

  it("recognises the echoed name, whatever its case or spacing", () => {
    expect(mod.kdfFromWireName("hkdf-sha256")).toBe("hkdf-sha256");
    expect(mod.kdfFromWireName("  HKDF-SHA256 ")).toBe("hkdf-sha256");
  });
});

describe("deriveAesGcmKeyHex", () => {
  it("matches the raw vector the server and the app pin", async () => {
    const key = await importDeviceKey();
    expect(await mod.deriveAesGcmKeyHex(key, VECTOR.serverPub)).toBe(VECTOR.rawKey);
  });

  it("matches the hkdf-sha256 vector the server and the app pin", async () => {
    // This is the assertion that makes the negotiation safe to enable here.
    // WebCrypto demands a salt parameter and RFC 5869 defines an absent salt as
    // HashLen zeros; PointyCastle and the Rust `hkdf` crate take the absent
    // form. If an empty salt were not equivalent, this is where it shows up —
    // and it would show up as a browser whose messages nobody else can read.
    const key = await importDeviceKey();
    expect(await mod.deriveAesGcmKeyHex(key, VECTOR.serverPub, "hkdf-sha256")).toBe(
      VECTOR.hkdfKey,
    );
  });

  it("gives a different key for each derivation", async () => {
    const key = await importDeviceKey();
    const raw = await mod.deriveAesGcmKeyHex(key, VECTOR.serverPub);
    const hkdf = await mod.deriveAesGcmKeyHex(key, VECTOR.serverPub, "hkdf-sha256");
    expect(hkdf).not.toBe(raw);
  });
});

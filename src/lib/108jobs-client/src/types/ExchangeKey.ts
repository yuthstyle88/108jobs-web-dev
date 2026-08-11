export type ExchangeKey = {
  publicKey: string,
  /**
   * Which key-derivation to apply to the ECDH shared point.
   *
   * Absent means `raw` — the X coordinate used directly as the AES key, which
   * is what this client did before the field existed. `hkdf-sha256` asks for
   * HKDF instead.
   *
   * Derive according to the server's ECHO, never according to this. A server
   * that predates the field ignores it, and a client that assumed otherwise
   * would hold a key the server does not — every message it sent would be
   * persisted as ciphertext nobody can recover.
   */
  kdf?: string,
};

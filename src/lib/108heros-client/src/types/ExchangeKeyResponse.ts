export type ExchangeKeyResponse = {
  publicKey: string,
  /**
   * Which `chat_session_key` row this exchange created. Sent back when opening
   * the chat socket so the relay knows which of this user's devices is
   * connecting, and therefore which key to decrypt and re-encrypt with.
   *
   * Absent against a server without per-device keys: the socket then connects
   * without one and gets the single `person.shared_key`, which is what every
   * device shared before — and why a second device used to leave the first
   * one's messages unreadable.
   */
  keyId?: number,
  /** The derivation actually used. The only thing to derive from. */
  kdf?: string,
};

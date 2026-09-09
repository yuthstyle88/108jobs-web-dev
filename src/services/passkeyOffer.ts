export interface PasskeyOfferContext {
  /** Whether this browser can create a passkey at all. */
  supported: boolean;
  /** The identifier this device already holds a passkey for, if any. */
  rememberedIdentifier: string | null;
  /** The identifier that just signed in. */
  identifier: string;
}

/**
 * Whether to **ask** about creating a passkey — not whether to create one.
 *
 * Enrolment raises the platform authenticator, and enrolment used to happen the
 * moment a sign-in finished, with no question asked. A sheet nobody announced
 * is not a choice: the only way to decline was to dismiss an OS prompt that had
 * appeared for no stated reason, and on a browser with no usable authenticator
 * the sign-in redirect simply waited for it — sixty seconds of spinner on the
 * default path into the app (#137, #146).
 *
 * So the question comes first, in the page, where it costs a click. Only an
 * explicit yes raises anything, which is also what makes "no" a real answer.
 * This mirrors `askToCreatePasskey` in 108jobs-flutter, which asks the same
 * question for the same reasons.
 *
 * Declining is deliberately not recorded: the offer returns at the next
 * sign-in. There is nowhere else in the app to create a passkey, so a
 * remembered refusal would be a permanent opt-out chosen once, in a hurry.
 */
export function shouldOfferPasskey({
  supported,
  rememberedIdentifier,
  identifier,
}: PasskeyOfferContext): boolean {
  // Nothing to raise, so nothing to promise.
  if (!supported) return false;

  // The dialog names the account so the answer means something. With no name
  // to show, asking is worse than staying quiet.
  if (!identifier.trim()) return false;

  // Already covered on this device. Note this compares against *this*
  // identifier: on a shared device the remembered passkey may belong to
  // somebody else, and the person who just signed in still has none.
  return rememberedIdentifier !== identifier;
}

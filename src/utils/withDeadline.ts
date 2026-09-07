/**
 * Race `work` against a deadline, aborting it if the deadline wins.
 *
 * Written for passkey enrolment, which sits between a successful OTP verify
 * and the redirect into the app. `navigator.credentials.create()` had no
 * timeout and no `AbortController`: its `catch` handled the user *declining*
 * the OS prompt, but not a prompt that simply never resolves — no platform
 * authenticator, a dismissed system dialog that reports nothing, a browser
 * that never answers. The submit button stays disabled behind
 * `formState.isSubmitting`, so an already-authenticated person is stuck
 * looking at a spinner (#137).
 *
 * Resolves `null` on expiry rather than throwing, because a passkey that did
 * not get created is not an error — enrolment is offered, not required.
 * Rejections pass straight through, so a genuine failure still reads as one.
 */
export async function withDeadline<T>(
  work: Promise<T>,
  ms: number,
  controller: AbortController,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      // Abort first: it is what lets the browser tear the prompt down instead
      // of leaving it on screen after the app has moved on.
      controller.abort();
      resolve(null);
    }, ms);
  });

  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

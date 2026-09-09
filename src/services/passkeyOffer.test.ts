import { describe, expect, it } from "vitest";
import { shouldOfferPasskey } from "./passkeyOffer";

// Whether to ASK about enrolling a passkey -- not whether to enrol. Enrolling
// raises the platform authenticator, and a sheet nobody announced is not a
// choice: the only way to decline is to dismiss an OS prompt that appeared for
// no stated reason. So the question comes first, and this decides when the
// question is worth asking at all (#146).
describe("shouldOfferPasskey", () => {
  it("offers when the browser supports passkeys and this device has none for the number", () => {
    expect(
      shouldOfferPasskey({
        supported: true,
        rememberedIdentifier: null,
        identifier: "+66900000911",
      }),
    ).toBe(true);
  });

  it("stays quiet when the browser cannot do passkeys", () => {
    // Asking would promise something that cannot be delivered, and answering
    // yes would raise nothing.
    expect(
      shouldOfferPasskey({
        supported: false,
        rememberedIdentifier: null,
        identifier: "+66900000911",
      }),
    ).toBe(false);
  });

  it("stays quiet when this device already has a passkey for this number", () => {
    expect(
      shouldOfferPasskey({
        supported: true,
        rememberedIdentifier: "+66900000911",
        identifier: "+66900000911",
      }),
    ).toBe(false);
  });

  it("offers when the remembered passkey belongs to a different account", () => {
    // A shared device: the passkey already here is somebody else's, so the
    // person who just signed in still has none.
    expect(
      shouldOfferPasskey({
        supported: true,
        rememberedIdentifier: "+66900000999",
        identifier: "+66900000911",
      }),
    ).toBe(true);
  });

  it("stays quiet when there is no identifier to name", () => {
    // The dialog names the number so the answer is meaningful. With nothing to
    // name, asking is worse than not asking.
    expect(
      shouldOfferPasskey({
        supported: true,
        rememberedIdentifier: null,
        identifier: "",
      }),
    ).toBe(false);
  });
});

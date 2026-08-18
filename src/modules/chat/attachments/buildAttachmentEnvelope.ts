import {serializeStructured} from "@/modules/chat/utils/structured";

export type AttachmentEnvelopeInput = {
  url: string;
  /** The user's original filename, never the storage handle. */
  name: string;
  mime?: string;
  caption?: string;
  assetId?: string;
  /** Defaults to `"file"`; delivery submissions pass `"submit-delivery"`. */
  type?: "file" | "submit-delivery";
};

/**
 * The envelope's fields as an object, for senders that serialize it
 * themselves. `sendStructured` takes an object and stringifies internally, so
 * handing it a pre-serialized string would double-encode.
 */
export function attachmentEnvelopeFields(
  input: AttachmentEnvelopeInput,
): Record<string, unknown> {
  const envelope: Record<string, unknown> = {
    type: input.type ?? "file",
    url: input.url,
    name: input.name,
  };
  if (input.mime) envelope.mime = input.mime;
  if (input.caption) envelope.caption = input.caption;
  if (input.assetId) envelope.assetId = input.assetId;
  return envelope;
}

/**
 * The one place an outgoing attachment envelope is written.
 *
 * Two senders build these — an ordinary chat attachment and a delivery
 * submission — and they drifted apart before, which is how `assetId` ended up
 * on neither. Optional fields are omitted rather than sent as null, so an
 * older client reading this sees exactly the envelope it always did.
 */
export function buildAttachmentEnvelope(input: AttachmentEnvelopeInput): string {
  return serializeStructured(attachmentEnvelopeFields(input));
}

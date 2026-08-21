/**
 * Which media tab an attachment belongs in. `file` is the catch-all, matching
 * MAD's own `File` kind: stored and served verbatim, never transcoded.
 */
export type AttachmentKind = "image" | "video" | "file";

/**
 * Message `type` values that carry a file envelope. `submit-delivery`
 * (see `useWorkflowActions`) has the same url/name/mime shape as a plain
 * attachment and is a file the room's participants sent each other, so it
 * belongs in Media too — its bubble keeps rendering as a workflow card.
 */
export const ATTACHMENT_MESSAGE_TYPES = ["file", "submit-delivery"] as const;

/** A parsed attachment envelope. Every field is already validated. */
export type ChatAttachment = {
  kind: AttachmentKind;
  url: string;
  /** The user's original filename. */
  name: string;
  mime?: string;
  caption?: string;
  /** MAD asset id. Absent on every message sent before this shipped. */
  assetId?: string;
};

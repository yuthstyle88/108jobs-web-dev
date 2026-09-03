import type {ChatMessage} from "@108-plaza/jh-client";

import {compareNewestFirst} from "@/modules/chat/utils/ordering";

import {parseAttachment} from "./parseAttachment";
import type {ChatAttachment} from "./types";

/** One attachment, with enough of its message to jump back to it. */
export type AttachmentItem = {
  messageId: string;
  senderId: number;
  createdAt: string;
  isOwner: boolean;
  attachment: ChatAttachment;
};

/**
 * Every attachment in a room's decrypted messages, newest first.
 *
 * The input is whatever `chatStore` currently holds — messages arrive
 * decrypted, so this needs no key and no network. It grows as history is
 * backfilled, which is what makes the media panel fill in progressively.
 */
export function collectAttachments(messages: readonly ChatMessage[]): AttachmentItem[] {
  const items: AttachmentItem[] = [];

  for (const message of messages) {
    const attachment = parseAttachment(message?.content);
    if (!attachment) continue;
    items.push({
      messageId: String(message.id),
      senderId: Number(message.senderId) || 0,
      createdAt: message.createdAt,
      isOwner: Boolean(message.isOwner),
      attachment,
    });
  }

  return items.sort(compareNewestFirst);
}

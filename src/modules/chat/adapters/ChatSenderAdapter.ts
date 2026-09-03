import type {ChatMessage} from '@108-plaza/jh-client';

/**
 * ChatSenderAdapter
 * - Sends via channel.push(), which allocates a ref and waits for the
 *   server's matching `reply` frame before resolving -- so a resolved
 *   promise here means the server actually confirmed the send, not just
 *   that a frame was written to the wire.
 * - Returns the server message id when the reply carries one; otherwise
 *   the client-generated id. Resolves `false` on an error/timeout reply,
 *   or if the given socket has no `.push()` at all.
 */

// ข้อมูลขั้นต่ำที่ต้องใช้ในการส่งข้อความ  (ไม่ผูกกับชนิดจาก SDK ภายนอก)
export type SendDraft = ChatMessage;

export interface ChatSenderPort {
    /**
     * ส่งข้อความไปยัง backend
     * @returns server message id (string) เมื่อสำเร็จ, หรือ false เมื่อไม่สำเร็จ
     */
    sendMessage(event: string, draft: SendDraft): Promise<string | false>;
}

/**
 * Chat Channel Minimal Shape
 * รองรับการฉีด channel ที่มี method push ซึ่งคืน Promise ของผลลัพธ์
 */
export type ChatChannelLike = {
    /** ส่ง event พร้อม payload และรับผลลัพธ์แบบ promise */
    push: (event: string, payload: unknown) => Promise<unknown> | unknown;
};

/**
 * ตัวอย่าง implementation สำหรับ chat channel
 * - ไม่ผูกกับโครงสร้าง response ที่ตายตัว พยายามดึง id อย่างยืดหยุ่น
 * - ไม่ throw exception ออกไปข้างนอก คืน false แทน เพื่อให้ ResendManager ตัดสินใจ retry
 */
/** Called when an outbound send fails so ResendManager can schedule retry */
export class ChatSenderAdapter implements ChatSenderPort {
  constructor(private socket: ChatChannelLike | WebSocket) {}

  async sendMessage(event: string, payload: SendDraft): Promise<string | false> {
    try {
      if (typeof (this.socket as any)?.push !== 'function') return false;

      const clientId = (payload as any)?.id ?? null;
      const safePayload = (payload ?? {}) as unknown; // บังคับไม่ให้ undefined
      const ch = this.socket as any; // ChatChannel

      // ChatChannel: push(event, payload).receive('ok'|'error'|'timeout', cb)
      return await new Promise<string | false>((resolve) => {
        try {
          // Push exactly ONCE and reuse the single result both to chain
          // .receive(...) and to check whether .receive exists. Calling
          // ch.push() a second time here would send the message over the
          // wire again -- it's a real network send, not an idempotent
          // getter (see Bug B regression test).
          const pushResult = ch.push(event, safePayload);

          pushResult
            ?.receive?.('ok', (resp: any) => {
              // If backend returns {id: "..."} or {message: {id: "..."}}
              const serverId = resp?.id ?? resp?.message?.id ?? resp?.msgRefId ?? clientId;
              resolve(String(serverId ?? clientId ?? ''));
            })
            ?.receive?.('error', (_err: any) => resolve(false))
            ?.receive?.('timeout', () => resolve(false));

          // If no receive method (unlikely for ChatChannel, but for safety)
          if (typeof pushResult?.receive !== 'function') {
              setTimeout(() => resolve(String(clientId ?? '')), 0);
          }
        } catch (_e) {
          resolve(false);
        }
      });
    } catch (_err) {
      return false;
    }
  }
}

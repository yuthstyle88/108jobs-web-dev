/**
 * ResendManager
 * --------------
 * จัดการคิว resend สำหรับข้อความที่ส่งไม่สำเร็จ (retry/backoff/jitter/limit)
 *
 * แนวคิดหลัก:
 * - ไม่มี loop ทำงานเองตลอดเวลา
 * - จะถูก "ปลุก" จากสองเหตุการณ์เท่านั้น
 *   1) onSendFailure(messageId) → ตั้ง retry meta และกำหนดรอบถัดไป
 *   2) flushAll() จาก NetworkMonitor เมื่อ OFF→ON
 * - สามารถสั่ง flushActive(roomId) ได้จาก UI (เช่นปุ่มลองใหม่ในห้องปัจจุบัน)
 * - ใช้ mutex ป้องกันการทำงานซ้อน
 */

import type {ChatSenderAdapter, SendDraft} from '../adapters/ChatSenderAdapter'
import {ChatMessageModel} from "@/modules/chat/types";
import {WS_EVENT} from "@/modules/chat/protocol/wireEvents";


export type RetryMeta = Record<string, { retry: number; next: number }>

/** พอร์ตขั้นต่ำของ store ที่ ResendManager ต้องใช้ */
export interface ChatStorePort {
    getState(): {
        failedMessages: ChatMessageModel[]
        retryMeta: RetryMeta
    }

    upsertRetryMeta: (id: string, meta: { retry: number; next: number }) => void
    dropRetryMeta: (id: string) => void
    markFailed: (roomId: string, id: string) => void;
    promoteToSent: (roomId: string, id: string) => void;
}

export class ResendManager {
    private isResendingAll = false
    private isResendingActive = false
    private isDestroyed = false
    private inFlight = new Set<string>()

    // delay ตารางพื้นฐาน (ms)
    private readonly baseDelays = [1000, 2000, 5000] as const

    constructor(
        private readonly store: ChatStorePort,
        private readonly sender: ChatSenderAdapter,
    ) {
    }

    destroy() {
        this.isDestroyed = true
    }

    /**
     * เรียกเมื่อส่งข้อความล้มเหลวครั้งแรก (หรือครั้งต่อ ๆ มา)
     * จะตั้ง retry meta และรอบเวลา next
     *
     * Also self-schedules the actual resend after the computed delay --
     * nothing else revisits a staged retry (only a manual UI retry button
     * or an offline->online transition trigger a flush), so without this,
     * calling onSendFailure would only ever stage state that's never acted
     * on until the user notices and retries by hand.
     */
    onSendFailure(messageId: string, roomId: string) {
        const {retryMeta} = this.store.getState()
        const prev = retryMeta[messageId]
        const retry = (prev?.retry ?? 0)
        this.scheduleRetry(messageId, roomId, retry)
    }

    /**
     * อัปเดต retryMeta ให้ข้อความ messageId แล้วตั้ง setTimeout เพื่อปลุก
     * flushActive(roomId) อีกครั้งเมื่อครบ backoff delay ของ retryCount นั้น
     *
     * เป็น logic ร่วมระหว่าง onSendFailure (ความล้มเหลวครั้งแรก) และ
     * flush()'s สองจุดที่ resend attempt ล้มเหลว (server ปฏิเสธ หรือ
     * sendMessage throw) -- ถ้าไม่มี setTimeout นี้ retryMeta จะถูกอัปเดต
     * ว่าให้ลองใหม่ที่เวลา X แต่ไม่มีอะไรมาปลุกที่เวลา X จริง ๆ
     */
    private scheduleRetry(messageId: string, roomId: string, retryCount: number) {
        const delay = this.backoffDelay(retryCount)
        this.store.upsertRetryMeta(messageId, {retry: retryCount, next: Date.now() + delay})
        setTimeout(() => {
            this.flushActive(roomId).catch(() => {
            })
        }, delay)
    }

    /** ปลุกเฉพาะห้องปัจจุบันให้ลองส่งใหม่ */
    async flushActive(roomId: string) {
        if (this.isResendingAll || this.isResendingActive) return
        this.isResendingActive = true
        try {
            await this.flush((m) => String(m.roomId) === String(roomId))
        } finally {
            this.isResendingActive = false
        }
    }

    /**
     * สั่งลองส่งข้อความใหม่โดยตรงจากผู้ใช้ (Manual Retry)
     * แยกเส้นทางจาก auto-retry ชัดเจน: ข้ามเพดาน retry < 3
     * แต่ยังคงป้องกันการส่งซ้ำซ้อนด้วย inFlight mutex
     */
    async retryNow(roomId: string, messageId?: string): Promise<void> {
        if (this.isDestroyed) return
        const {failedMessages} = this.store.getState()
        const targets = failedMessages.filter((m) => {
            const isRoom = String(m.roomId) === String(roomId)
            const isMsg = messageId ? String(m.id) === String(messageId) : true
            return isRoom && isMsg && !this.inFlight.has(m.id)
        })

        for (const msg of targets) {
            this.inFlight.add(msg.id)
            try {
                const draft: SendDraft = {
                    roomId: msg.roomId,
                    senderId: msg.senderId,
                    secure: msg.secure,
                    content: msg.content,
                    createdAt: msg.createdAt,
                    status: 'retrying',
                    id: msg.id,
                }

                const serverId = await this.sender.sendMessage(WS_EVENT.Message, draft)

                // ตรวจสอบว่าห้อง/ข้อความยังเปิดอยู่หรือไม่ (Edge case 5: ไม่ตั้ง state ของห้องที่ปิดแล้ว)
                if (this.isDestroyed) return
                const {failedMessages: currentFailed} = this.store.getState()
                const stillExists = currentFailed.some(
                    (m) => String(m.id) === String(msg.id) && String(m.roomId) === String(msg.roomId)
                )
                if (!stillExists) return

                if (typeof serverId === 'string' && serverId.length > 0) {
                    // ส่งสำเร็จ → promote และล้าง retry meta (Edge case 6)
                    this.store.promoteToSent(msg.roomId, msg.id)
                    this.store.dropRetryMeta(msg.id)
                } else {
                    // ส่งไม่สำเร็จ → กลับเป็น failed และไม่ล็อกปุ่ม (ผู้ใช้กดใหม่ได้อีก)
                    // รักษาเพดาน auto-retry ไว้ที่ 3 เพื่อไม่ให้ auto-retry วนยิงเอง
                    const now = Date.now()
                    this.store.markFailed(msg.roomId, msg.id)
                    this.store.upsertRetryMeta(msg.id, {retry: 3, next: now + this.backoffDelay(3)})
                }
            } catch {
                if (this.isDestroyed) return
                const {failedMessages: currentFailed} = this.store.getState()
                const stillExists = currentFailed.some(
                    (m) => String(m.id) === String(msg.id) && String(m.roomId) === String(msg.roomId)
                )
                if (!stillExists) return

                const now = Date.now()
                this.store.markFailed(msg.roomId, msg.id)
                this.store.upsertRetryMeta(msg.id, {retry: 3, next: now + this.backoffDelay(3)})
            } finally {
                this.inFlight.delete(msg.id)
            }
        }
    }

    /** ปลุกทุกห้อง (เช่นตอน OFF→ON) */
    async flushAll() {
        if (this.isResendingAll || this.isResendingActive) return
        this.isResendingAll = true
        try {
            const {failedMessages, retryMeta} = this.store.getState()
            const now = Date.now()

            // สร้าง/รีเฟรช retry meta สำหรับทุก failed เพื่อให้พร้อมส่งทันที
            for (const msg of failedMessages) {
                const meta = retryMeta[msg.id]
                const retry = meta?.retry ?? 0
                this.store.upsertRetryMeta(msg.id, {retry, next: now}) // next=now → due
            }

            // ส่งทุกห้องที่ครบกำหนด (predicate = true)
            await this.flush(() => true)
        } finally {
            this.isResendingAll = false
        }
    }


    /** ตัวทำงานหลัก ใช้ predicate เลือกข้อความ */
    private async flush(predicate: (m: ChatMessageModel) => boolean) {
        const {failedMessages, retryMeta} = this.store.getState()
        const now = Date.now()

        // NOTE: failedMessages มีเฉพาะที่ส่งไม่สำเร็จ เราอนุญาตให้ resend ได้เมื่อ meta.next ถึงกำหนด
        // คัดเฉพาะข้อความที่ครบกำหนดและยังไม่เกินลิมิต 3 ครั้ง
        const due = failedMessages.filter((m) => {
            if (!predicate(m)) return false
            const meta = retryMeta[m.id]
            const count = meta?.retry ?? 0
            if (!meta) return false // ต้องมี meta จาก onSendFailure ก่อน
            return meta.next <= now && count < 3 && !this.inFlight.has(m.id)
        })

        for (const msg of due) {
            this.inFlight.add(msg.id)
            try {
                // เตรียม draft สำหรับส่ง
                const draft: SendDraft = {
                    roomId: msg.roomId,
                    senderId: msg.senderId,
                    secure: msg.secure,
                    content: msg.content,
                    createdAt: msg.createdAt,
                    status: 'retrying',
                    id: msg.id, // ใช้ client id เพื่อให้ server ทำ idempotency ได้
                }

                const serverId = await this.sender.sendMessage(WS_EVENT.Message, draft)

                if (this.isDestroyed) return
                const {failedMessages: currentFailed} = this.store.getState()
                const stillExists = currentFailed.some(
                    (m) => String(m.id) === String(msg.id) && String(m.roomId) === String(msg.roomId)
                )
                if (!stillExists) return

                if (typeof serverId === 'string' && serverId.length > 0) {
                    // ส่งสำเร็จ → promote และล้าง retry meta
                    this.store.promoteToSent(msg.roomId, msg.id)
                    this.store.dropRetryMeta(msg.id)
                } else {
                    // ส่งไม่สำเร็จ → เพิ่มรอบ retry และตั้ง next ใหม่
                    const {retryMeta: metaNow} = this.store.getState()
                    const prev = metaNow[msg.id] ?? {retry: 0, next: now}
                    const nextRetry = prev.retry + 1
                    if (nextRetry >= 3) {
                        this.store.markFailed(msg.roomId, msg.id)
                        this.store.upsertRetryMeta(msg.id, {retry: nextRetry, next: now + this.backoffDelay(nextRetry)})
                    } else {
                        // ยังไม่เกินลิมิต → ตั้ง timer ปลุก flushActive ใหม่ที่ next นี้
                        // ไม่งั้น retryMeta จะถูกอัปเดตแต่ไม่มีอะไรมาปลุกที่เวลานั้นจริง ๆ
                        this.scheduleRetry(msg.id, msg.roomId, nextRetry)
                    }
                }
            } catch {
                if (this.isDestroyed) return
                const {failedMessages: currentFailed} = this.store.getState()
                const stillExists = currentFailed.some(
                    (m) => String(m.id) === String(msg.id) && String(m.roomId) === String(msg.roomId)
                )
                if (!stillExists) return

                // treat as failure with backoff
                const {retryMeta: metaNow} = this.store.getState()
                const prev = metaNow[msg.id] ?? {retry: 0, next: now}
                const nextRetry = prev.retry + 1
                if (nextRetry >= 3) {
                    this.store.markFailed(msg.roomId, msg.id)
                    this.store.upsertRetryMeta(msg.id, {retry: nextRetry, next: now + this.backoffDelay(nextRetry)})
                } else {
                    // ยังไม่เกินลิมิต → ตั้ง timer ปลุก flushActive ใหม่ที่ next นี้
                    this.scheduleRetry(msg.id, msg.roomId, nextRetry)
                }
            } finally {
                this.inFlight.delete(msg.id)
            }
        }
    }

    /**
     * คำนวณดีเลย์ถัดไปตาม retry ครั้งที่ n (0-based)
     * ใช้ jitter เล็กน้อยเพื่อลดโอกาสชนกัน (±15%)
     */
    private backoffDelay(retryCount: number) {
        const base = this.baseDelays[Math.min(retryCount, this.baseDelays.length - 1)]
        return withJitter(base, 0.15)
    }
}

function withJitter(ms: number, ratio = 0.15) {
    const delta = ms * ratio
    const min = Math.max(0, ms - delta)
    const max = ms + delta
    return Math.floor(min + Math.random() * (max - min))
}

import {dbg} from "@/modules/chat/utils/helpers";

let __wireRef = 0;
const nextRef = () => String(++__wireRef);

export function wsSend(socket: any, obj: any) {
    if (!socket) return false;
    const event = obj?.event ?? obj?.type ?? 'message';
    const payload = obj?.payload ?? obj;
    const frame = { event, payload };
    try {
        // 1) ChatChannel API (channel.push(event, payload))
        if (typeof socket.push === 'function') {
            dbg('wsSend → channel.push', frame);
            socket.push(event, payload);
            return true;
        }
        // 2) Adapter with emit(event, payload)
        if (typeof socket.emit === 'function') {
            dbg('wsSend → adapter.emit', frame);
            socket.emit(event, payload);
            return true;
        }
        // 3) Raw WebSocket API
        if (typeof socket.send === 'function') {
            const canCheckReady = typeof (globalThis as any).WebSocket !== 'undefined' && typeof socket.readyState === 'number';
            if (canCheckReady && socket.readyState !== (globalThis as any).WebSocket.OPEN) {
                dbg('wsSend → raw ws not open', { readyState: socket.readyState });
                return false;
            }
            // wire v2: one object envelope, always. `room` is the bare room id
            // and is simply omitted when there isn't one -- under the old
            // five-slot array a missing field had to be a null placeholder or
            // everything after it shifted. `ref` correlates the server's reply.
            const room = payload?.roomId ? String(payload.roomId) : null;
            const wireFrame: Record<string, unknown> = {
                ref: nextRef(),
                event: String(event),
                payload: payload ?? {},
            };
            if (room) wireFrame.room = room;
            dbg('wsSend → raw ws (wire v2)', { wireFrame });
            socket.send(JSON.stringify(wireFrame));
            return true;
        }
        // 4) postMessage (BroadcastChannel/Worker/ServiceWorker)
        if (typeof socket.postMessage === 'function') {
            dbg('wsSend → postMessage', frame);
            socket.postMessage(frame);
            return true;
        }
        // 5) Generic sendMessage(event, payload) or sendMessage(frame)
        if (typeof socket.sendMessage === 'function') {
            dbg('wsSend → sendMessage', frame);
            try { socket.sendMessage(event, payload); } catch { socket.sendMessage(frame); }
            return true;
        }
        dbg('wsSend → no send method found');
        return false;
    } catch (err) {
        dbg('wsSend → error', { err });
        return false;
    }
}
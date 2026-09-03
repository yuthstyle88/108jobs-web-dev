import {useCallback, useRef} from 'react';
import type {StatusKey} from '@/modules/chat/components/FreelanceChatFlow';
import type {ChatMessage as WsChatMessage} from '@108-plaza/jh-client';
import {TYPES_TO_STATUS} from '@/modules/chat/utils/workflowTypes';

export interface UseWorkflowStatusParams {
    currentStatus: StatusKey;
    setWorkflowState: (s: StatusKey, statusBeforeCancel?: StatusKey) => void;
    hasStarted: boolean;
    setHasStarted: (b: boolean) => void;
    ORDER: readonly StatusKey[];
    send: (evt: { type: 'NEXT' | 'BACK' }) => void;
    canGo: (key: StatusKey) => boolean;
    statusBeforeCancel?: StatusKey;
}

export const useWorkflowStatus = ({
                                      currentStatus,
                                      setWorkflowState,
                                      hasStarted,
                                      setHasStarted,
                                      ORDER,
                                      send,
                                      canGo,
                                      statusBeforeCancel,
                                  }: UseWorkflowStatusParams) => {
    const lastRealtimeStatusAtRef = useRef<number>(0);

    const extractStatusFromContent = useCallback((raw: unknown): StatusKey | undefined => {
        if (typeof raw !== 'string') return undefined;
        const s = raw.trim();
        if (!s.startsWith('{')) return undefined;
        try {
            const j = JSON.parse(s);
            const type = j?.type as string | undefined;
            return type ? (TYPES_TO_STATUS as any)[type] as StatusKey | undefined : undefined;
        } catch {
            return undefined;
        }
    }, []);

    const goToStatus = useCallback(
        (target: StatusKey, prevStatus?: StatusKey) => {
            if (target === currentStatus) {
                console.log('goToStatus: Skipping, already in target state', {
                    target,
                    currentStatus,
                    statusBeforeCancel,
                });
                return;
            }
            try {
                console.log('goToStatus:', { target, prevStatus, currentStatus, statusBeforeCancel });
                setWorkflowState(target, target === 'Cancelled' ? prevStatus ?? currentStatus : undefined);
                if (!hasStarted) setHasStarted(true);
            } catch (error) {
                console.error('Error in goToStatus:', { error, target, prevStatus, currentStatus, statusBeforeCancel });
                const targetIdx = ORDER.indexOf(target);
                let curIdx = ORDER.indexOf(currentStatus);
                while (curIdx < targetIdx) {
                    send({ type: 'NEXT' });
                    curIdx++;
                }
                while (curIdx > targetIdx) {
                    send({ type: 'BACK' });
                    curIdx--;
                }
                if (!hasStarted) setHasStarted(true);
            }
        },
        [ORDER, currentStatus, hasStarted, send, setHasStarted, setWorkflowState, statusBeforeCancel]
    );

    const tryUpdateStatusFromItems = useCallback(
        (items: WsChatMessage[]) => {
            for (const it of items) {
                const target = extractStatusFromContent((it as any)?.content);
                if (target && target !== currentStatus) {
                    const prevStatus = target === 'Cancelled' ? currentStatus : undefined;
                    console.log('tryUpdateStatusFromItems:', {
                        target,
                        prevStatus,
                        currentStatus,
                        statusBeforeCancel,
                    });
                    goToStatus(target, prevStatus);
                    lastRealtimeStatusAtRef.current = Date.now();
                    return true;
                }
            }
            return false;
        },
        [extractStatusFromContent, currentStatus, goToStatus, statusBeforeCancel]
    );

    const scanMessagesForStatus = useCallback(
        (msgs: any[], windowSize = 20): StatusKey | undefined => {
            const len = Math.min(msgs.length, windowSize);
            for (let i = 0; i < len; i++) {
                const m = msgs[i];
                const target = extractStatusFromContent(m?.content);
                if (target) return target;
            }
            return undefined;
        },
        [extractStatusFromContent]
    );

    const handleChangeStatus = useCallback(
        (key: StatusKey) => {
            if (!canGo(key)) {
                console.log('handleChangeStatus: Cannot go to status', { key, currentStatus, statusBeforeCancel });
                return;
            }
            const curIdx = ORDER.indexOf(currentStatus);
            const toIdx = ORDER.indexOf(key);
            if (toIdx === curIdx) return;
            if (Math.abs(toIdx - curIdx) === 1) {
                const prevStatus = key === 'Cancelled' ? currentStatus : undefined;
                console.log('handleChangeStatus:', { key, prevStatus, currentStatus, statusBeforeCancel });
                goToStatus(key, prevStatus);
            }
        },
        [ORDER, canGo, currentStatus, goToStatus, statusBeforeCancel]
    );

    return {
        lastRealtimeStatusAtRef,
        extractStatusFromContent,
        tryUpdateStatusFromItems,
        scanMessagesForStatus,
        goToStatus,
        handleChangeStatus,
    };
};
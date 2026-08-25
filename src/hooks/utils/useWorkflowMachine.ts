import type {WorkflowStatus} from '108heros-client';
import {useStateMachineStore} from '@/modules/chat/store/stateMachineStore';
import {
    ORDER,
    toWorkflowEvent,
    WorkFlowAction,
    workflowActionsMap,
} from '@/modules/chat/types/workflow';

// A stepper-friendly hook that mirrors the issue description API
export type StepperEvents = { type: 'NEXT' } | { type: 'BACK' } | { type: 'RESET' } | { type: 'CANCEL' };
export type UseWorkflowStepper = {
  state: { name: WorkflowStatus };
  statusBeforeCancel?: WorkflowStatus;
  ORDER: readonly WorkflowStatus[];
  idx: number;
  canNext: boolean;
  canBack: boolean;
  canCancel: boolean;
  canGo: (to: WorkflowStatus) => boolean;
  // Dynamic actions derived from state
  actions: WorkFlowAction[];
  canPerform: (a: WorkFlowAction) => boolean;
  sendAction: (a: WorkFlowAction, payload?: any) => void;
  // Legacy stepper events
  send: (e: StepperEvents) => void;
  cancel: () => void;
};

export const useWorkflowStepper = (): UseWorkflowStepper => {
    const state = useStateMachineStore((s) => s.state);
    const statusBeforeCancel = useStateMachineStore((s) => s.statusBeforeCancel);
    const idx = useStateMachineStore((s) => s.stepIndex);
    const next = useStateMachineStore((s) => s.next);
    const back = useStateMachineStore((s) => s.back);
    const reset = useStateMachineStore((s) => s.reset);
    const sendEvent = useStateMachineStore((s) => s.send);
    const cancelStore = useStateMachineStore((s) => s.cancel);

    // Dynamic actions available for the current workflow state
    const actions = (workflowActionsMap as Record<WorkflowStatus, WorkFlowAction[]>)[state] || [];
    const canPerform = (a: WorkFlowAction) => actions.includes(a);

    const sendAction = (a: WorkFlowAction, payload?: any) => {
        if (!canPerform(a)) {
            console.warn('useWorkflowStepper: action not allowed in current state', { state, action: a });
            return;
        }
        // Map UI action to machine event
        const ev = toWorkflowEvent(a);
        if (ev.type === 'SET') {
            // treat SET as RESET to first step or explicit
            return reset();
        }
        if (ev.type === 'CANCEL') {
            if (!canCancel) {
                console.warn('useWorkflowStepper: Cannot cancel from state', { state });
                return;
            }
            cancelStore();
            return;
        }
        // For other machine events, delegate to store's send
        sendEvent(ev as any);
    };

    const canNext = idx < ORDER.length - 1;
    const canBack = idx > 0;
    const canCancel = state !== 'Completed' && state !== 'Cancelled';
    const canGo = (to: WorkflowStatus) => {
        const toIdx = ORDER.indexOf(to);
        if (toIdx < 0) return false;
        return toIdx === idx || Math.abs(toIdx - idx) === 1;
    };

    const send = (e: StepperEvents) => {
        console.log('useWorkflowStepper send:', { event: e, state, statusBeforeCancel });
        if (e.type === 'NEXT') return next();
        if (e.type === 'BACK') return back();
        if (e.type === 'RESET') return reset();
        if (e.type === 'CANCEL') {
            if (!canCancel) {
                console.warn('useWorkflowStepper: Cannot cancel from state', { state });
                return;
            }
            // Use the store's cancel to ensure statusBeforeCancel is tracked and transitions are uniform
            cancelStore();
            return;
        }
    };

    const cancel = () => {
        if (!canCancel) {
            console.warn('useWorkflowStepper cancel: Cannot cancel from state', { state });
            return;
        }
        console.log('useWorkflowStepper cancel:', { state, statusBeforeCancel });
        cancelStore();
    };

    return {
        state: { name: state },
        statusBeforeCancel,
        ORDER,
        idx,
        canNext,
        canBack,
        canCancel,
        canGo,
        actions,
        canPerform,
        sendAction,
        send,
        cancel,
    };
};
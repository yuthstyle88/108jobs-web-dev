import {create} from 'zustand';
import type {WorkflowStatus} from '@108-plaza/jh-client';
import {ORDER, WORKFLOW_TRANSITIONS, WorkflowEvent} from "@/modules/chat/types/workflow";

// Generic, reusable finite state machine store with typed states and events
export type StateKey = string | number | symbol;

export type TransitionMap<S extends StateKey, E extends string> = Record<S, Partial<Record<E, S>>>;

export interface GenericMachineStore<S extends StateKey, E extends string> {
    state: S;
    stepIndex: number;
    statusBeforeCancel?: S;
    set: (state: S, statusBeforeCancel?: S) => void;
    send: (event: { type: E } | { type: 'SET'; state: S; statusBeforeCancel?: S }) => void;
    next: () => void;
    back: () => void;
    reset: () => void;
    cancel: () => void; // Explicitly added to the interface
}

export const createMachineStore = <S extends StateKey, E extends string>(
    order: readonly S[],
    transitions: TransitionMap<S, E>,
    initial: S
) => {
    const idx = (s: S) => Math.max(0, order.indexOf(s));
    return create<GenericMachineStore<S, E>>((set, get) => ({
        state: initial,
        stepIndex: idx(initial),
        statusBeforeCancel: undefined,
        set: (state, statusBeforeCancel) => {
            console.log('createMachineStore set:', { state, statusBeforeCancel });
            set({ state, stepIndex: idx(state), statusBeforeCancel });
        },
        send: (event) => {
            if (event.type === 'SET') {
                const { state, statusBeforeCancel } = event as { type: 'SET'; state: S; statusBeforeCancel?: S };
                console.log('createMachineStore send SET:', { state, statusBeforeCancel });
                set({ state, stepIndex: idx(state), statusBeforeCancel });
                return;
            }
            const current = get().state;
            const next = transitions[current]?.[event.type as E];
            if (next) {
                const statusBeforeCancel = next === 'Cancelled' ? current : undefined;
                console.log('createMachineStore send:', { event, current, next, statusBeforeCancel });
                set({ state: next, stepIndex: idx(next), statusBeforeCancel });
            }
        },
        next: () => {
            const current = get().state;
            const i = order.indexOf(current);
            if (i >= 0 && i < order.length - 1) {
                const ns = order[i + 1];
                console.log('createMachineStore next:', { current, next: ns });
                set({ state: ns, stepIndex: idx(ns), statusBeforeCancel: undefined });
            }
        },
        back: () => {
            const current = get().state;
            const i = order.indexOf(current);
            if (i > 0) {
                const ns = order[i - 1];
                set({ state: ns, stepIndex: idx(ns), statusBeforeCancel: undefined });
            }
        },
        reset: () => {
            set({ state: initial, stepIndex: idx(initial), statusBeforeCancel: undefined });
        },
        cancel: () => {
            const current = get().state;
            if (current !== 'Completed' && current !== 'Cancelled') {
                console.log('createMachineStore cancel:', { current, next: 'Cancelled' });
                set({ state: 'Cancelled' as S, stepIndex: idx('Cancelled' as S), statusBeforeCancel: current });
            } else {
                console.warn('createMachineStore cancel: Cannot cancel from state', { current });
            }
        },
    }));
};

// Concrete workflow implementation using the generic machine

export const useStateMachineStore = createMachineStore<WorkflowStatus, Exclude<WorkflowEvent['type'], 'SET'>>(
    ORDER,
    WORKFLOW_TRANSITIONS,
    'WaitForFreelancerQuotation'
);

// Defaults a missing/unknown status to the initial workflow step.
export const apiToUiStatus = (s: WorkflowStatus | null | undefined): WorkflowStatus =>
    s ?? 'WaitForFreelancerQuotation';
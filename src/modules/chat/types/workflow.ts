import type {WorkflowStatus} from "108jobs-client";
import {TransitionMap} from "@/modules/chat/store/stateMachineStore";

export const ORDER = [
    'WaitForFreelancerQuotation',
    'QuotationPendingReview',
    'OrderApproved',
    'InProgress',
    'PendingEmployerReview',
    'Completed',
    'Cancelled',
] as const satisfies readonly WorkflowStatus[];

// Events reflect real transitions; no "chat" state
export type WorkflowEvent =
  | { type: 'QUOTE_PROPOSED' }
  | { type: 'APPROVE_ORDER' }
  | { type: 'START_WORK' }
  | { type: 'SUBMIT_DELIVERY' }
  | { type: 'REQUEST_REVISION' }
  | { type: 'RELEASE_PAYMENT' }
  | { type: 'CANCEL' }
  | { type: 'SET'; state: WorkflowStatus; statusBeforeCancel?: WorkflowStatus };

export const WORKFLOW_TRANSITIONS: TransitionMap<WorkflowStatus, Exclude<WorkflowEvent['type'], 'SET'>> = {
    WaitForFreelancerQuotation: { QUOTE_PROPOSED: 'QuotationPendingReview', CANCEL: 'Cancelled' }, // เปลี่ยน event และไปข้างหน้า
    QuotationPendingReview: { APPROVE_ORDER: 'OrderApproved', CANCEL: 'Cancelled' },
    OrderApproved: { START_WORK: 'InProgress', CANCEL: 'Cancelled' },
    InProgress: { SUBMIT_DELIVERY: 'PendingEmployerReview', CANCEL: 'Cancelled' },
    PendingEmployerReview: { REQUEST_REVISION: 'InProgress', RELEASE_PAYMENT: 'Completed', CANCEL: 'Cancelled' },
    Completed: {},
    Cancelled: {},
};

export type WorkFlowAction =
  | 'submitQuotation'      // -> QUOTE_PROPOSED
  | 'approveOrder'         // -> APPROVE_ORDER
  | 'startWork'            // -> START_WORK
  | 'submitDelivery'       // -> SUBMIT_DELIVERY
  | 'requestRevision'      // -> REQUEST_REVISION
  | 'releasePayment'       // -> RELEASE_PAYMENT
  | 'cancel'               // -> CANCEL
  | 'restart';             // -> SET (special)

export const workflowActionsMap: Record<WorkflowStatus, WorkFlowAction[]> = {
  WaitForFreelancerQuotation: ['submitQuotation', 'cancel'],
  QuotationPendingReview: ['approveOrder', 'cancel'],
  OrderApproved: ['startWork', 'cancel'],
  InProgress: ['submitDelivery', 'cancel'],
  PendingEmployerReview: ['requestRevision', 'releasePayment', 'cancel'],
  Completed: ['restart'],
  Cancelled: ['restart'],
};

export const ACTION_TO_EVENT: Record<Exclude<WorkFlowAction, 'restart'>, Exclude<WorkflowEvent['type'], 'SET'>> = {
  submitQuotation: 'QUOTE_PROPOSED',
  approveOrder: 'APPROVE_ORDER',
  startWork: 'START_WORK',
  submitDelivery: 'SUBMIT_DELIVERY',
  requestRevision: 'REQUEST_REVISION',
  releasePayment: 'RELEASE_PAYMENT',
  cancel: 'CANCEL',
};

export function toWorkflowEvent(action: WorkFlowAction): WorkflowEvent {
  if (action === 'restart') {
    return { type: 'SET', state: 'WaitForFreelancerQuotation' };
  }
  const type = ACTION_TO_EVENT[action as Exclude<WorkFlowAction, 'restart'>];
  return { type } as WorkflowEvent;
}

// compile-time check: exhaustiveness of ACTION_TO_EVENT keys
const _assertAllActionsMapped: Exclude<WorkFlowAction, 'restart'> = (null as any) as keyof typeof ACTION_TO_EVENT;
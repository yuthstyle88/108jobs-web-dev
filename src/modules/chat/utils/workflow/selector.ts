import type {WorkflowStatus} from "108heros-client";
import {WORKFLOW_TRANSITIONS} from "@/modules/chat/types/workflow";

export const can = <E extends keyof (typeof WORKFLOW_TRANSITIONS)[WorkflowStatus]>(ev: E) =>
  (s: WorkflowStatus): boolean =>
    Boolean((WORKFLOW_TRANSITIONS as Record<WorkflowStatus, any>)[s]?.[ev]);

export const nextOf = (s: WorkflowStatus) =>
  (WORKFLOW_TRANSITIONS as Record<WorkflowStatus, any>)[s] ?? {};
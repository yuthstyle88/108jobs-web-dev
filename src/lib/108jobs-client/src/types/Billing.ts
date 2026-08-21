import type {BillingId} from "./BillingId";
import type {PostId} from "./PostId";
import type {ProposalId} from "./ProposalId";
import type {Coin} from "./Coin";
import type {BillingStatus} from "./BillingStatus";
import {LocalUserId} from "./LocalUserId";

// Mirrors backend Billing struct with camelCase keys
export type Billing = {
  id: BillingId;
  freelancerId: LocalUserId;
  employerId: LocalUserId;
  postId: PostId;
  proposalId?: ProposalId;
  amount: Coin;
  description: string;
  status: BillingStatus;
  workDescription?: string | null;
  deliverableUrl?: string | null;
  createdAt: string; // ISO datetime
  updatedAt?: string | null; // ISO datetime
  paidAt?: string | null; // ISO datetime
};

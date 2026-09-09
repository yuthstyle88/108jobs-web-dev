/**
 * Where an order's money is.
 *
 * `PaidOut` cannot be read from the hold ledger alone: a payout leaves the hold
 * `Captured`, exactly like an escrow still sitting with the platform. The
 * server distinguishes them by the workflow reaching `Completed`.
 */
export type EscrowState = "none" | "held" | "paidOut" | "refunded";

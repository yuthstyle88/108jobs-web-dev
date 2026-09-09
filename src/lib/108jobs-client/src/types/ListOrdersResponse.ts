import type { OrderSummary } from "./OrderSummary";

export type ListOrdersResponse = {
    orders: Array<OrderSummary>,
    total: number,
    limit: number,
    offset: number,
};

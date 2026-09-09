"use client";

import React from "react";
import {useTranslation} from "react-i18next";
import type {OrderSummary} from "@/lib/108jobs-client/src";
import type {OrderGroups} from "@/modules/chat/utils/groupOrders";

/**
 * Every order in a conversation, grouped by what happened to it.
 *
 * A 108Jobs room holds all the work two people have done together. Completed
 * and cancelled orders stay on this list on purpose: the tab used to render the
 * room's single *current* workflow, so a conversation whose newest order had
 * been cancelled showed a "Hire Now?" prompt and nothing else, with ten
 * finished orders unreachable behind it (#136).
 */
export interface OrdersListProps {
    groups: OrderGroups;
    selectedWorkflowId: number | null;
    onSelect: (order: OrderSummary) => void;
    isLoading?: boolean;
}

const escrowLabelKey: Record<string, string | null> = {
    none: null,
    held: "profileChat.ordersEscrowHeld",
    paidOut: "profileChat.ordersEscrowPaidOut",
    refunded: "profileChat.ordersEscrowRefunded",
};

function OrderRow({
    order,
    selected,
    onSelect,
}: {
    order: OrderSummary;
    selected: boolean;
    onSelect: (order: OrderSummary) => void;
}) {
    const {t} = useTranslation();
    const escrowKey = escrowLabelKey[order.escrow as string] ?? null;

    return (
        <li>
            <button
                type="button"
                onClick={() => onSelect(order)}
                aria-current={selected ? "true" : undefined}
                data-workflow-id={order.workflowId}
                className={[
                    "w-full text-left rounded-xl px-3 py-2 transition-colors",
                    "border",
                    selected
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:bg-black/5 dark:hover:bg-white/5",
                ].join(" ")}
            >
                {/* Every text node names its colour. `--foreground` follows the
                    OS's prefers-color-scheme and goes near-white in dark, while
                    this app's surfaces stay white -- so an inherited colour is
                    rgb(237,237,237) on white for anyone whose OS is dark. That
                    is what the first live render looked like. The rest of the
                    sidebar sets text-gray-* explicitly; so does this. */}
                <span className="flex items-baseline justify-between gap-2">
                    <span
                        className={[
                            "text-sm font-medium truncate",
                            selected ? "text-gray-900" : "text-gray-800",
                        ].join(" ")}
                    >
                        {order.postName ||
                            t("profileChat.ordersOrderNumber", {n: order.seqNumber})}
                    </span>
                    <span className="text-xs text-gray-500 shrink-0 tabular-nums">
                        #{order.seqNumber}
                    </span>
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-xs">
                    <span className="text-gray-500">{order.status}</span>
                    {order.amount != null && (
                        <span className="text-gray-500 tabular-nums">
                            {String(order.amount)}
                        </span>
                    )}
                    {escrowKey && <span className="text-gray-500">{t(escrowKey)}</span>}
                    {/* Says the timestamp is `updatedAt` standing in for a finish
                        time that was never recorded, rather than implying a
                        precision the server does not have. */}
                    {order.finishedAtIsApproximate && (
                        <span className="text-gray-500">
                            ({t("profileChat.ordersFinishedApprox")})
                        </span>
                    )}
                </span>
            </button>
        </li>
    );
}

function Section({
    titleKey,
    orders,
    selectedWorkflowId,
    onSelect,
}: {
    titleKey: string;
    orders: OrderSummary[];
    selectedWorkflowId: number | null;
    onSelect: (order: OrderSummary) => void;
}) {
    const {t} = useTranslation();
    if (orders.length === 0) return null;
    return (
        <section className="mb-3">
            <h4 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t(titleKey)}
            </h4>
            <ul className="flex flex-col gap-1">
                {orders.map(order => (
                    <OrderRow
                        key={String(order.workflowId)}
                        order={order}
                        selected={Number(order.workflowId) === selectedWorkflowId}
                        onSelect={onSelect}
                    />
                ))}
            </ul>
        </section>
    );
}

export const OrdersList: React.FC<OrdersListProps> = ({
    groups,
    selectedWorkflowId,
    onSelect,
    isLoading,
}) => {
    const {t} = useTranslation();
    const total =
        groups.active.length + groups.completed.length + groups.cancelled.length;

    if (!isLoading && total === 0) {
        return (
            <p className="px-3 py-4 text-sm text-gray-500">
                {t("profileChat.ordersEmpty")}
            </p>
        );
    }

    return (
        <div data-testid="orders-list">
            <Section
                titleKey="profileChat.ordersActive"
                orders={groups.active}
                selectedWorkflowId={selectedWorkflowId}
                onSelect={onSelect}
            />
            <Section
                titleKey="profileChat.ordersCompleted"
                orders={groups.completed}
                selectedWorkflowId={selectedWorkflowId}
                onSelect={onSelect}
            />
            <Section
                titleKey="profileChat.ordersCancelled"
                orders={groups.cancelled}
                selectedWorkflowId={selectedWorkflowId}
                onSelect={onSelect}
            />
        </div>
    );
};

export default OrdersList;

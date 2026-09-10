'use client';

import React from 'react';
import {useTranslation} from 'react-i18next';
import {orderStatusLabelKey} from '@/modules/chat/utils/orderStatusLabel';

/** What the line needs of an order: enough to name it. */
export interface SelectedOrderSummary {
    seqNumber: number;
    postName?: string | null;
    status?: string | null;
}

interface OrderSelectorLineProps {
    selected: SelectedOrderSummary | null;
    /**
     * How many orders the conversation has, from the server -- not how many are
     * loaded. The history may hold one page of a longer list.
     */
    total: number;
    onOpen: () => void;
}

/**
 * The one line the Orders pane always shows about the history.
 *
 * Which order the panel below is showing, and how many there are. Clicking
 * opens the full history.
 *
 * The pane used to carry the whole list, which grew with every order two people
 * completed and pushed the workflow -- the thing the reader came to act on --
 * further away each time (#156). What has to stay on screen is the answer to
 * "which order am I looking at", which before any of this existed was invisible
 * (#136).
 */
export const OrderSelectorLine: React.FC<OrderSelectorLineProps> = ({selected, total, onOpen}) => {
    const {t} = useTranslation();
    const statusKey = orderStatusLabelKey(selected?.status);

    return (
        <button
            type="button"
            data-testid="order-selector-line"
            onClick={onOpen}
            className="w-full flex items-center gap-2 px-4 py-3 text-left border-b border-gray-200 hover:bg-gray-50"
        >
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-900">
                    {selected
                        ? `${t('profileChat.ordersOrderNumber', {n: selected.seqNumber})}${
                              selected.postName ? ` · ${selected.postName}` : ''
                          }`
                        : t('profileChat.ordersSelectorNone')}
                </span>
                {selected?.status && (
                    // The same word the history rows and the stepper use, so
                    // one order never reads as two different things.
                    <span className="block truncate text-xs text-gray-500">
                        {statusKey ? t(statusKey) : selected.status}
                    </span>
                )}
            </span>
            <span className="shrink-0 text-xs text-gray-500">
                {t('profileChat.ordersSelectorCount', {count: total})}
            </span>
            <svg className="shrink-0 h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
        </button>
    );
};

export default OrderSelectorLine;

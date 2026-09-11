'use client';

import React from 'react';
import {useTranslation} from 'react-i18next';
import type {OrderSummary} from '@/lib/108jobs-client/src';
import type {OrderGroups} from '@/modules/chat/utils/groupOrders';
import OrdersList from '@/modules/chat/components/OrdersList';

interface OrderHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    groups: OrderGroups;
    selectedWorkflowId: number | null;
    onSelect: (order: OrderSummary) => void;
    /** How many are on screen, and how many the conversation has. */
    loaded: number;
    total: number;
    hasMore: boolean;
    onLoadMore: () => void;
    isLoading?: boolean;
}

/**
 * Everything the pair has run together, opened from the selector line.
 *
 * A modal rather than a slab of the pane: the history is reference material and
 * grows with every order, so it belongs one click away instead of above -- or
 * below -- the workflow the reader came to act on (#156).
 *
 * It says how much of the history is on screen, because the server answers 20 at
 * a time: without that a 23-order conversation looked like a 20-order one.
 */
export const OrderHistoryModal: React.FC<OrderHistoryModalProps> = ({
    isOpen,
    onClose,
    groups,
    selectedWorkflowId,
    onSelect,
    loaded,
    total,
    hasMore,
    onLoadMore,
    isLoading,
}) => {
    const {t} = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-lg">
                <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
                    <h3 className="flex-1 text-base font-semibold text-gray-900">
                        {t('profileChat.ordersHistoryTitle')}
                    </h3>
                    <span className="text-xs text-gray-500">
                        {t('profileChat.ordersShowingOf', {shown: loaded, total})}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        data-testid="orders-history-close"
                        className="rounded-md px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                        {t('profileChat.closeDrawer')}
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    <OrdersList
                        groups={groups}
                        selectedWorkflowId={selectedWorkflowId}
                        onSelect={order => {
                            onSelect(order);
                            onClose();
                        }}
                        isLoading={isLoading}
                    />
                    {hasMore && (
                        <div className="px-4 py-3">
                            <button
                                type="button"
                                data-testid="orders-load-more"
                                onClick={onLoadMore}
                                className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                {t('profileChat.ordersLoadMore')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrderHistoryModal;

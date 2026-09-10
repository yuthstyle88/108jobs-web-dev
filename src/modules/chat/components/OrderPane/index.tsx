'use client';

import React from 'react';

interface OrderPaneProps {
    /** The selected order's stepper and its actions. */
    workflow: React.ReactNode;
    /** Every order in the conversation, finished ones included. */
    history: React.ReactNode;
}

/**
 * The Orders pane: the selected order's workflow, then the conversation's
 * history.
 *
 * The workflow is what the reader came to act on -- approve, release, hire
 * again -- and the history is reference material behind it. The history used to
 * come first, so on a conversation holding 17 orders the stepper and every one
 * of its buttons were off-screen until the reader had scrolled past the lot
 * (#154).
 *
 * A component of its own so the order of the two halves is decided somewhere a
 * test can reach: `ChatRoomView` cannot be mounted without a room, a socket and
 * a wallet.
 */
export const OrderPane: React.FC<OrderPaneProps> = ({workflow, history}) => (
    <>
        {workflow}
        {history}
    </>
);

export default OrderPane;

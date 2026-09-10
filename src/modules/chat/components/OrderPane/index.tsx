'use client';

import React from 'react';

interface OrderPaneProps {
    /** The one line naming the order the workflow belongs to. */
    selector: React.ReactNode;
    /** The selected order's stepper and its actions. */
    workflow: React.ReactNode;
    /** The history itself, which renders only while it is open. */
    history: React.ReactNode;
}

/**
 * The Orders pane: the line naming the selected order, that order's workflow,
 * and the history behind them.
 *
 * The workflow is what the reader came to act on -- approve, release, hire
 * again -- and the history is reference material behind it. The history used to
 * come first, so on a conversation holding 17 orders the stepper and every one
 * of its buttons were off-screen until the reader had scrolled past the lot
 * (#154).
 *
 * A component of its own so the order of the parts is decided somewhere a test
 * can reach: `ChatRoomView` cannot be mounted without a room, a socket and a
 * wallet. The line goes first because it says what the workflow below it is
 * about; the history renders nothing until it is opened (#156).
 */
export const OrderPane: React.FC<OrderPaneProps> = ({selector, workflow, history}) => (
    <>
        {selector}
        {workflow}
        {history}
    </>
);

export default OrderPane;

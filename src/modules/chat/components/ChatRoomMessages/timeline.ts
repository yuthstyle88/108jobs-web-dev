export type TimelineItem = {
    id?: string | number | null;
    clientId?: string | number | null;
};

export type ChatTimeline<T extends TimelineItem> = {
    items: T[];
    firstItemIndex: number;
};

/**
 * A high starting index lets React Virtuoso subtract the number of older
 * messages that arrive without reaching zero during a long conversation.
 */
export const CHAT_TIMELINE_START_INDEX = 100_000;

/**
 * Virtuoso passes a virtual index to itemContent when firstItemIndex is set,
 * while the message data remains a zero-based array.
 */
export function getTimelineArrayIndex(virtualIndex: number, firstItemIndex: number): number {
    return virtualIndex - firstItemIndex;
}

function itemKey(item: TimelineItem): string {
    const key = item.id ?? item.clientId;
    return key == null ? "" : String(key);
}

function isExtensionOf<T extends TimelineItem>(next: T[], current: T[], startIndex: number): boolean {
    if (startIndex < 0 || next.length - startIndex < current.length) return false;

    return current.every((item, index) => itemKey(item) === itemKey(next[startIndex + index]));
}

/**
 * Synchronises the message window with Virtuoso's inverse-scroll index.
 *
 * When history arrives ahead of the existing first message, Virtuoso needs
 * its first item index reduced by exactly that number of new messages. This
 * lets it retain the reader's viewport while rows with variable heights mount.
 */
export function syncChatTimeline<T extends TimelineItem>(
    current: ChatTimeline<T>,
    nextItems: T[],
): ChatTimeline<T> {
    if (current.items.length === 0) {
        return {items: nextItems, firstItemIndex: current.firstItemIndex};
    }

    const currentFirstKey = itemKey(current.items[0]);
    const firstExistingIndex = nextItems.findIndex((item) => itemKey(item) === currentFirstKey);

    if (firstExistingIndex > 0 && isExtensionOf(nextItems, current.items, firstExistingIndex)) {
        return {
            items: nextItems,
            firstItemIndex: current.firstItemIndex - firstExistingIndex,
        };
    }

    if (firstExistingIndex === 0 && isExtensionOf(nextItems, current.items, 0)) {
        return {items: nextItems, firstItemIndex: current.firstItemIndex};
    }

    return {items: nextItems, firstItemIndex: CHAT_TIMELINE_START_INDEX};
}

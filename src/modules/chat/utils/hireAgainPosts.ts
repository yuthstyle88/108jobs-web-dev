import type {ListPersonCreatedResponse} from "@108-plaza/jh-client";

type PostItem = ListPersonCreatedResponse["created"][number];
import type {HireAgainPost} from "@/modules/chat/components/HireAgainModal";

/**
 * The employer's jobs, as the picker shows them.
 *
 * Deleted and moderator-removed posts come back from the list endpoint and must
 * not be offered: the server refuses an order against them, so offering one
 * fails only after the employer has confirmed.
 */
export function toHireAgainPosts(
    items: readonly PostItem[] | undefined | null,
): HireAgainPost[] {
    return (items ?? [])
        .filter(item => !item.post.deleted && !item.post.removed)
        .map(item => ({
            id: Number(item.post.id),
            name: item.post.name,
            budget: item.post.budget == null ? undefined : Number(item.post.budget),
        }));
}

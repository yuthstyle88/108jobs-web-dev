/** Just enough of a chat participant to name them. */
interface NameableParticipant {
  name?: string | null;
  displayName?: string | null;
}

/**
 * The name to show for a chat participant.
 *
 * `name` is the actor name, and for anyone provisioned through
 * Identity-Platform it is generated — `user_<8 hex>` — so it is unreadable for
 * essentially every person who signs in by phone. `displayName` is what the job
 * board, the proposal list and the iOS app show, and it arrives in the same
 * payload (`ChatParticipantView` carries both).
 *
 * This exists because the same defect was fixed twice: the room header (#138),
 * and then the room list (#144), which was missed the first time and left the
 * same screen naming one person two different ways. Both call this now, so the
 * rule lives in one place instead of being a convention each component has to
 * remember.
 */
export function participantDisplayName(
  participant: NameableParticipant | null | undefined,
): string {
  return (
    participant?.displayName?.trim() ||
    participant?.name?.trim() ||
    "Unknown"
  );
}

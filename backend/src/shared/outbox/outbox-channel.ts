/**
 * The PostgreSQL LISTEN/NOTIFY channel the outbox relay wakes up on.
 *
 * A notification is sent inside the same transaction that inserts the outbox
 * row, which means PostgreSQL delivers it only when that transaction commits —
 * a rolled-back business change can never produce a false wake-up. The payload
 * carries only a JSON object with the inserted count; the relay never trusts
 * the payload, it simply drains pending rows through the same claim query the
 * old poller used.
 */
export const OUTBOX_NOTIFY_CHANNEL = 'outbox_event'

/** Build the (small, non-sensitive) notification payload. */
export function outboxNotifyPayload(insertedCount: number): string {
  return JSON.stringify({ n: insertedCount })
}

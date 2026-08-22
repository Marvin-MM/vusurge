import type { Challenge, ChallengeStatus } from "@/types";

/**
 * Derived challenge status.
 *
 * The backend deliberately never persists "CLOSED": a challenge whose
 * submission window has elapsed stays literally `status === "OPEN"` in the
 * database, and every eligibility check reads the authoritative deadline
 * directly rather than trusting a delayed status update (see
 * backend/docs/challenge-states.md). This module is the single place that
 * mirrors that derivation on the client — never compare `challenge.status`
 * to the literal string `"CLOSED"` anywhere else.
 */

export type DisplayChallengeStatus = ChallengeStatus | "CLOSED";

type ChallengeStatusFields = Pick<Challenge, "status" | "submissionDeadline">;

/** True once the submission window has elapsed, regardless of the persisted status. */
export function isEffectivelyClosed(challenge: ChallengeStatusFields): boolean {
  if (challenge.status !== "OPEN") return false;
  if (!challenge.submissionDeadline) return false;
  return new Date(challenge.submissionDeadline).getTime() <= Date.now();
}

/**
 * The status a user should see: the persisted value, except "OPEN" is
 * reported as "CLOSED" once the deadline has passed.
 */
export function getDisplayStatus(challenge: ChallengeStatusFields): DisplayChallengeStatus {
  return isEffectivelyClosed(challenge) ? "CLOSED" : challenge.status;
}

/** Whether new registrations/submissions may still be created. */
export function isAcceptingSubmissions(challenge: ChallengeStatusFields): boolean {
  return challenge.status === "OPEN" && !isEffectivelyClosed(challenge);
}

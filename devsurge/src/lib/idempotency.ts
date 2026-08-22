/**
 * A handful of non-repeatable POST endpoints require a client-generated
 * `idempotency-key` header (8-255 chars) so a retried request can't double
 * the effect — e.g. finalizing a submission twice, submitting an
 * organization application twice. Only added where
 * backend/docs/openapi.json actually declares the requirement; never
 * blanket-added to every mutation.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

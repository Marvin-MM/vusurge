import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Secret token generation, hashing, and comparison.
 *
 * Applies to every bearer-style secret the platform issues outside Better
 * Auth: organization invitations, join codes, challenge staff invitations, and
 * team invitations.
 *
 * Two rules, both non-negotiable (master prompt sections 9.1, 9.2, 17.2):
 *   1. Tokens come from a cryptographic RNG. Never from Math.random, a
 *      timestamp, a counter, or a guessable composition like "acme-2026".
 *   2. Only the hash is stored. A database disclosure must not hand an attacker
 *      a set of working invitations.
 */

/** URL-safe alphabet without look-alike characters, for human-typed codes. */
const HUMAN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generate a high-entropy token for links (invitations, staff invitations).
 *
 * 32 random bytes, base64url encoded: 256 bits, far beyond brute force even
 * without rate limiting.
 */
export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url')
}

/**
 * Generate a human-typed join code.
 *
 * Uses an unbiased rejection sampler over a 32-character alphabet, so each
 * character carries a full 5 bits. The default length of 12 gives 60 bits —
 * enough that, combined with the redemption rate limits, guessing is not a
 * practical attack (master prompt section 9.2).
 */
export function generateJoinCode(length = 12): string {
  const alphabetLength = HUMAN_ALPHABET.length
  // 256 is not a multiple of every alphabet size; discarding the biased tail
  // keeps each character uniformly distributed.
  const maxUnbiased = Math.floor(256 / alphabetLength) * alphabetLength
  const characters: string[] = []

  while (characters.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= maxUnbiased) continue
      characters.push(HUMAN_ALPHABET[byte % alphabetLength] as string)
      if (characters.length === length) break
    }
  }

  // Grouped for legibility when a human reads it aloud or types it.
  return (characters.join('').match(/.{1,4}/g) ?? []).join('-')
}

/** Normalize a user-entered join code before hashing or comparison. */
export function normalizeJoinCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]/g, '')
}

/**
 * Hash a token for storage.
 *
 * SHA-256 without a salt is correct here and a password hash would be wrong:
 * these tokens are already high-entropy random values, so there is no
 * dictionary to attack, and lookup by hash must stay a single indexed read.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Hash a normalized join code for storage. */
export function hashJoinCode(code: string): string {
  return hashToken(normalizeJoinCode(code))
}

/** Constant-time comparison of two hex digests. */
export function secureCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8')
  const bufferB = Buffer.from(b, 'utf8')
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}

/** SHA-256 of a request body, used to detect idempotency-key reuse. */
export function hashRequestBody(body: unknown): string {
  return createHash('sha256').update(canonicalize(body), 'utf8').digest('hex')
}

/**
 * Deterministic JSON serialization with sorted keys.
 *
 * Two semantically identical bodies must hash the same regardless of key order,
 * or a client retry would look like a different request.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
  return `{${entries.join(',')}}`
}

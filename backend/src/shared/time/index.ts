/**
 * Time handling.
 *
 * Security-critical time comparisons (registration windows, submission
 * deadlines, judging windows, token expiry) MUST use database time read inside
 * the same transaction as the write they gate — see `databaseNow` in
 * shared/database. A client clock, an API-process clock, and a queue worker's
 * clock are all untrusted for those decisions (master prompt sections 10.4,
 * 15.4, 32).
 *
 * The helpers here are for non-authoritative uses: scheduling hints, TTL
 * arithmetic, display formatting, and telemetry.
 */

/** Wall-clock now on this process. Never use to accept or reject a deadline. */
export function processNow(): Date {
  return new Date()
}

export function addSeconds(instant: Date, seconds: number): Date {
  return new Date(instant.getTime() + seconds * 1000)
}

export function addMinutes(instant: Date, minutes: number): Date {
  return addSeconds(instant, minutes * 60)
}

export function addHours(instant: Date, hours: number): Date {
  return addSeconds(instant, hours * 3600)
}

export function addDays(instant: Date, days: number): Date {
  return addSeconds(instant, days * 86_400)
}

export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime()
}

export function isAfter(a: Date, b: Date): boolean {
  return a.getTime() > b.getTime()
}

/** Milliseconds elapsed since `start`, for latency measurement. */
export function elapsedMs(start: number): number {
  return Math.max(0, Math.round(performance.now() - start))
}

export function startTimer(): number {
  return performance.now()
}

/**
 * Validate an IANA time zone name.
 *
 * Challenges store instants as timestamptz and additionally record a display
 * time zone (master prompt section 10.1); that name must be a real IANA zone so
 * downstream clients can format schedules correctly.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

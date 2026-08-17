/**
 * A minimal circuit breaker for optional dependencies.
 *
 * Applied to the cache and to outbound third-party providers — never to
 * PostgreSQL, where a breaker would only convert an honest failure into a
 * confusing one (master prompt section 4.3).
 *
 * States:
 *   closed    calls flow through; consecutive failures are counted
 *   open      calls are rejected immediately until the reset window elapses
 *   half-open one probe call is allowed; success closes, failure re-opens
 */

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerOptions {
  readonly name: string
  readonly failureThreshold: number
  readonly resetTimeoutMs: number
  readonly onStateChange?: (state: CircuitState, name: string) => void
}

export class CircuitBreaker {
  private failures = 0
  private state: CircuitState = 'closed'
  private openedAt = 0
  private halfOpenProbeInFlight = false

  constructor(private readonly options: CircuitBreakerOptions) {}

  /** True when a call may be attempted right now. */
  canAttempt(): boolean {
    if (this.state === 'closed') return true

    if (this.state === 'open') {
      if (Date.now() - this.openedAt >= this.options.resetTimeoutMs) {
        this.transition('half-open')
        this.halfOpenProbeInFlight = true
        return true
      }
      return false
    }

    // Exactly one probe is allowed. Concurrent callers fail fast until that
    // probe records success/failure, preventing a thundering herd on recovery.
    if (this.halfOpenProbeInFlight) return false
    this.halfOpenProbeInFlight = true
    return true
  }

  recordSuccess(): void {
    this.failures = 0
    this.halfOpenProbeInFlight = false
    if (this.state !== 'closed') {
      this.transition('closed')
    }
  }

  recordFailure(): void {
    this.failures += 1
    this.halfOpenProbeInFlight = false
    if (this.state === 'half-open' || this.failures >= this.options.failureThreshold) {
      this.openedAt = Date.now()
      this.transition('open')
    }
  }

  currentState(): CircuitState {
    // Re-evaluate so a caller polling the state observes the reset window.
    if (this.state === 'open' && Date.now() - this.openedAt >= this.options.resetTimeoutMs) {
      this.transition('half-open')
    }
    return this.state
  }

  /** Test and operational hook. */
  reset(): void {
    this.failures = 0
    this.openedAt = 0
    this.halfOpenProbeInFlight = false
    this.transition('closed')
  }

  private transition(next: CircuitState): void {
    if (this.state === next) return
    this.state = next
    this.options.onStateChange?.(next, this.options.name)
  }
}

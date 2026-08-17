import { createHash } from 'node:crypto'
import type { EmailMessage, EmailProvider, EmailSendResult } from '../../src/shared/email'

/**
 * An in-memory email provider for tests.
 *
 * Substitutes Resend at the provider boundary (never faking business logic
 * above it): E2E tests use this to recover the verification/invitation link
 * that a real user would receive by email, without depending on a live
 * Resend account. See shared/email/email-provider.ts for the interface this
 * implements.
 */
export interface FakeEmailProvider extends EmailProvider {
  readonly sent: EmailMessage[]
  /** The most recent message sent to `to`, or undefined if none. */
  latestTo(to: string): EmailMessage | undefined
  /** Extract the first https URL found in the message body. */
  extractUrl(message: EmailMessage): string
  /** Make the next provider call fail without recording a sent message. */
  failNext(error?: Error): void
  clear(): void
}

export function createFakeEmailProvider(): FakeEmailProvider {
  const sent: EmailMessage[] = []
  let nextFailure: Error | undefined

  return {
    sent,

    async send(message: EmailMessage): Promise<EmailSendResult> {
      if (nextFailure !== undefined) {
        const error = nextFailure
        nextFailure = undefined
        throw error
      }
      sent.push(message)
      // Provider message identifiers are globally unique, not counters scoped
      // to one provider client. Deriving this from the provider idempotency key
      // also makes a repeated safe send return the same upstream identity.
      const providerMessageId = `fake-${createHash('sha256')
        .update(message.idempotencyKey)
        .digest('hex')}`
      return { providerMessageId, suppressed: false }
    },

    latestTo(to: string): EmailMessage | undefined {
      for (let i = sent.length - 1; i >= 0; i -= 1) {
        if (sent[i]?.to.toLowerCase() === to.toLowerCase()) return sent[i]
      }
      return undefined
    },

    extractUrl(message: EmailMessage): string {
      const match = message.text.match(/https?:\/\/\S+/)
      if (match === null) {
        throw new Error(`No URL found in email body: ${message.text}`)
      }
      return match[0]
    },

    failNext(error = new Error('Injected email provider failure')): void {
      nextFailure = error
    },

    clear(): void {
      sent.length = 0
      nextFailure = undefined
    },
  }
}

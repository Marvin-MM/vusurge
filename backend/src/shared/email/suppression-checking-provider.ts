import type { Database } from '../database'
import type { Logger } from '../logging'
import type { EmailMessage, EmailProvider, EmailSendResult } from './email-provider'
import { SECURITY_EMAIL_CATEGORIES } from './email-provider'

/**
 * Decorates an `EmailProvider` with suppression enforcement (master prompt
 * section 21: "suppression of repeatedly bouncing/complaining recipients").
 *
 * Security categories bypass the check by design — a user must always be
 * able to receive a verification or password-reset email even if some
 * earlier, unrelated send to the same address bounced, or the account
 * becomes permanently unreachable through the platform's own recovery flow.
 */
export class SuppressionCheckingEmailProvider implements EmailProvider {
  constructor(
    private readonly inner: EmailProvider,
    private readonly database: Database,
    private readonly logger: Logger,
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!SECURITY_EMAIL_CATEGORIES.has(message.category)) {
      const suppression = await this.database.client.emailSuppression.findUnique({
        where: { email: message.to },
        select: { reason: true },
      })
      if (suppression !== null) {
        this.logger.info(
          { to: message.to, category: message.category, reason: suppression.reason },
          'Skipped sending email to a suppressed address',
        )
        return { providerMessageId: message.idempotencyKey, suppressed: true }
      }
    }

    return this.inner.send(message)
  }
}

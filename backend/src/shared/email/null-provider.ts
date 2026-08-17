import { newRandomId } from '../ids'
import type { Logger } from '../logging'
import type { EmailMessage, EmailProvider, EmailSendResult } from './email-provider'

/**
 * A provider that logs instead of sending.
 *
 * Used when `EMAIL_ENABLED=false` (local development, most test runs). It
 * implements the same interface as `ResendEmailProvider`, so the rest of the
 * system — including the modules that call `EmailProvider.send` — behaves
 * identically whether or not real email is configured. Production must not
 * run with this provider: configuration validation requires `EMAIL_ENABLED`
 * to be true in production.
 */
export class NullEmailProvider implements EmailProvider {
  constructor(private readonly logger: Logger) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.logger.info(
      { to: message.to, category: message.category, subject: message.subject },
      'Email sending is disabled; logging instead of delivering',
    )
    return { providerMessageId: `null-provider-${newRandomId()}`, suppressed: false }
  }
}

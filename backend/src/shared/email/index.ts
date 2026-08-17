import type { AppConfig } from '../config/config.schema'
import type { Logger } from '../logging'
import { NullEmailProvider } from './null-provider'
import { ResendEmailProvider } from './resend-provider'

export {
  createEmailDeliveryManager,
  EmailDeliveryBusyError,
  type EmailDeliveryInput,
  type EmailDeliveryManager,
} from './email-delivery'
export {
  EmailCategory,
  type EmailMessage,
  type EmailProvider,
  EmailProviderError,
  type EmailSendResult,
  isRetryableEmailProviderError,
  SECURITY_EMAIL_CATEGORIES,
} from './email-provider'
export { NullEmailProvider } from './null-provider'
export { ResendEmailProvider } from './resend-provider'
export { SuppressionCheckingEmailProvider } from './suppression-checking-provider'
export * as EmailTemplates from './templates'

/** Select the configured provider. Production always uses Resend. */
export function createEmailProvider(config: AppConfig, logger: Logger) {
  if (config.email.enabled) {
    return new ResendEmailProvider(config, logger)
  }
  return new NullEmailProvider(logger)
}

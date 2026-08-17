import type { LookupAddress } from 'node:dns'
import { lookup as dnsLookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import { AppError, ErrorCode, unprocessable } from '../errors'
import { isBlockedAddress, validateExternalUrl } from '../security'

export type IntegrationProviderKind = 'SLACK' | 'DISCORD'

export interface WebhookDispatchResult {
  readonly succeeded: boolean
  readonly retryable: boolean
  readonly responseStatus: number | null
  readonly errorMessage: string | null
}

export interface IntegrationWebhookTransport {
  send(
    provider: IntegrationProviderKind,
    webhookUrl: string,
    text: string,
  ): Promise<WebhookDispatchResult>
}

const REQUEST_TIMEOUT_MS = 8_000
const MAX_RESPONSE_BYTES = 8 * 1024

const ALLOWED_HOSTS: Record<IntegrationProviderKind, readonly string[]> = {
  SLACK: ['hooks.slack.com'],
  DISCORD: ['discord.com', 'discordapp.com'],
}

function validProviderPath(provider: IntegrationProviderKind, path: string): boolean {
  if (provider === 'SLACK') {
    return /^\/services\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(path)
  }
  return /^\/api\/webhooks\/[0-9]+\/[A-Za-z0-9._-]+$/.test(path)
}

/** Exact provider host/path allowlist applied both when storing and sending. */
export function validateIntegrationWebhookUrl(
  provider: IntegrationProviderKind,
  rawUrl: string,
): URL {
  const parsed = new URL(validateExternalUrl(rawUrl, { field: 'webhookUrl' }))
  const host = parsed.hostname.toLowerCase()
  if (!ALLOWED_HOSTS[provider].includes(host)) {
    throw unprocessable(
      ErrorCode.INVALID_EXTERNAL_URL,
      `webhookUrl must use a recognised ${provider} webhook host.`,
    )
  }
  if ((parsed.port !== '' && parsed.port !== '443') || parsed.search !== '' || parsed.hash !== '') {
    throw unprocessable(
      ErrorCode.INVALID_EXTERNAL_URL,
      'webhookUrl must use the provider HTTPS endpoint without a custom port, query, or fragment.',
    )
  }
  if (!validProviderPath(provider, parsed.pathname)) {
    throw unprocessable(
      ErrorCode.INVALID_EXTERNAL_URL,
      `webhookUrl is not a valid ${provider} incoming-webhook path.`,
    )
  }
  return parsed
}

function buildPayload(provider: IntegrationProviderKind, text: string): unknown {
  return provider === 'SLACK' ? { text } : { content: text }
}

type ResolveAll = (hostname: string) => Promise<LookupAddress[]>

function defaultResolveAll(hostname: string): Promise<LookupAddress[]> {
  return dnsLookup(hostname, { all: true, verbatim: true })
}

function postPinned(
  url: URL,
  address: LookupAddress,
  body: string,
  timeoutMs: number,
): Promise<{ status: number; oversized: boolean }> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const request = httpsRequest(
      url,
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body).toString(),
        },
        // Pin the exact address that passed validation. TLS SNI and Host still
        // use the provider hostname from `url`; no second DNS lookup occurs.
        lookup: (_hostname, _options, callback) => {
          callback(null, address.address, address.family)
        },
      },
      (response) => {
        let bytes = 0
        let oversized = false
        response.on('data', (chunk: Buffer | string) => {
          bytes += Buffer.byteLength(chunk)
          if (bytes > MAX_RESPONSE_BYTES) {
            oversized = true
            response.destroy()
          }
        })
        response.on('end', () => {
          clearTimeout(timeout)
          resolve({ status: response.statusCode ?? 0, oversized })
        })
        response.on('close', () => {
          if (!oversized) return
          clearTimeout(timeout)
          resolve({ status: response.statusCode ?? 0, oversized: true })
        })
      },
    )
    request.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    request.end(body)
  })
}

export function createIntegrationWebhookTransport(options?: {
  resolveAll?: ResolveAll
  post?: typeof postPinned
  timeoutMs?: number
}): IntegrationWebhookTransport {
  const resolveAll = options?.resolveAll ?? defaultResolveAll
  const post = options?.post ?? postPinned
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS

  return {
    async send(provider, webhookUrl, text) {
      try {
        const parsed = validateIntegrationWebhookUrl(provider, webhookUrl)
        const resolved = await resolveAll(parsed.hostname)
        if (resolved.length === 0 || resolved.some((entry) => isBlockedAddress(entry.address))) {
          return {
            succeeded: false,
            retryable: false,
            responseStatus: null,
            errorMessage: 'Webhook host resolved to a private, reserved, or unavailable address.',
          }
        }

        const body = JSON.stringify(buildPayload(provider, text))
        const response = await post(parsed, resolved[0] as LookupAddress, body, timeoutMs)
        if (response.oversized) {
          return {
            succeeded: false,
            retryable: false,
            responseStatus: response.status,
            errorMessage: 'Webhook response exceeded the permitted size.',
          }
        }
        const succeeded = response.status >= 200 && response.status < 300
        return {
          succeeded,
          retryable: !succeeded && (response.status === 429 || response.status >= 500),
          responseStatus: response.status,
          errorMessage: succeeded ? null : `Webhook responded with status ${response.status}.`,
        }
      } catch (error) {
        return {
          succeeded: false,
          retryable: !AppError.isAppError(error),
          responseStatus: null,
          errorMessage:
            error instanceof Error ? error.message.slice(0, 1000) : 'Unknown delivery error.',
        }
      }
    },
  }
}

import { describe, expect, test } from 'bun:test'
import {
  createIntegrationWebhookTransport,
  validateIntegrationWebhookUrl,
} from '../../src/shared/integrations'

const slackUrl = 'https://hooks.slack.com/services/T000/B000/secret-token'
const publicAddress = { address: '93.184.216.34', family: 4 as const }

describe('integration webhook URL policy', () => {
  test('allows only exact provider hosts and webhook path shapes', () => {
    expect(validateIntegrationWebhookUrl('SLACK', slackUrl).hostname).toBe('hooks.slack.com')
    expect(() =>
      validateIntegrationWebhookUrl(
        'SLACK',
        'https://hooks.slack.com.attacker.example/services/T000/B000/token',
      ),
    ).toThrow()
    expect(() =>
      validateIntegrationWebhookUrl('DISCORD', 'https://discord.com/not-a-webhook/1/token'),
    ).toThrow()
    expect(() =>
      validateIntegrationWebhookUrl('DISCORD', 'https://discord.com:444/api/webhooks/1/token'),
    ).toThrow()
  })

  test('rejects a DNS answer containing any private address before transport', async () => {
    let posted = false
    const transport = createIntegrationWebhookTransport({
      resolveAll: async () => [publicAddress, { address: '127.0.0.1', family: 4 }],
      post: async () => {
        posted = true
        return { status: 204, oversized: false }
      },
    })

    await expect(transport.send('SLACK', slackUrl, 'hello')).resolves.toMatchObject({
      succeeded: false,
      retryable: false,
    })
    expect(posted).toBe(false)
  })

  test('pins the validated address and does not follow redirects', async () => {
    let pinnedAddress: string | undefined
    const transport = createIntegrationWebhookTransport({
      resolveAll: async () => [publicAddress],
      post: async (_url, address) => {
        pinnedAddress = address.address
        return { status: 302, oversized: false }
      },
    })

    await expect(transport.send('SLACK', slackUrl, 'hello')).resolves.toEqual({
      succeeded: false,
      retryable: false,
      responseStatus: 302,
      errorMessage: 'Webhook responded with status 302.',
    })
    expect(pinnedAddress).toBe(publicAddress.address)
  })

  test('retries provider throttling and server failures, but not invalid stored URLs', async () => {
    const throttled = createIntegrationWebhookTransport({
      resolveAll: async () => [publicAddress],
      post: async () => ({ status: 429, oversized: false }),
    })
    await expect(throttled.send('SLACK', slackUrl, 'hello')).resolves.toMatchObject({
      succeeded: false,
      retryable: true,
      responseStatus: 429,
    })

    await expect(
      throttled.send('SLACK', 'https://attacker.example/services/T/B/token', 'hello'),
    ).resolves.toMatchObject({ succeeded: false, retryable: false })
  })
})

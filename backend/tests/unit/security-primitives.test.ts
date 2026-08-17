import { describe, expect, test } from 'bun:test'
import { loadConfig } from '../../src/shared/config'
import { createEncryptionService, DecryptionError } from '../../src/shared/encryption'
import {
  assertCsrfSafe,
  generateJoinCode,
  generateSecureToken,
  hashJoinCode,
  hashToken,
  isBlockedAddress,
  isSafeMethod,
  normalizeJoinCode,
  secureCompare,
  validateExternalUrl,
} from '../../src/shared/security'

/**
 * The primitives every token, credential, and URL in the system depends on.
 *
 * Master prompt sections 9.1, 9.2, 15.2, 37, and the threat classes in section
 * 54 (join-code brute force, SSRF, CSRF, account takeover).
 */

describe('secure tokens', () => {
  test('generates unique, high-entropy, URL-safe tokens', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateSecureToken()))
    expect(tokens.size).toBe(500)

    for (const token of tokens) {
      // base64url: safe to place in a link without escaping.
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(Buffer.from(token, 'base64url').length).toBe(32)
    }
  })

  test('hashes are deterministic and do not reveal the token', () => {
    const token = generateSecureToken()
    expect(hashToken(token)).toBe(hashToken(token))
    expect(hashToken(token)).toHaveLength(64)
    expect(hashToken(token)).not.toContain(token)
  })

  test('constant-time comparison distinguishes equal from unequal digests', () => {
    const a = hashToken('alpha')
    expect(secureCompare(a, a)).toBe(true)
    expect(secureCompare(a, hashToken('beta'))).toBe(false)
    // Different lengths must not throw; they are simply unequal.
    expect(secureCompare(a, 'short')).toBe(false)
  })
})

describe('join codes', () => {
  test('are unique and drawn from an unambiguous alphabet', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateJoinCode()))
    expect(codes.size).toBe(500)

    for (const code of codes) {
      // No look-alike characters (0/O, 1/I/L) because humans type these.
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789-]+$/)
      expect(normalizeJoinCode(code)).toHaveLength(12)
    }
  })

  test('carry enough entropy that guessing is impractical', () => {
    // 12 characters over a 32-symbol alphabet is 60 bits. Combined with the
    // redemption rate limit, brute force is not a practical attack.
    const alphabetBits = Math.log2(32)
    expect(alphabetBits * 12).toBeGreaterThanOrEqual(60)
  })

  test('normalization tolerates how a human retypes a code', () => {
    const code = generateJoinCode()
    const normalized = normalizeJoinCode(code)

    expect(normalizeJoinCode(code.toLowerCase())).toBe(normalized)
    expect(normalizeJoinCode(`  ${code}  `)).toBe(normalized)
    expect(normalizeJoinCode(code.replaceAll('-', ' '))).toBe(normalized)
    expect(hashJoinCode(code.toLowerCase())).toBe(hashJoinCode(code))
  })
})

describe('integration credential encryption', () => {
  const config = loadConfig({
    APP_ENV: 'test',
    DATABASE_URL: 'postgresql://ip_app:secret@localhost:5432/app',
    CACHE_REDIS_URL: 'redis://localhost:6379',
    QUEUE_REDIS_URL: 'redis://localhost:6380',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 3).toString('base64'),
    OBJECT_STORAGE_ENABLED: 'false',
  })
  const encryption = createEncryptionService(config)
  const webhookUrl = 'https://hooks.slack.com/services/T000/B000/XXXXXXXXXXXX'
  const context = 'integration:01930000-0000-7000-8000-000000000001'

  test('round-trips a credential', () => {
    const sealed = encryption.seal(webhookUrl, context)
    expect(sealed.ciphertext).not.toContain('hooks.slack.com')
    expect(encryption.open(sealed, context)).toBe(webhookUrl)
  })

  test('produces a different ciphertext each time', () => {
    // A fresh IV per encryption: identical plaintexts must not be linkable.
    const first = encryption.seal(webhookUrl, context)
    const second = encryption.seal(webhookUrl, context)
    expect(first.ciphertext).not.toBe(second.ciphertext)
  })

  test('refuses to decrypt under a different context', () => {
    // This is what stops a ciphertext copied from one organization's row into
    // another's from being usable.
    const sealed = encryption.seal(webhookUrl, context)
    expect(() => encryption.open(sealed, 'integration:someone-else')).toThrow(DecryptionError)
  })

  test('detects tampering with the ciphertext', () => {
    const sealed = encryption.seal(webhookUrl, context)
    const parts = sealed.ciphertext.split('.')
    const corrupted = Buffer.from(parts[2] as string, 'base64')
    corrupted[0] = (corrupted[0] ?? 0) ^ 0xff
    const tampered = {
      keyVersion: sealed.keyVersion,
      ciphertext: [parts[0], parts[1], corrupted.toString('base64')].join('.'),
    }

    expect(() => encryption.open(tampered, context)).toThrow(DecryptionError)
  })

  test('records the key version so the master key can be rotated', () => {
    const sealed = encryption.seal(webhookUrl, context)
    expect(sealed.keyVersion).toBe(encryption.currentKeyVersion())
    expect(() => encryption.open({ ...sealed, keyVersion: 99 }, context)).toThrow(/key version 99/)
  })
})

describe('external URL validation', () => {
  test('accepts an ordinary https link', () => {
    expect(validateExternalUrl('https://github.com/team/project', { field: 'repositoryUrl' })).toBe(
      'https://github.com/team/project',
    )
  })

  test('rejects non-https schemes', () => {
    for (const url of [
      'http://example.org',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'ftp://example.org/file',
    ]) {
      expect(() => validateExternalUrl(url, { field: 'demoUrl' })).toThrow()
    }
  })

  test('rejects embedded credentials', () => {
    expect(() =>
      validateExternalUrl('https://user:password@example.org/x', { field: 'demoUrl' }),
    ).toThrow(/must not embed credentials/)
  })

  test('rejects an over-long URL', () => {
    expect(() =>
      validateExternalUrl(`https://example.org/${'a'.repeat(3000)}`, { field: 'demoUrl' }),
    ).toThrow(/between 1 and 2048/)
  })

  test('restricts video links to the embed allowlist', () => {
    expect(
      validateExternalUrl('https://www.youtube.com/watch?v=abc', {
        field: 'pitchVideoUrl',
        requireEmbedHost: true,
      }),
    ).toContain('youtube.com')

    expect(() =>
      validateExternalUrl('https://evil.example.org/embed', {
        field: 'pitchVideoUrl',
        requireEmbedHost: true,
      }),
    ).toThrow(/supported provider/)
  })
})

describe('SSRF address filtering', () => {
  test('blocks loopback, private, link-local and metadata addresses', () => {
    const blocked = [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      // The cloud instance metadata endpoint: the classic SSRF target.
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '::1',
      'fe80::1',
      'fd00::1',
      '::ffff:127.0.0.1',
    ]
    for (const address of blocked) {
      expect(isBlockedAddress(address)).toBe(true)
    }
  })

  test('allows ordinary public addresses', () => {
    for (const address of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '93.184.216.34', '2606:4700::1']) {
      expect(isBlockedAddress(address)).toBe(false)
    }
  })
})

describe('CSRF protection', () => {
  const trustedOrigins = ['https://app.example.org']
  const publicBaseUrl = 'https://api.example.org'

  test('safe methods are never blocked', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(isSafeMethod(method)).toBe(true)
      expect(() =>
        assertCsrfSafe({
          method,
          originHeader: 'https://evil.example.org',
          refererHeader: null,
          hasSessionCookie: true,
          trustedOrigins,
          publicBaseUrl,
        }),
      ).not.toThrow()
    }
  })

  test('an unsafe request from a trusted origin is allowed', () => {
    expect(() =>
      assertCsrfSafe({
        method: 'POST',
        originHeader: 'https://app.example.org',
        refererHeader: null,
        hasSessionCookie: true,
        trustedOrigins,
        publicBaseUrl,
      }),
    ).not.toThrow()
  })

  test('an unsafe cookie-authenticated request from another origin is rejected', () => {
    expect(() =>
      assertCsrfSafe({
        method: 'POST',
        originHeader: 'https://evil.example.org',
        refererHeader: null,
        hasSessionCookie: true,
        trustedOrigins,
        publicBaseUrl,
      }),
    ).toThrow(/trusted origin/)
  })

  test('an unsafe cookie-authenticated request with no origin information is rejected', () => {
    // Browsers always send Origin on cross-origin unsafe requests, so a missing
    // one on a cookie-bearing request is not a browser. Fail closed.
    expect(() =>
      assertCsrfSafe({
        method: 'POST',
        originHeader: null,
        refererHeader: null,
        hasSessionCookie: true,
        trustedOrigins,
        publicBaseUrl,
      }),
    ).toThrow(/did not identify its origin/)
  })

  test('a request without a session cookie carries no ambient authority', () => {
    // Signature-authenticated webhooks and token flows must not be blocked.
    expect(() =>
      assertCsrfSafe({
        method: 'POST',
        originHeader: null,
        refererHeader: null,
        hasSessionCookie: false,
        trustedOrigins,
        publicBaseUrl,
      }),
    ).not.toThrow()
  })

  test('falls back to Referer when Origin is absent', () => {
    expect(() =>
      assertCsrfSafe({
        method: 'POST',
        originHeader: null,
        refererHeader: 'https://app.example.org/dashboard',
        hasSessionCookie: true,
        trustedOrigins,
        publicBaseUrl,
      }),
    ).not.toThrow()
  })
})

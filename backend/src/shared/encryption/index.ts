import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { AppConfig } from '../config/config.schema'

/**
 * Authenticated encryption for credentials stored at rest.
 *
 * Used for organizer-supplied integration secrets — Slack and Discord webhook
 * URLs — which are bearer credentials: anyone holding one can post into the
 * organization's channel (master prompt sections 18, 37).
 *
 * AES-256-GCM from the platform's crypto library. No home-grown constructions:
 * GCM authenticates the ciphertext, so a tampered value fails to decrypt rather
 * than silently yielding garbage.
 *
 * The stored envelope records the key version, so the master key can be rotated
 * without a flag day: new writes use the current version while old values stay
 * readable until they are re-encrypted.
 */

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12 // 96 bits, the size GCM is defined for
const AUTH_TAG_BYTES = 16

export interface SealedValue {
  /** Version of the master key used, for rotation. */
  readonly keyVersion: number
  /** base64(iv) . base64(authTag) . base64(ciphertext) */
  readonly ciphertext: string
}

export interface EncryptionService {
  /**
   * Encrypt a secret.
   *
   * `context` is bound as additional authenticated data, so a ciphertext copied
   * from one organization's integration row into another's fails to decrypt.
   */
  seal(plaintext: string, context: string): SealedValue
  open(sealed: SealedValue, context: string): string
  /** The key version new writes should use. */
  currentKeyVersion(): number
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DecryptionError'
  }
}

export function createEncryptionService(config: AppConfig): EncryptionService {
  const key = Buffer.from(config.encryption.masterKey, 'base64')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_MASTER_KEY must decode to exactly 32 bytes for AES-256-GCM.')
  }

  const version = config.encryption.keyVersion

  return {
    currentKeyVersion(): number {
      return version
    },

    seal(plaintext: string, context: string): SealedValue {
      const iv = randomBytes(IV_BYTES)
      const cipher = createCipheriv(ALGORITHM, key, iv)
      cipher.setAAD(Buffer.from(context, 'utf8'))

      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
      const authTag = cipher.getAuthTag()

      return {
        keyVersion: version,
        ciphertext: [
          iv.toString('base64'),
          authTag.toString('base64'),
          encrypted.toString('base64'),
        ].join('.'),
      }
    },

    open(sealed: SealedValue, context: string): string {
      if (sealed.keyVersion !== version) {
        throw new DecryptionError(
          `Stored value was sealed with key version ${sealed.keyVersion}, but this process ` +
            `only holds version ${version}. Supply the previous key to re-encrypt it.`,
        )
      }

      const parts = sealed.ciphertext.split('.')
      if (parts.length !== 3) {
        throw new DecryptionError('Malformed ciphertext envelope.')
      }

      const [ivPart, tagPart, dataPart] = parts as [string, string, string]
      const iv = Buffer.from(ivPart, 'base64')
      const authTag = Buffer.from(tagPart, 'base64')
      const data = Buffer.from(dataPart, 'base64')

      if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
        throw new DecryptionError('Malformed ciphertext envelope.')
      }

      try {
        const decipher = createDecipheriv(ALGORITHM, key, iv)
        decipher.setAAD(Buffer.from(context, 'utf8'))
        decipher.setAuthTag(authTag)
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
      } catch {
        // Deliberately opaque: the failure reason (wrong key, wrong context,
        // tampering) is not something a caller should be able to distinguish.
        throw new DecryptionError('Failed to decrypt the stored credential.')
      }
    },
  }
}

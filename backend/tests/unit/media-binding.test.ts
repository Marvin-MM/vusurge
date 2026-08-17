import { describe, expect, test } from 'bun:test'
import {
  isConfirmedMediaBinding,
  type MediaAssetRow,
} from '../../src/modules/media/media.repository'

const asset: MediaAssetRow = {
  id: '01930000-0000-7000-8000-000000000001',
  purpose: 'SUBMISSION_SCREENSHOT',
  status: 'CONFIRMED',
  deliveryType: 'AUTHENTICATED',
  organizationId: '01930000-0000-7000-8000-000000000002',
  challengeId: '01930000-0000-7000-8000-000000000003',
  ownerUserId: '01930000-0000-7000-8000-000000000004',
  resourceType: 'submission',
  resourceId: '01930000-0000-7000-8000-000000000005',
  cloudinaryPublicId: 'private/submission/asset',
  format: 'png',
  bytes: 128,
  width: 16,
  height: 16,
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  confirmedAt: new Date('2029-01-01T00:00:00.000Z'),
  deletionRequestedAt: null,
  deletedAt: null,
  createdAt: new Date('2029-01-01T00:00:00.000Z'),
}

const expected = {
  purpose: 'SUBMISSION_SCREENSHOT' as const,
  organizationId: asset.organizationId,
  challengeId: asset.challengeId,
  resourceType: 'submission',
  resourceId: asset.resourceId,
  ownerUserId: asset.ownerUserId,
}

describe('media attachment binding', () => {
  test('accepts only a confirmed exact-resource authorization', () => {
    expect(isConfirmedMediaBinding(asset, expected)).toBe(true)
  })

  test.each([
    ['status', { status: 'PENDING' as const }],
    ['purpose', { purpose: 'CHALLENGE_COVER' as const }],
    ['organization', { organizationId: crypto.randomUUID() }],
    ['challenge', { challengeId: crypto.randomUUID() }],
    ['resource type', { resourceType: 'challenge' }],
    ['resource id', { resourceId: crypto.randomUUID() }],
    ['owner', { ownerUserId: crypto.randomUUID() }],
  ])('rejects a mismatched %s', (_name, patch) => {
    expect(isConfirmedMediaBinding({ ...asset, ...patch }, expected)).toBe(false)
  })
})

import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext, AccessContextResolver } from '../../shared/authorization'
import { authorize, checkPermission, Permission } from '../../shared/authorization'
import type { AppConfig } from '../../shared/config/config.schema'
import type { PrismaTransactionClient, TenantTransactionRunner } from '../../shared/database'
import { badRequest, conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import { newId } from '../../shared/ids'
import type { ImageDeliveryAuthorization, ImageDeliveryType, ImageProvider } from '../../shared/images'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue'
import { type RateLimiter, RateLimitPolicies } from '../../shared/rate-limit'
import type { ParticipationRepository } from '../participation/participation.repository'
import type { MediaAssetPurpose, MediaAssetRow, MediaRepository } from './media.repository'

const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

interface PurposeRule {
  readonly requiresOrganization: boolean
  readonly requiresChallenge: boolean
  /** Requires the caller to be an APPROVED participant of `challengeId`. */
  readonly requiresParticipant: boolean
  readonly deliveryType: 'UPLOAD' | 'AUTHENTICATED'
  readonly permission: Permission | null
  readonly resourceType: string
  readonly explicitResourceId: boolean
}

const PURPOSE_RULES: Record<MediaAssetPurpose, PurposeRule> = {
  USER_AVATAR: {
    requiresOrganization: false,
    requiresChallenge: false,
    requiresParticipant: false,
    deliveryType: 'AUTHENTICATED',
    permission: null,
    resourceType: 'user',
    explicitResourceId: false,
  },
  ORGANIZATION_LOGO: {
    requiresOrganization: true,
    requiresChallenge: false,
    requiresParticipant: false,
    deliveryType: 'AUTHENTICATED',
    permission: Permission.OrganizationManageProfile,
    resourceType: 'organization',
    explicitResourceId: false,
  },
  CHALLENGE_COVER: {
    requiresOrganization: true,
    requiresChallenge: true,
    requiresParticipant: false,
    deliveryType: 'AUTHENTICATED',
    permission: Permission.ChallengeEdit,
    resourceType: 'challenge',
    explicitResourceId: false,
  },
  SPONSOR_LOGO: {
    requiresOrganization: true,
    requiresChallenge: true,
    requiresParticipant: false,
    deliveryType: 'AUTHENTICATED',
    permission: Permission.ChallengeManageSponsors,
    resourceType: 'challenge_sponsor',
    explicitResourceId: true,
  },
  SUBMISSION_SCREENSHOT: {
    requiresOrganization: true,
    requiresChallenge: true,
    requiresParticipant: true,
    deliveryType: 'AUTHENTICATED',
    permission: null,
    resourceType: 'submission',
    explicitResourceId: true,
  },
  SUPPORT_TICKET_SCREENSHOT: {
    requiresOrganization: false,
    requiresChallenge: false,
    requiresParticipant: false,
    deliveryType: 'AUTHENTICATED',
    permission: null,
    resourceType: 'support_ticket',
    explicitResourceId: true,
  },
  PORTFOLIO_EVIDENCE: {
    requiresOrganization: true,
    requiresChallenge: false,
    requiresParticipant: false,
    deliveryType: 'AUTHENTICATED',
    permission: Permission.InnovationManage,
    resourceType: 'innovation',
    explicitResourceId: true,
  },
}

export interface UploadAuthorizationInput {
  purpose: MediaAssetPurpose
  organizationId?: string
  challengeId?: string
  resourceId?: string
  mimeType: string
}

export interface UploadAuthorizationResult {
  assetId: string
  uploadUrl: string
  cloudName: string
  apiKey: string
  timestamp: number
  signature: string
  folder: string
  publicId: string
  type: ImageDeliveryType
  expiresAt: Date
}

export interface MediaService {
  createUploadAuthorization(
    access: AccessContext,
    input: UploadAuthorizationInput,
  ): Promise<UploadAuthorizationResult>
  confirm(access: AccessContext, assetId: string): Promise<MediaAssetRow>
  getDeliveryUrl(access: AccessContext, assetId: string): Promise<ImageDeliveryAuthorization>
  getPublicDeliveryUrl(
    assetId: string,
    ipAddress: string | undefined,
  ): Promise<ImageDeliveryAuthorization>
  remove(access: AccessContext, assetId: string): Promise<void>
}

interface MediaAssetScope {
  id: string
  organizationId: string | null
  challengeId: string | null
  ownedByActor: boolean
  purpose: MediaAssetPurpose
}

function checkMediaPermission(access: AccessContext, permission: Permission): boolean {
  return checkPermission(access, permission).allowed
}

async function mediaAssetIsReferenced(
  tx: PrismaTransactionClient,
  asset: MediaAssetRow,
): Promise<boolean> {
  switch (asset.purpose) {
    case 'USER_AVATAR':
      return (await tx.userProfile.count({ where: { avatarAssetId: asset.id } })) > 0
    case 'ORGANIZATION_LOGO':
      return (await tx.organization.count({ where: { logoAssetId: asset.id } })) > 0
    case 'CHALLENGE_COVER':
      return (await tx.challenge.count({ where: { coverAssetId: asset.id } })) > 0
    case 'SPONSOR_LOGO':
      return (await tx.challengeSponsor.count({ where: { logoAssetId: asset.id } })) > 0
    case 'SUBMISSION_SCREENSHOT':
      return (await tx.submissionAsset.count({ where: { mediaAssetId: asset.id } })) > 0
    case 'PORTFOLIO_EVIDENCE':
      return (await tx.innovationEvidence.count({ where: { mediaAssetId: asset.id } })) > 0
    case 'SUPPORT_TICKET_SCREENSHOT':
      return false
  }
}

async function authorizeForPurpose(
  resolver: AccessContextResolver,
  participationRepository: ParticipationRepository,
  transactions: TenantTransactionRunner,
  access: AccessContext,
  purpose: MediaAssetPurpose,
  organizationId: string | undefined,
  challengeId: string | undefined,
  resourceId: string | undefined,
): Promise<void> {
  const rule = PURPOSE_RULES[purpose]
  if (rule.explicitResourceId && resourceId === undefined) {
    throw badRequest(`The "${purpose}" media purpose requires a resourceId.`)
  }
  if (!rule.explicitResourceId && resourceId !== undefined) {
    throw badRequest(`The "${purpose}" media purpose derives its resource and rejects resourceId.`)
  }

  if (purpose === 'SUPPORT_TICKET_SCREENSHOT') {
    if (challengeId !== undefined) {
      throw badRequest('Support-ticket screenshots do not take a challenge context.')
    }
    const actorUserId = access.actor?.userId
    if (actorUserId === undefined || resourceId === undefined)
      throw notFound('Support ticket not found.')
    const ticket = await transactions.withoutTenant(
      (tx) =>
        tx.supportTicket.findUnique({
          where: { id: resourceId },
          select: { userId: true, organizationId: true },
        }),
      { actorUserId },
    )
    if (
      ticket === null ||
      ticket.userId !== actorUserId ||
      ticket.organizationId !== (organizationId ?? null)
    ) {
      throw notFound('Support ticket not found.')
    }
    return
  }

  if (!rule.requiresOrganization) {
    if (organizationId !== undefined) {
      throw badRequest(`The "${purpose}" media purpose does not take an organization context.`)
    }
    return
  }

  if (organizationId === undefined) {
    throw badRequest(`The "${purpose}" media purpose requires an organization context.`)
  }

  if (rule.requiresChallenge && challengeId === undefined) {
    throw badRequest(`The "${purpose}" media purpose requires a challenge context.`)
  }

  const organization = await resolver.resolveOrganization(
    organizationId,
    access.actor?.userId ?? null,
  )
  if (organization === null) throw notFound('Organization not found.')

  const scopedAccess: AccessContext = { ...access, organization }

  if (challengeId !== undefined) {
    const challenge = await resolver.resolveChallenge(
      challengeId,
      organizationId,
      access.actor?.userId ?? null,
    )
    if (challenge === null) throw notFound('Challenge not found.')
  }

  if (rule.requiresParticipant) {
    const actorUserId = access.actor?.userId
    if (challengeId === undefined || actorUserId === undefined) {
      throw badRequest(`The "${purpose}" media purpose requires a challenge context.`)
    }
    const participation = await transactions.withTenant(organizationId, (tx) =>
      participationRepository.findByChallengeAndUser(tx, organizationId, challengeId, actorUserId),
    )
    if (participation === null || participation.status !== 'APPROVED') {
      throw forbidden('Only approved challenge participants may upload this media purpose.')
    }
    const ownsSubmission = await transactions.withTenant(
      organizationId,
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ allowed: boolean }>>`
          select exists (
            select 1
            from submission s
            join challenge_team_member tm
              on tm.team_id = s.team_id
             and tm.organization_id = s.organization_id
             and tm.challenge_id = s.challenge_id
            where s.id = ${resourceId}::uuid
              and s.organization_id = ${organizationId}::uuid
              and s.challenge_id = ${challengeId}::uuid
              and tm.user_id = ${actorUserId}::uuid
          ) as allowed
        `
        return rows[0]?.allowed === true
      },
      { actorUserId },
    )
    if (!ownsSubmission) throw notFound('Submission not found.')
    return
  }

  if (rule.permission !== null) {
    authorize(scopedAccess, rule.permission)
  }

  if (purpose === 'SPONSOR_LOGO') {
    const sponsorExists = await transactions.withTenant(
      organizationId,
      async (tx) =>
        (await tx.challengeSponsor.count({
          where: { id: resourceId, organizationId, challengeId },
        })) === 1,
      { actorUserId: access.actor?.userId },
    )
    if (!sponsorExists) throw notFound('Challenge sponsor not found.')
  } else if (purpose === 'PORTFOLIO_EVIDENCE') {
    const innovationExists = await transactions.withTenant(
      organizationId,
      async (tx) =>
        (await tx.innovation.count({ where: { id: resourceId, organizationId } })) === 1,
      { actorUserId: access.actor?.userId },
    )
    if (!innovationExists) throw notFound('Innovation not found.')
  }
}

function resourceIdForAuthorization(
  purpose: MediaAssetPurpose,
  actorUserId: string,
  input: UploadAuthorizationInput,
): string {
  switch (purpose) {
    case 'USER_AVATAR':
      return actorUserId
    case 'ORGANIZATION_LOGO':
      return input.organizationId as string
    case 'CHALLENGE_COVER':
      return input.challengeId as string
    case 'SPONSOR_LOGO':
    case 'SUBMISSION_SCREENSHOT':
    case 'SUPPORT_TICKET_SCREENSHOT':
    case 'PORTFOLIO_EVIDENCE':
      return input.resourceId as string
  }
}

export function createMediaService(
  repository: MediaRepository,
  imageProvider: ImageProvider,
  resolver: AccessContextResolver,
  participationRepository: ParticipationRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  rateLimiter: RateLimiter,
  config: AppConfig,
): MediaService {
  async function resolveAssetScope(
    actorUserId: string,
    assetId: string,
  ): Promise<MediaAssetScope | null> {
    return transactions.withoutTenant(
      async (tx) => {
        const rows = await tx.$queryRaw<MediaAssetScope[]>`
          select id,
                 organization_id as "organizationId",
                 challenge_id as "challengeId",
                 owned_by_actor as "ownedByActor",
                 purpose
          from app_resolve_media_asset_context(${assetId}::uuid, ${actorUserId}::uuid)
        `
        return rows[0] ?? null
      },
      { actorUserId },
    )
  }

  function withAssetContext<T>(
    scope: MediaAssetScope,
    actorUserId: string,
    work: (tx: PrismaTransactionClient) => Promise<T>,
  ): Promise<T> {
    return scope.organizationId === null
      ? transactions.withoutTenant(work, { actorUserId })
      : transactions.withTenant(scope.organizationId, work, { actorUserId })
  }

  return {
    async createUploadAuthorization(access, input) {
      const actor = access.actor
      if (actor === null || actor === undefined) throw forbidden()
      if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
        throw badRequest('Only JPEG, PNG, WebP, and GIF images are accepted.')
      }

      await rateLimiter.enforce(RateLimitPolicies.ImageUploadAuthorization, {
        userId: actor.userId,
      })
      if (input.organizationId !== undefined) {
        await rateLimiter.enforce(RateLimitPolicies.ImageUploadAuthorizationOrganization, {
          organizationId: input.organizationId,
        })
      }

      await authorizeForPurpose(
        resolver,
        participationRepository,
        transactions,
        access,
        input.purpose,
        input.organizationId,
        input.challengeId,
        input.resourceId,
      )

      const rule = PURPOSE_RULES[input.purpose]
      const assetId = newId()
      const folder = `${config.cloudinary.folderPrefix}/${input.purpose.toLowerCase()}`
      // Cloudinary prefixes `folder` to the upload `public_id`. Sign the leaf
      // ID and persist the resulting full identifier; signing both as full
      // paths would duplicate the folder at the provider.
      const publicId = `${folder}/${assetId}`
      const deliveryType = rule.deliveryType === 'UPLOAD' ? 'upload' : 'authenticated'
      const expiresAt = new Date(Date.now() + config.cloudinary.uploadSignatureTtlSeconds * 1000)

      const authorization = imageProvider.createUploadAuthorization({
        publicId: assetId,
        folder,
        deliveryType,
      })

      const createPending = (tx: PrismaTransactionClient) =>
        repository.createPending(tx, {
          id: assetId,
          purpose: input.purpose,
          deliveryType: rule.deliveryType,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          ownerUserId: actor.userId,
          resourceType: rule.resourceType,
          resourceId: resourceIdForAuthorization(input.purpose, actor.userId, input),
          cloudinaryPublicId: publicId,
          expiresAt,
        })
      if (input.organizationId === undefined) {
        await transactions.withoutTenant(createPending, { actorUserId: actor.userId })
      } else {
        await transactions.withTenant(input.organizationId, createPending, {
          actorUserId: actor.userId,
        })
      }

      return {
        assetId,
        uploadUrl: authorization.uploadUrl,
        cloudName: authorization.cloudName,
        apiKey: authorization.apiKey,
        timestamp: authorization.timestamp,
        signature: authorization.signature,
        folder: authorization.folder,
        publicId: authorization.publicId,
        type: authorization.type,
        expiresAt,
      }
    },

    async confirm(access, assetId) {
      const actor = access.actor
      if (actor === null || actor === undefined) throw forbidden()

      const scope = await resolveAssetScope(actor.userId, assetId)
      if (scope === null) throw notFound('Media asset not found.')
      if (!scope.ownedByActor) throw forbidden()
      const asset = await withAssetContext(scope, actor.userId, (tx) =>
        repository.findById(tx, assetId),
      )
      if (asset === null) throw notFound('Media asset not found.')
      if (asset.status === 'CONFIRMED') return asset
      if (asset.status !== 'PENDING') throw notFound('Media asset not found.')

      if (asset.expiresAt < new Date()) {
        throw conflict(
          ErrorCode.CONFLICT,
          'This upload authorization has expired. Request a new one.',
        )
      }

      const deliveryType = asset.deliveryType === 'UPLOAD' ? 'upload' : 'authenticated'
      const metadata = await imageProvider.verifyUpload(asset.cloudinaryPublicId, deliveryType)
      if (metadata === null) {
        throw conflict(ErrorCode.CONFLICT, 'No upload was found for this authorization.')
      }
      if (
        !ALLOWED_MIME_TYPES.has(`image/${metadata.format === 'jpg' ? 'jpeg' : metadata.format}`)
      ) {
        throw badRequest('The uploaded file is not an accepted image format.')
      }
      if (metadata.bytes > MAX_UPLOAD_BYTES) {
        throw badRequest('The uploaded image exceeds the maximum allowed size.')
      }

      return withAssetContext(scope, actor.userId, async (tx) => {
        const confirmed = await repository.confirmPending(tx, assetId, metadata)
        if (confirmed === null) {
          const latest = await repository.findById(tx, assetId)
          if (latest?.status === 'CONFIRMED') return latest
          throw conflict(ErrorCode.CONFLICT, 'The upload is no longer confirmable.')
        }

        await audit.write(tx, {
          organizationId: asset.organizationId ?? undefined,
          actorType: 'USER',
          actorUserId: actor.userId,
          action: AuditAction.MediaAssetClaimed,
          resourceType: 'media_asset',
          resourceId: assetId,
          summary: `Confirmed a ${asset.purpose.toLowerCase().replace(/_/g, ' ')} upload.`,
        })

        return confirmed
      })
    },

    async getDeliveryUrl(access, assetId) {
      const actor = access.actor
      if (actor === null || actor === undefined) throw forbidden()

      const scope = await resolveAssetScope(actor.userId, assetId)
      if (scope === null) throw notFound('Media asset not found.')
      const isPlatformSupportReviewer =
        scope.purpose === 'SUPPORT_TICKET_SCREENSHOT' &&
        checkMediaPermission(access, Permission.PlatformSupport)
      const asset = isPlatformSupportReviewer
        ? await transactions.withPlatformAccess((tx) => repository.findById(tx, assetId), {
            actorUserId: actor.userId,
            purpose: 'Review an exact support-ticket screenshot.',
          })
        : await withAssetContext(scope, actor.userId, (tx) => repository.findById(tx, assetId))
      if (asset === null || asset.status !== 'CONFIRMED') throw notFound('Media asset not found.')

      let allowed =
        (asset.organizationId === null || asset.purpose === 'PORTFOLIO_EVIDENCE') &&
        asset.ownerUserId === actor.userId
      if (asset.purpose === 'SUPPORT_TICKET_SCREENSHOT') {
        const ticket = await transactions.withoutTenant(
          (tx) =>
            tx.supportTicket.findUnique({
              where: { id: asset.resourceId },
              select: { userId: true, assignedToUserId: true, organizationId: true },
            }),
          { actorUserId: actor.userId },
        )
        allowed =
          ticket !== null &&
          ticket.organizationId === asset.organizationId &&
          (ticket.userId === actor.userId ||
            ticket.assignedToUserId === actor.userId ||
            isPlatformSupportReviewer)
      } else if (asset.organizationId !== null) {
        const organization = await resolver.resolveOrganization(asset.organizationId, actor.userId)
        const challenge =
          asset.challengeId === null
            ? undefined
            : ((await resolver.resolveChallenge(
                asset.challengeId,
                asset.organizationId,
                actor.userId,
              )) ?? undefined)
        if (organization !== null && (asset.challengeId === null || challenge !== null)) {
          const scopedAccess: AccessContext = {
            ...access,
            organization,
            ...(challenge === undefined ? {} : { challenge }),
          }

          if (asset.purpose === 'ORGANIZATION_LOGO') {
            allowed = checkMediaPermission(scopedAccess, Permission.OrganizationManageProfile)
          } else if (asset.purpose === 'CHALLENGE_COVER' || asset.purpose === 'SPONSOR_LOGO') {
            allowed = checkMediaPermission(
              scopedAccess,
              asset.purpose === 'CHALLENGE_COVER'
                ? Permission.ChallengeEdit
                : Permission.ChallengeManageSponsors,
            )
          } else if (asset.purpose === 'SUBMISSION_SCREENSHOT') {
            const elevated = checkMediaPermission(scopedAccess, Permission.SubmissionViewAll)
            allowed =
              elevated ||
              (await transactions.withTenant(
                asset.organizationId,
                async (tx) => {
                  const rows = await tx.$queryRaw<Array<{ allowed: boolean }>>`
                  select exists (
                    select 1
                    from submission_asset sa
                    join submission_version sv on sv.id = sa.submission_version_id
                    join submission s on s.id = sv.submission_id
                    left join challenge_team_member tm
                      on tm.team_id = s.team_id and tm.user_id = ${actor.userId}::uuid
                    left join judge_assignment ja
                      on ja.submission_id = s.id and ja.status = 'ASSIGNED'
                    left join challenge_staff_assignment csa
                      on csa.id = ja.staff_assignment_id
                     and csa.user_id = ${actor.userId}::uuid
                     and csa.status = 'ACTIVE'
                    where sa.media_asset_id = ${asset.id}::uuid
                      and (tm.id is not null or csa.id is not null)
                  ) or (
                    not exists (
                      select 1 from submission_asset pending
                      where pending.media_asset_id = ${asset.id}::uuid
                    )
                    and ${asset.ownerUserId}::uuid = ${actor.userId}::uuid
                  ) as allowed
                `
                  return rows[0]?.allowed === true
                },
                { actorUserId: actor.userId },
              ))
          } else if (asset.purpose === 'PORTFOLIO_EVIDENCE') {
            allowed =
              asset.ownerUserId === actor.userId ||
              checkMediaPermission(scopedAccess, Permission.InnovationView)
          }
        }
      }

      if (!allowed) throw notFound('Media asset not found.')

      const deliveryType = asset.deliveryType === 'UPLOAD' ? 'upload' : 'authenticated'
      return imageProvider.getDeliveryUrl(asset.cloudinaryPublicId, deliveryType, asset.format)
    },

    async getPublicDeliveryUrl(assetId, ipAddress) {
      await rateLimiter.enforce(RateLimitPolicies.PublicListing, { ipAddress })
      const row = await transactions.withoutTenant(async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{
            cloudinaryPublicId: string
            deliveryType: MediaAssetRow['deliveryType']
            format: string | null
          }>
        >`
          select cloudinary_public_id as "cloudinaryPublicId",
                 delivery_type as "deliveryType", format
          from app_resolve_public_media_delivery(${assetId}::uuid)
        `
        return rows[0] ?? null
      })
      if (row === null) throw notFound('Media asset not found.')
      return imageProvider.getDeliveryUrl(
        row.cloudinaryPublicId,
        row.deliveryType === 'UPLOAD' ? 'upload' : 'authenticated',
        row.format,
      )
    },

    async remove(access, assetId) {
      const actor = access.actor
      if (actor === null || actor === undefined) throw forbidden()

      const scope = await resolveAssetScope(actor.userId, assetId)
      if (scope === null) throw notFound('Media asset not found.')
      const asset = await withAssetContext(scope, actor.userId, (tx) =>
        repository.findById(tx, assetId),
      )
      if (asset === null) throw notFound('Media asset not found.')

      if (asset.status === 'PENDING_DELETION') return
      if (asset.status === 'DELETED') throw notFound('Media asset not found.')

      if (asset.purpose === 'SUPPORT_TICKET_SCREENSHOT') {
        if (asset.ownerUserId !== actor.userId) throw notFound('Media asset not found.')
      } else if (asset.organizationId !== null) {
        const rule = PURPOSE_RULES[asset.purpose]
        const organization = await resolver.resolveOrganization(asset.organizationId, actor.userId)
        if (organization === null) throw notFound('Media asset not found.')
        const scopedAccess: AccessContext = { ...access, organization }
        if (rule.permission !== null) {
          authorize(scopedAccess, rule.permission)
        } else if (asset.ownerUserId !== actor.userId) {
          throw forbidden()
        }
      } else if (asset.ownerUserId !== actor.userId) {
        throw forbidden()
      }

      const markPending = async (tx: PrismaTransactionClient): Promise<void> => {
        const referenced = await mediaAssetIsReferenced(tx, asset)
        if (referenced) {
          throw conflict(ErrorCode.CONFLICT, 'Detach this media asset before deleting it.')
        }

        const pending = await repository.requestDeletion(tx, assetId)
        if (pending === null) return

        await audit.write(tx, {
          organizationId: asset.organizationId ?? undefined,
          actorType: 'USER',
          actorUserId: actor.userId,
          action: AuditAction.MediaAssetDeletionRequested,
          resourceType: 'media_asset',
          resourceId: assetId,
          summary: `Requested deletion of a ${asset.purpose.toLowerCase().replace(/_/g, ' ')} asset.`,
        })

        await outbox.write(tx, {
          eventType: 'media.asset_deletion_requested',
          queueName: QueueName.MediaCleanup,
          aggregateType: 'media_asset',
          aggregateId: assetId,
          organizationId: asset.organizationId ?? undefined,
          payload: { assetId },
          dedupeKey: `media.asset_deletion_requested:${assetId}`,
        })
      }

      await withAssetContext(scope, actor.userId, markPending)
    },
  }
}

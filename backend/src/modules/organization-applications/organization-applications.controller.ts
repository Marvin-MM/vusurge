import type { AccessContext } from '../../shared/authorization'
import { requireVerifiedActor } from '../../shared/authorization'
import { badRequest } from '../../shared/errors'
import type { IdempotencyStore } from '../../shared/idempotency'
import type {
  ApplicationEditableFields,
  ApplicationRow,
  ApplicationStatus,
} from './organization-applications.repository'
import type {
  CreateApplicationInput,
  OrganizationApplicationsService,
} from './organization-applications.service'

function serialize(row: ApplicationRow) {
  if (row.status === 'DRAFT') {
    // Reserved for a future release; this API never creates or transitions an
    // application into it (see the note on ApplicationStatus), so reaching
    // this branch would indicate a direct database write outside the API.
    throw new Error('Unexpected DRAFT organization application reached the response boundary.')
  }

  return {
    id: row.id,
    name: row.name,
    requestedSlug: row.requestedSlug,
    organizationType: row.organizationType,
    description: row.description,
    websiteUrl: row.websiteUrl,
    country: row.country,
    region: row.region,
    affiliatedInstitution: row.affiliatedInstitution,
    requesterRelationship: row.requesterRelationship,
    requestedVisibility: row.requestedVisibility,
    status: row.status,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    decisionReason: row.decisionReason,
    createdOrganizationId: row.createdOrganizationId,
    createdAt: row.createdAt.toISOString(),
  }
}

export function createOrganizationApplicationsController(
  service: OrganizationApplicationsService,
  idempotency: IdempotencyStore,
) {
  return {
    async create(
      access: AccessContext,
      body: CreateApplicationInput,
      idempotencyKey: string | undefined,
    ) {
      const { actor } = requireVerifiedActor(access)
      if (idempotencyKey === undefined) {
        throw badRequest('An Idempotency-Key header is required for this operation.')
      }
      await service.enforceCreateRateLimit(access)

      // The route sets the actual HTTP status from `status` here — Elysia
      // does not infer 201 from the response schema on its own, and the
      // status must be right on a replay too, which is why it travels with
      // the idempotency-stored value rather than being hard-coded 201 at the
      // route.
      const result = await idempotency.run(
        {
          actorUserId: actor.userId,
          operation: 'organization_application.create',
          key: idempotencyKey,
          requestBody: body,
        },
        async (tx) => {
          const created = await service.create(access, body, tx)
          return { status: 201, body: serialize(created) }
        },
      )
      return { status: result.status, body: result.value }
    },

    async listMine(access: AccessContext, query: { limit?: number; cursor?: string }) {
      const page = await service.listMine(access, query)
      return {
        items: page.items.map(serialize),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },

    async get(access: AccessContext, id: string) {
      return serialize(await service.get(access, id))
    },

    async update(access: AccessContext, id: string, patch: ApplicationEditableFields) {
      return serialize(await service.update(access, id, patch))
    },

    async resubmit(access: AccessContext, id: string, patch: ApplicationEditableFields) {
      return serialize(await service.resubmit(access, id, patch))
    },

    async listForPlatform(
      access: AccessContext,
      status: ApplicationStatus | undefined,
      query: { limit?: number; cursor?: string },
    ) {
      const page = await service.listForPlatform(access, status, query)
      return {
        items: page.items.map(serialize),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },

    async getForPlatform(access: AccessContext, id: string) {
      return serialize(await service.getForPlatform(access, id))
    },

    async approve(access: AccessContext, id: string, notes: string | undefined) {
      return service.approve(access, id, notes)
    },

    async reject(
      access: AccessContext,
      id: string,
      reason: string,
      internalNotes: string | undefined,
    ) {
      await service.reject(access, id, reason, internalNotes)
    },
  }
}

export type OrganizationApplicationsController = ReturnType<
  typeof createOrganizationApplicationsController
>

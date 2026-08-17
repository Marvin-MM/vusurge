import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

/**
 * `DRAFT` is part of the database enum (reserved for a future release, like
 * the `OPEN` join policy) but this API never creates or transitions an
 * application into it: `create` always sets `PENDING_REVIEW` directly.
 */
export type ApplicationStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'

export interface ApplicationRow {
  id: string
  requesterUserId: string
  name: string
  requestedSlug: string
  organizationType: string
  description: string
  websiteUrl: string | null
  country: string | null
  region: string | null
  affiliatedInstitution: string | null
  requesterRelationship: string
  requestedVisibility: 'PRIVATE' | 'PUBLIC'
  status: ApplicationStatus
  submittedAt: Date | null
  reviewedAt: Date | null
  decisionReason: string | null
  createdOrganizationId: string | null
  createdAt: Date
}

export interface CreateApplicationInput {
  id: string
  requesterUserId: string
  name: string
  requestedSlug: string
  organizationType: string
  description: string
  websiteUrl?: string
  socialLinks?: string[]
  country?: string
  region?: string
  affiliatedInstitution?: string
  requesterRelationship: string
  requestedVisibility: 'PRIVATE' | 'PUBLIC'
  acceptedTermsVersion: string
  acceptedTermsAt: Date
}

export interface ApplicationEditableFields {
  name?: string
  requestedSlug?: string
  organizationType?: string
  description?: string
  websiteUrl?: string
  country?: string
  region?: string
  affiliatedInstitution?: string
  requesterRelationship?: string
  requestedVisibility?: 'PRIVATE' | 'PUBLIC'
}

export interface OrganizationApplicationsRepository {
  create(client: PrismaTransactionClient, input: CreateApplicationInput): Promise<ApplicationRow>
  findById(client: PrismaTransactionClient, id: string): Promise<ApplicationRow | null>
  hasPending(client: PrismaTransactionClient, requesterUserId: string): Promise<boolean>
  update(
    client: PrismaTransactionClient,
    id: string,
    patch: ApplicationEditableFields,
  ): Promise<void>
  listMine(
    client: PrismaTransactionClient,
    userId: string,
    page: PageRequest,
  ): Promise<Page<ApplicationRow>>
  listForPlatform(
    client: PrismaTransactionClient,
    status: ApplicationStatus | undefined,
    page: PageRequest,
  ): Promise<Page<ApplicationRow>>
  markApproved(
    client: PrismaTransactionClient,
    id: string,
    input: { reviewerId: string; organizationId: string; notes?: string; now: Date },
  ): Promise<void>
  markRejected(
    client: PrismaTransactionClient,
    id: string,
    input: { reviewerId: string; reason: string; internalNotes?: string; now: Date },
  ): Promise<void>
  markResubmitted(client: PrismaTransactionClient, id: string, now: Date): Promise<void>
}

export function createOrganizationApplicationsRepository(): OrganizationApplicationsRepository {
  return {
    async create(client, input) {
      return client.organizationApplication.create({
        data: {
          id: input.id,
          requesterUserId: input.requesterUserId,
          name: input.name,
          requestedSlug: input.requestedSlug,
          organizationType: input.organizationType,
          description: input.description,
          websiteUrl: input.websiteUrl,
          socialLinks: input.socialLinks,
          country: input.country,
          region: input.region,
          affiliatedInstitution: input.affiliatedInstitution,
          requesterRelationship: input.requesterRelationship,
          requestedVisibility: input.requestedVisibility,
          acceptedTermsVersion: input.acceptedTermsVersion,
          acceptedTermsAt: input.acceptedTermsAt,
          status: 'PENDING_REVIEW',
          submittedAt: input.acceptedTermsAt,
        },
      })
    },

    async findById(client, id) {
      return client.organizationApplication.findUnique({ where: { id } })
    },

    async hasPending(client, requesterUserId) {
      const existing = await client.organizationApplication.findFirst({
        where: { requesterUserId, status: 'PENDING_REVIEW' },
        select: { id: true },
      })
      return existing !== null
    },

    async update(client, id, patch) {
      await client.organizationApplication.update({ where: { id }, data: patch })
    },

    async listMine(client, userId, page) {
      const rows = await client.organizationApplication.findMany({
        where: {
          requesterUserId: userId,
          ...(page.cursor
            ? {
                OR: [
                  { createdAt: { lt: new Date(page.cursor.at) } },
                  { createdAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })
      return buildPage(rows, page, (row) => ({ at: row.createdAt.toISOString(), id: row.id }))
    },

    async listForPlatform(client, status, page) {
      const rows = await client.organizationApplication.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(page.cursor
            ? {
                OR: [
                  { createdAt: { lt: new Date(page.cursor.at) } },
                  { createdAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })
      return buildPage(rows, page, (row) => ({ at: row.createdAt.toISOString(), id: row.id }))
    },

    async markApproved(client, id, input) {
      await client.organizationApplication.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedByUserId: input.reviewerId,
          reviewedAt: input.now,
          createdOrganizationId: input.organizationId,
          internalNotes: input.notes,
        },
      })
    },

    async markRejected(client, id, input) {
      await client.organizationApplication.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedByUserId: input.reviewerId,
          reviewedAt: input.now,
          decisionReason: input.reason,
          internalNotes: input.internalNotes,
        },
      })
    },

    async markResubmitted(client, id, now) {
      await client.organizationApplication.update({
        where: { id },
        data: {
          status: 'PENDING_REVIEW',
          submittedAt: now,
          reviewedByUserId: null,
          reviewedAt: null,
          decisionReason: null,
        },
      })
    },
  }
}

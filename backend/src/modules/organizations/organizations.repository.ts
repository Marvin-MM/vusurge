import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export interface OrganizationRow {
  id: string
  slug: string
  name: string
  description: string | null
  organizationType: string
  websiteUrl: string | null
  country: string | null
  region: string | null
  logoAssetId: string | null
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'
  visibility: 'PRIVATE' | 'PUBLIC'
  createdAt: Date
}

export interface OrganizationSettingsRow {
  organizationId: string
  // 'OPEN' deliberately excluded: the database CHECK constraint
  // (organization_join_policy_open_not_activatable_chk) guarantees this
  // column is never that value, so the type does not offer it either.
  joinPolicy: 'INVITE_ONLY' | 'CODE_OR_INVITE' | 'REQUEST_TO_JOIN'
  allowedEmailDomains: string[]
  memberDirectoryVisibleToMembers: boolean
  publicProjectGalleryEnabled: boolean
  publicMetricsEnabled: boolean
  publicContactEmail: string | null
}

export interface CreateOrganizationInput {
  id: string
  slug: string
  name: string
  organizationType: string
  description?: string
  websiteUrl?: string
  country?: string
  region?: string
  visibility: 'PRIVATE' | 'PUBLIC'
}

export interface OrganizationsRepository {
  findById(client: PrismaTransactionClient, organizationId: string): Promise<OrganizationRow | null>
  findBySlug(client: PrismaTransactionClient, slug: string): Promise<OrganizationRow | null>
  isSlugTaken(client: PrismaTransactionClient, slug: string): Promise<boolean>
  /**
   * Cross-tenant listing for platform administration. Must be called inside
   * `withPlatformAccess`, never `withTenant` — no single organization_id
   * applies to a listing that spans every tenant.
   */
  listAllForPlatform(
    client: PrismaTransactionClient,
    status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | undefined,
    page: PageRequest,
  ): Promise<Page<OrganizationRow>>
  create(client: PrismaTransactionClient, input: CreateOrganizationInput): Promise<OrganizationRow>
  getSettings(
    client: PrismaTransactionClient,
    organizationId: string,
  ): Promise<OrganizationSettingsRow | null>
  updateProfile(
    client: PrismaTransactionClient,
    organizationId: string,
    patch: Partial<
      Pick<
        OrganizationRow,
        'name' | 'description' | 'websiteUrl' | 'country' | 'region' | 'logoAssetId'
      >
    >,
  ): Promise<void>
  updateSettings(
    client: PrismaTransactionClient,
    organizationId: string,
    patch: Partial<Omit<OrganizationSettingsRow, 'organizationId'>>,
  ): Promise<void>
  updateVisibility(
    client: PrismaTransactionClient,
    organizationId: string,
    visibility: 'PRIVATE' | 'PUBLIC',
  ): Promise<void>
  setStatus(
    client: PrismaTransactionClient,
    organizationId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED',
    fields: { suspendedReason?: string | null },
  ): Promise<void>
}

export function createOrganizationsRepository(): OrganizationsRepository {
  return {
    async findById(client, organizationId) {
      return client.organization.findUnique({ where: { id: organizationId } })
    },

    async findBySlug(client, slug) {
      // Matches the database's case-insensitive functional unique index.
      return client.organization.findFirst({
        where: { slug: { equals: slug, mode: 'insensitive' } },
      })
    },

    async isSlugTaken(client, slug) {
      const rows = await client.$queryRaw<{ taken: boolean }[]>`
        select app_organization_slug_taken(${slug}) as taken
      `
      return rows[0]?.taken ?? false
    },

    async listAllForPlatform(client, status, page) {
      const rows = await client.organization.findMany({
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

    async create(client, input) {
      return client.organization.create({
        data: {
          id: input.id,
          slug: input.slug,
          name: input.name,
          organizationType: input.organizationType,
          description: input.description,
          websiteUrl: input.websiteUrl,
          country: input.country,
          region: input.region,
          visibility: input.visibility,
          status: 'ACTIVE',
          settings: {
            create: {
              joinPolicy: 'INVITE_ONLY',
              allowedEmailDomains: [],
            },
          },
        },
      })
    },

    async getSettings(client, organizationId) {
      const row = await client.organizationSettings.findUnique({ where: { organizationId } })
      if (row === null) return null

      // The database CHECK constraint (organization_join_policy_open_not_
      // activatable_chk) guarantees join_policy is never 'OPEN'; narrowing
      // the type here keeps that guarantee visible to callers instead of
      // leaking Prisma's full enum, which includes the reserved value.
      if (row.joinPolicy === 'OPEN') {
        throw new Error('Invariant violated: organization_settings.join_policy was OPEN.')
      }

      return { ...row, joinPolicy: row.joinPolicy }
    },

    async updateProfile(client, organizationId, patch) {
      await client.organization.update({ where: { id: organizationId }, data: patch })
    },

    async updateSettings(client, organizationId, patch) {
      await client.organizationSettings.update({ where: { organizationId }, data: patch })
    },

    async updateVisibility(client, organizationId, visibility) {
      await client.organization.update({ where: { id: organizationId }, data: { visibility } })
    },

    async setStatus(client, organizationId, status, fields) {
      await client.organization.update({
        where: { id: organizationId },
        data: {
          status,
          ...(status === 'SUSPENDED'
            ? { suspendedAt: new Date(), suspendedReason: fields.suspendedReason ?? null }
            : {}),
          ...(status === 'ACTIVE' ? { suspendedAt: null, suspendedReason: null } : {}),
          ...(status === 'ARCHIVED' ? { archivedAt: new Date() } : {}),
        },
      })
    },
  }
}

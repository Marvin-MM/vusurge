import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export type FormPurpose =
  | 'ORGANIZATION_JOIN_REQUEST'
  | 'CHALLENGE_PARTICIPATION'
  | 'MENTOR_JUDGE_APPLICATION'
  | 'POST_EVENT_SURVEY'
  | 'PORTFOLIO_STAGE_GATE'

export interface FormDefinitionRow {
  id: string
  organizationId: string
  purpose: FormPurpose
  challengeId: string | null
  name: string
  createdByUserId: string
  createdAt: Date
}

export interface FormVersionRow {
  id: string
  organizationId: string
  formDefinitionId: string
  challengeId: string | null
  version: number
  schema: unknown
  isPublished: boolean
  publishedAt: Date | null
  createdByUserId: string
  createdAt: Date
}

export interface FormResponseRow {
  id: string
  organizationId: string
  formVersionId: string
  challengeId: string | null
  userId: string
  responseData: unknown
  isDraft: boolean
  submittedAt: Date
  updatedAt: Date
}

export interface FormsRepository {
  createDefinition(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      purpose: FormPurpose
      challengeId?: string
      name: string
      createdByUserId: string
    },
  ): Promise<FormDefinitionRow>
  findDefinitionById(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<FormDefinitionRow | null>
  updateDefinitionName(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    name: string,
  ): Promise<void>
  findDefinitionByChallenge(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    purpose: FormPurpose,
  ): Promise<FormDefinitionRow | null>
  listDefinitions(
    client: PrismaTransactionClient,
    organizationId: string,
    filters: { purpose?: FormPurpose; challengeId?: string },
    page: PageRequest,
  ): Promise<Page<FormDefinitionRow>>

  createVersion(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      formDefinitionId: string
      challengeId?: string
      schema: unknown
      createdByUserId: string
    },
  ): Promise<FormVersionRow>
  listVersions(
    client: PrismaTransactionClient,
    organizationId: string,
    formDefinitionId: string,
  ): Promise<FormVersionRow[]>
  findVersionById(
    client: PrismaTransactionClient,
    organizationId: string,
    versionId: string,
  ): Promise<FormVersionRow | null>
  findPublishedVersion(
    client: PrismaTransactionClient,
    organizationId: string,
    formDefinitionId: string,
  ): Promise<FormVersionRow | null>
  unpublishAllVersions(
    client: PrismaTransactionClient,
    organizationId: string,
    formDefinitionId: string,
  ): Promise<void>
  publishVersion(
    client: PrismaTransactionClient,
    organizationId: string,
    versionId: string,
  ): Promise<void>

  createResponse(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      formVersionId: string
      challengeId?: string
      userId: string
      responseData: unknown
    },
  ): Promise<FormResponseRow>
  saveParticipationDraft(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      formVersionId: string
      challengeId: string
      userId: string
      responseData: unknown
      savedAt: Date
    },
  ): Promise<FormResponseRow>
  submitParticipationDraft(
    client: PrismaTransactionClient,
    input: {
      organizationId: string
      formVersionId: string
      challengeId: string
      userId: string
      responseData: unknown
      submittedAt: Date
    },
  ): Promise<FormResponseRow | null>
  findLatestResponse(
    client: PrismaTransactionClient,
    organizationId: string,
    formVersionId: string,
    userId: string,
  ): Promise<FormResponseRow | null>
  findResponseById(
    client: PrismaTransactionClient,
    organizationId: string,
    responseId: string,
  ): Promise<FormResponseRow | null>
  listResponses(
    client: PrismaTransactionClient,
    organizationId: string,
    formVersionId: string,
    page: PageRequest,
  ): Promise<Page<FormResponseRow>>
}

export function createFormsRepository(): FormsRepository {
  return {
    async createDefinition(client, input) {
      return client.formDefinition.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          purpose: input.purpose,
          challengeId: input.challengeId,
          name: input.name,
          createdByUserId: input.createdByUserId,
        },
      })
    },

    async findDefinitionById(client, organizationId, id) {
      return client.formDefinition.findFirst({ where: { id, organizationId } })
    },

    async updateDefinitionName(client, organizationId, id, name) {
      await client.formDefinition.updateMany({ where: { id, organizationId }, data: { name } })
    },

    async findDefinitionByChallenge(client, organizationId, challengeId, purpose) {
      return client.formDefinition.findFirst({
        where: { organizationId, challengeId, purpose },
        orderBy: { createdAt: 'desc' },
      })
    },

    async listDefinitions(client, organizationId, filters, page) {
      const rows = await client.formDefinition.findMany({
        where: {
          organizationId,
          ...(filters.purpose ? { purpose: filters.purpose } : {}),
          ...(filters.challengeId ? { challengeId: filters.challengeId } : {}),
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

    async createVersion(client, input) {
      const latest = await client.formVersion.findFirst({
        where: { organizationId: input.organizationId, formDefinitionId: input.formDefinitionId },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      return client.formVersion.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          formDefinitionId: input.formDefinitionId,
          challengeId: input.challengeId,
          version: (latest?.version ?? 0) + 1,
          schema: input.schema as never,
          createdByUserId: input.createdByUserId,
        },
      })
    },

    async listVersions(client, organizationId, formDefinitionId) {
      return client.formVersion.findMany({
        where: { organizationId, formDefinitionId },
        orderBy: { version: 'desc' },
      })
    },

    async findVersionById(client, organizationId, versionId) {
      return client.formVersion.findFirst({ where: { id: versionId, organizationId } })
    },

    async findPublishedVersion(client, organizationId, formDefinitionId) {
      return client.formVersion.findFirst({
        where: { organizationId, formDefinitionId, isPublished: true },
      })
    },

    async unpublishAllVersions(client, organizationId, formDefinitionId) {
      await client.formVersion.updateMany({
        where: { organizationId, formDefinitionId, isPublished: true },
        data: { isPublished: false },
      })
    },

    async publishVersion(client, organizationId, versionId) {
      await client.formVersion.updateMany({
        where: { id: versionId, organizationId },
        data: { isPublished: true, publishedAt: new Date() },
      })
    },

    async createResponse(client, input) {
      return client.formResponse.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          formVersionId: input.formVersionId,
          challengeId: input.challengeId,
          userId: input.userId,
          responseData: input.responseData as never,
        },
      })
    },

    async saveParticipationDraft(client, input) {
      const existing = await client.formResponse.findFirst({
        where: {
          organizationId: input.organizationId,
          formVersionId: input.formVersionId,
          challengeId: input.challengeId,
          userId: input.userId,
          isDraft: true,
        },
      })
      if (existing !== null) {
        return client.formResponse.update({
          where: { id: existing.id },
          data: { responseData: input.responseData as never, updatedAt: input.savedAt },
        })
      }
      return client.formResponse.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          formVersionId: input.formVersionId,
          challengeId: input.challengeId,
          userId: input.userId,
          responseData: input.responseData as never,
          isDraft: true,
          submittedAt: input.savedAt,
          updatedAt: input.savedAt,
        },
      })
    },

    async submitParticipationDraft(client, input) {
      const draft = await client.formResponse.findFirst({
        where: {
          organizationId: input.organizationId,
          formVersionId: input.formVersionId,
          challengeId: input.challengeId,
          userId: input.userId,
          isDraft: true,
        },
      })
      if (draft === null) return null
      return client.formResponse.update({
        where: { id: draft.id },
        data: {
          responseData: input.responseData as never,
          isDraft: false,
          submittedAt: input.submittedAt,
          updatedAt: input.submittedAt,
        },
      })
    },

    async findLatestResponse(client, organizationId, formVersionId, userId) {
      return client.formResponse.findFirst({
        where: { organizationId, formVersionId, userId, isDraft: false },
        orderBy: { submittedAt: 'desc' },
      })
    },

    async findResponseById(client, organizationId, responseId) {
      return client.formResponse.findFirst({ where: { id: responseId, organizationId } })
    },

    async listResponses(client, organizationId, formVersionId, page) {
      const rows = await client.formResponse.findMany({
        where: {
          organizationId,
          formVersionId,
          isDraft: false,
          ...(page.cursor
            ? {
                OR: [
                  { submittedAt: { lt: new Date(page.cursor.at) } },
                  { submittedAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })
      return buildPage(rows, page, (row) => ({ at: row.submittedAt.toISOString(), id: row.id }))
    },
  }
}

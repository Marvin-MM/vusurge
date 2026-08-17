import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { Page } from '../../shared/http'
import type {
  FormDefinitionRow,
  FormPurpose,
  FormResponseRow,
  FormVersionRow,
} from './forms.repository'
import type { FormsService } from './forms.service'

function serializeDefinition(row: FormDefinitionRow) {
  return {
    id: row.id,
    purpose: row.purpose,
    challengeId: row.challengeId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeDefinitionPage(page: Page<FormDefinitionRow>) {
  return {
    items: page.items.map(serializeDefinition),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

function serializeVersion(row: FormVersionRow) {
  return {
    id: row.id,
    formDefinitionId: row.formDefinitionId,
    version: row.version,
    schema: row.schema,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeResponse(row: FormResponseRow) {
  return {
    id: row.id,
    formVersionId: row.formVersionId,
    userId: row.userId,
    responseData: row.responseData,
    submittedAt: row.submittedAt.toISOString(),
  }
}

function serializeResponsePage(page: Page<FormResponseRow>) {
  return {
    items: page.items.map(serializeResponse),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

export function createFormsController(service: FormsService) {
  return {
    async createDefinition(
      access: AccessContext,
      organizationId: string,
      input: { purpose: FormPurpose; challengeId?: string; name: string },
    ) {
      requireActor(access)
      const row = await service.createDefinition(access, organizationId, input)
      return serializeDefinition(row)
    },

    async getDefinition(access: AccessContext, organizationId: string, formDefinitionId: string) {
      requireActor(access)
      const row = await service.getDefinition(access, organizationId, formDefinitionId)
      return serializeDefinition(row)
    },

    async updateDefinition(
      access: AccessContext,
      organizationId: string,
      formDefinitionId: string,
      patch: { name: string },
    ) {
      requireActor(access)
      const row = await service.updateDefinition(access, organizationId, formDefinitionId, patch)
      return serializeDefinition(row)
    },

    async listDefinitions(
      access: AccessContext,
      organizationId: string,
      filters: { purpose?: FormPurpose; challengeId?: string },
      query: { limit?: number; cursor?: string },
    ) {
      requireActor(access)
      const page = await service.listDefinitions(access, organizationId, filters, query)
      return serializeDefinitionPage(page)
    },

    async createVersion(
      access: AccessContext,
      organizationId: string,
      formDefinitionId: string,
      schema: unknown,
    ) {
      requireActor(access)
      const row = await service.createVersion(access, organizationId, formDefinitionId, schema)
      return serializeVersion(row)
    },

    async listVersions(access: AccessContext, organizationId: string, formDefinitionId: string) {
      requireActor(access)
      const rows = await service.listVersions(access, organizationId, formDefinitionId)
      return rows.map(serializeVersion)
    },

    async getVersion(
      access: AccessContext,
      organizationId: string,
      formDefinitionId: string,
      versionId: string,
    ) {
      requireActor(access)
      const row = await service.getVersion(access, organizationId, formDefinitionId, versionId)
      return serializeVersion(row)
    },

    async publishVersion(
      access: AccessContext,
      organizationId: string,
      formDefinitionId: string,
      versionId: string,
    ) {
      requireActor(access)
      const row = await service.publishVersion(access, organizationId, formDefinitionId, versionId)
      return serializeVersion(row)
    },

    async submitResponse(
      access: AccessContext,
      organizationId: string,
      formDefinitionId: string,
      responseData: Record<string, unknown>,
    ) {
      requireActor(access)
      const row = await service.submitResponse(
        access,
        organizationId,
        formDefinitionId,
        responseData,
      )
      return serializeResponse(row)
    },

    async listResponses(
      access: AccessContext,
      organizationId: string,
      formDefinitionId: string,
      query: { limit?: number; cursor?: string },
    ) {
      requireActor(access)
      const page = await service.listResponses(access, organizationId, formDefinitionId, query)
      return serializeResponsePage(page)
    },
  }
}

export type FormsController = ReturnType<typeof createFormsController>

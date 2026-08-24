import Ajv, { type JSONSchemaType, type ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission } from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { badRequest, conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import { type Page, type PaginationLimits, toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import type {
  FormDefinitionRow,
  FormPurpose,
  FormResponseRow,
  FormResponseWithRespondentRow,
  FormsRepository,
  FormVersionRow,
} from './forms.repository'

/**
 * The fixed field-type catalogue from master prompt section 11. No scripts,
 * no arbitrary HTML, no eval-like expressions, no custom JS validators, no
 * workflow DSL — every organizer-defined form is built exclusively from these
 * closed shapes, so the field list itself can be safely turned into a JSON
 * Schema and validated with AJV, with no code ever executed on our behalf.
 */
const FIELD_TYPES = [
  'SHORT_TEXT',
  'LONG_TEXT',
  'NUMBER',
  'BOOLEAN',
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'URL',
  'DATE',
  'CONSENT',
  'FILE_REF',
] as const
type FieldType = (typeof FIELD_TYPES)[number]

const UPLOAD_PURPOSES = ['FORM_ATTACHMENT'] as const

interface FieldDefinition {
  key: string
  type: FieldType
  label: string
  required: boolean
  helpText?: string
  maxLength?: number
  min?: number
  max?: number
  options?: string[]
  maxSelections?: number
  uploadPurpose?: (typeof UPLOAD_PURPOSES)[number]
}

interface FormSchema {
  fields: FieldDefinition[]
}

const ajv = new Ajv({ allErrors: true, strict: true })
addFormats(ajv)

const fieldMetaSchema: JSONSchemaType<FieldDefinition> = {
  type: 'object',
  additionalProperties: false,
  required: ['key', 'type', 'label', 'required'],
  properties: {
    key: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9_]{0,63}$' },
    type: { type: 'string', enum: FIELD_TYPES },
    label: { type: 'string', minLength: 1, maxLength: 200 },
    required: { type: 'boolean' },
    helpText: { type: 'string', maxLength: 1000, nullable: true },
    maxLength: { type: 'integer', minimum: 1, maximum: 20_000, nullable: true },
    min: { type: 'number', nullable: true },
    max: { type: 'number', nullable: true },
    options: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 200 },
      minItems: 1,
      maxItems: 50,
      nullable: true,
    },
    maxSelections: { type: 'integer', minimum: 1, nullable: true },
    uploadPurpose: { type: 'string', enum: UPLOAD_PURPOSES, nullable: true },
  },
}

const formMetaSchema: JSONSchemaType<FormSchema> = {
  type: 'object',
  additionalProperties: false,
  required: ['fields'],
  properties: {
    fields: {
      type: 'array',
      minItems: 1,
      maxItems: 50,
      items: fieldMetaSchema,
    },
  },
}

const validateFormMetaSchema = ajv.compile(formMetaSchema)

/**
 * Structural rules AJV's shape-only validation cannot express (per-type
 * required properties): select types must carry options, FILE_REF must carry
 * an upload purpose, keys must be unique within the form.
 */
function validateFieldInvariants(schema: FormSchema): string | null {
  const seenKeys = new Set<string>()
  for (const field of schema.fields) {
    if (seenKeys.has(field.key)) {
      return `Duplicate field key "${field.key}".`
    }
    seenKeys.add(field.key)

    if ((field.type === 'SINGLE_SELECT' || field.type === 'MULTI_SELECT') && !field.options) {
      return `Field "${field.key}" of type ${field.type} requires options.`
    }
    if (field.type === 'FILE_REF' && !field.uploadPurpose) {
      return `Field "${field.key}" of type FILE_REF requires an uploadPurpose.`
    }
  }
  return null
}

function fieldToJsonSchema(field: FieldDefinition): Record<string, unknown> {
  switch (field.type) {
    case 'SHORT_TEXT':
      return { type: 'string', minLength: 1, maxLength: field.maxLength ?? 200 }
    case 'LONG_TEXT':
      return { type: 'string', minLength: 1, maxLength: field.maxLength ?? 10_000 }
    case 'NUMBER':
      return {
        type: 'number',
        ...(field.min !== undefined ? { minimum: field.min } : {}),
        ...(field.max !== undefined ? { maximum: field.max } : {}),
      }
    case 'BOOLEAN':
      return { type: 'boolean' }
    case 'SINGLE_SELECT':
      return { type: 'string', enum: field.options ?? [] }
    case 'MULTI_SELECT':
      return {
        type: 'array',
        items: { type: 'string', enum: field.options ?? [] },
        uniqueItems: true,
        minItems: field.required ? 1 : 0,
        maxItems: field.maxSelections ?? field.options?.length ?? 50,
      }
    case 'URL':
      return { type: 'string', format: 'uri', maxLength: 2048 }
    case 'DATE':
      return { type: 'string', format: 'date' }
    case 'CONSENT':
      return field.required ? { const: true } : { type: 'boolean' }
    case 'FILE_REF':
      return { type: 'string', format: 'uuid' }
  }
}

function compileResponseValidator(schema: FormSchema): ValidateFunction {
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const field of schema.fields) {
    properties[field.key] = fieldToJsonSchema(field)
    if (field.required) required.push(field.key)
  }
  return ajv.compile({
    type: 'object',
    additionalProperties: false,
    required,
    properties,
  })
}

/**
 * Validates response data against a published form version's schema,
 * without the authorization or persistence `submitResponse` also does.
 *
 * Exists for callers whose own authorization is already correct for the
 * caller (e.g. participation registration for an OPEN_AUTHENTICATED
 * challenge, where the responder is often not an organization member and
 * would be wrongly rejected by `submitResponse`'s own
 * `Permission.OrganizationViewPrivate` check) but still need the same
 * closed-field-type validation this module owns — never re-implemented
 * against a second AJV instance elsewhere.
 */
export function validateFormResponseData(
  schema: unknown,
  data: unknown,
): { valid: true } | { valid: false; errorText: string } {
  const validate = compileResponseValidator(schema as FormSchema)
  if (validate(data)) return { valid: true }
  return { valid: false, errorText: ajv.errorsText(validate.errors, { separator: '; ' }) }
}

export interface FormsService {
  createDefinition(
    access: AccessContext,
    organizationId: string,
    input: { purpose: FormPurpose; challengeId?: string; name: string },
  ): Promise<FormDefinitionRow>
  getDefinition(
    access: AccessContext,
    organizationId: string,
    formDefinitionId: string,
  ): Promise<FormDefinitionRow>
  updateDefinition(
    access: AccessContext,
    organizationId: string,
    formDefinitionId: string,
    patch: { name: string },
  ): Promise<FormDefinitionRow>
  listDefinitions(
    access: AccessContext,
    organizationId: string,
    filters: { purpose?: FormPurpose; challengeId?: string },
    query: { limit?: number; cursor?: string },
  ): Promise<Page<FormDefinitionRow>>

  createVersion(
    access: AccessContext,
    organizationId: string,
    formDefinitionId: string,
    schema: unknown,
  ): Promise<FormVersionRow>
  listVersions(
    access: AccessContext,
    organizationId: string,
    formDefinitionId: string,
  ): Promise<FormVersionRow[]>
  getVersion(
    access: AccessContext,
    organizationId: string,
    formDefinitionId: string,
    versionId: string,
  ): Promise<FormVersionRow>
  publishVersion(
    access: AccessContext,
    organizationId: string,
    formDefinitionId: string,
    versionId: string,
  ): Promise<FormVersionRow>

  submitResponse(
    access: AccessContext,
    organizationId: string,
    formDefinitionId: string,
    responseData: Record<string, unknown>,
  ): Promise<FormResponseRow>
  listResponses(
    access: AccessContext,
    organizationId: string,
    formDefinitionId: string,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<FormResponseWithRespondentRow>>
}

export function createFormsService(
  repository: FormsRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  paginationLimits: PaginationLimits,
): FormsService {
  return {
    async createDefinition(access, organizationId, input) {
      authorize(access, Permission.OrganizationManageForms)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const definition = await repository.createDefinition(tx, {
            id: newId(),
            organizationId,
            purpose: input.purpose,
            challengeId: input.challengeId,
            name: input.name,
            createdByUserId: actorUserId,
          })
          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.FormCreated,
            resourceType: 'form_definition',
            resourceId: definition.id,
            summary: `Created form "${definition.name}".`,
          })
          return definition
        },
        { actorUserId },
      )
    },

    async getDefinition(access, organizationId, formDefinitionId) {
      authorize(access, Permission.OrganizationViewPrivate)
      return transactions.withTenant(organizationId, async (tx) => {
        const definition = await repository.findDefinitionById(tx, organizationId, formDefinitionId)
        if (definition === null) throw notFound('Form not found.')
        return definition
      })
    },

    async updateDefinition(access, organizationId, formDefinitionId, patch) {
      authorize(access, Permission.OrganizationManageForms)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const existing = await repository.findDefinitionById(tx, organizationId, formDefinitionId)
          if (existing === null) throw notFound('Form not found.')

          await repository.updateDefinitionName(tx, organizationId, formDefinitionId, patch.name)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.FormUpdated,
            resourceType: 'form_definition',
            resourceId: formDefinitionId,
            summary: `Renamed form "${existing.name}" to "${patch.name}".`,
          })

          const updated = await repository.findDefinitionById(tx, organizationId, formDefinitionId)
          if (updated === null) throw notFound('Form not found.')
          return updated
        },
        { actorUserId },
      )
    },

    async listDefinitions(access, organizationId, filters, query) {
      authorize(access, Permission.OrganizationViewPrivate)
      const page = toPageRequest(query, paginationLimits)
      return transactions.withTenant(organizationId, (tx) =>
        repository.listDefinitions(tx, organizationId, filters, page),
      )
    },

    async createVersion(access, organizationId, formDefinitionId, schema) {
      authorize(access, Permission.OrganizationManageForms)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      if (!validateFormMetaSchema(schema)) {
        const detail = ajv.errorsText(validateFormMetaSchema.errors, { separator: '; ' })
        throw badRequest(`Invalid form schema: ${detail}`)
      }
      const invariantError = validateFieldInvariants(schema)
      if (invariantError !== null) {
        throw badRequest(`Invalid form schema: ${invariantError}`)
      }

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const definition = await repository.findDefinitionById(
            tx,
            organizationId,
            formDefinitionId,
          )
          if (definition === null) throw notFound('Form not found.')

          const version = await repository.createVersion(tx, {
            id: newId(),
            organizationId,
            formDefinitionId,
            challengeId: definition.challengeId ?? undefined,
            schema,
            createdByUserId: actorUserId,
          })
          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.FormVersionCreated,
            resourceType: 'form_version',
            resourceId: version.id,
            summary: `Created form version ${version.version} for "${definition.name}".`,
          })
          return version
        },
        { actorUserId },
      )
    },

    async listVersions(access, organizationId, formDefinitionId) {
      authorize(access, Permission.OrganizationViewPrivate)
      return transactions.withTenant(organizationId, async (tx) => {
        const definition = await repository.findDefinitionById(tx, organizationId, formDefinitionId)
        if (definition === null) throw notFound('Form not found.')
        return repository.listVersions(tx, organizationId, formDefinitionId)
      })
    },

    async getVersion(access, organizationId, formDefinitionId, versionId) {
      authorize(access, Permission.OrganizationViewPrivate)
      return transactions.withTenant(organizationId, async (tx) => {
        const definition = await repository.findDefinitionById(tx, organizationId, formDefinitionId)
        if (definition === null) throw notFound('Form not found.')
        const version = await repository.findVersionById(tx, organizationId, versionId)
        if (version === null || version.formDefinitionId !== formDefinitionId) {
          throw notFound('Form version not found.')
        }
        return version
      })
    },

    async publishVersion(access, organizationId, formDefinitionId, versionId) {
      authorize(access, Permission.OrganizationManageForms)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const definition = await repository.findDefinitionById(
            tx,
            organizationId,
            formDefinitionId,
          )
          if (definition === null) throw notFound('Form not found.')

          const version = await repository.findVersionById(tx, organizationId, versionId)
          if (version === null || version.formDefinitionId !== formDefinitionId) {
            throw notFound('Form version not found.')
          }
          if (version.isPublished) return version

          await repository.unpublishAllVersions(tx, organizationId, formDefinitionId)
          await repository.publishVersion(tx, organizationId, versionId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.FormVersionPublished,
            resourceType: 'form_version',
            resourceId: versionId,
            summary: `Published form version ${version.version} for "${definition.name}".`,
          })

          const after = await repository.findVersionById(tx, organizationId, versionId)
          if (after === null) throw notFound('Form version not found.')
          return after
        },
        { actorUserId },
      )
    },

    async submitResponse(access, organizationId, formDefinitionId, responseData) {
      authorize(access, Permission.OrganizationViewPrivate)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const definition = await repository.findDefinitionById(
            tx,
            organizationId,
            formDefinitionId,
          )
          if (definition === null) throw notFound('Form not found.')

          const version = await repository.findPublishedVersion(
            tx,
            organizationId,
            formDefinitionId,
          )
          if (version === null) {
            throw conflict(ErrorCode.CONFLICT, 'This form has no published version to respond to.')
          }

          const validate = compileResponseValidator(version.schema as FormSchema)
          if (!validate(responseData)) {
            const detail = ajv.errorsText(validate.errors, { separator: '; ' })
            throw badRequest(`Invalid form response: ${detail}`)
          }

          const response = await repository.createResponse(tx, {
            id: newId(),
            organizationId,
            formVersionId: version.id,
            challengeId: version.challengeId ?? undefined,
            userId: actorUserId,
            responseData,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.FormResponseSubmitted,
            resourceType: 'form_response',
            resourceId: response.id,
            summary: `Submitted a response to "${definition.name}".`,
          })

          return response
        },
        { actorUserId },
      )
    },

    async listResponses(access, organizationId, formDefinitionId, query) {
      authorize(access, Permission.OrganizationManageForms)
      const page = toPageRequest(query, paginationLimits)

      return transactions.withTenant(organizationId, async (tx) => {
        const definition = await repository.findDefinitionById(tx, organizationId, formDefinitionId)
        if (definition === null) throw notFound('Form not found.')

        const version = await repository.findPublishedVersion(tx, organizationId, formDefinitionId)
        if (version === null) {
          return { items: [], hasMore: false, nextCursor: null }
        }
        return repository.listResponses(tx, organizationId, version.id, page)
      })
    },
  }
}

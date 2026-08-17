import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { FormsController } from './forms.controller'
import {
  CreateFormDefinitionBody,
  CreateFormVersionBody,
  FormDefinitionListQuery,
  FormDefinitionListResponse,
  FormDefinitionResponse,
  FormResponseListResponse,
  FormResponseResponse,
  FormVersionListResponse,
  FormVersionResponse,
  SubmitFormResponseBody,
  UpdateFormDefinitionBody,
} from './forms.dto'

export function formsRoutes(controller: FormsController, auth: AuthPlugin) {
  return new Elysia({ name: 'forms-routes' })
    .use(auth)
    .post(
      '/organizations/:organizationId/forms',
      async ({ access, params, body, set }) => {
        const result = await controller.createDefinition(access, params.organizationId, body)
        set.status = 201
        return result
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        body: CreateFormDefinitionBody,
        response: { 201: FormDefinitionResponse, ...CommonErrorResponses },
        detail: { tags: ['Forms'], summary: 'Create a form definition' },
      },
    )
    .get(
      '/organizations/:organizationId/forms',
      ({ access, params, query }) =>
        controller.listDefinitions(
          access,
          params.organizationId,
          { purpose: query.purpose, challengeId: query.challengeId },
          query,
        ),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        query: FormDefinitionListQuery,
        response: { 200: FormDefinitionListResponse, ...CommonErrorResponses },
        detail: { tags: ['Forms'], summary: 'List form definitions' },
      },
    )
    .get(
      '/organizations/:organizationId/forms/:formId',
      ({ access, params }) =>
        controller.getDefinition(access, params.organizationId, params.formId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, formId: Uuid }),
        response: { 200: FormDefinitionResponse, ...CommonErrorResponses },
        detail: { tags: ['Forms'], summary: 'Get a form definition' },
      },
    )
    .patch(
      '/organizations/:organizationId/forms/:formId',
      ({ access, params, body }) =>
        controller.updateDefinition(access, params.organizationId, params.formId, body),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, formId: Uuid }),
        body: UpdateFormDefinitionBody,
        response: { 200: FormDefinitionResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Forms'],
          summary: 'Rename a form definition',
          description: 'Metadata-only. Purpose and challenge linkage are immutable once created.',
        },
      },
    )
    .post(
      '/organizations/:organizationId/forms/:formId/versions',
      async ({ access, params, body, set }) => {
        const result = await controller.createVersion(
          access,
          params.organizationId,
          params.formId,
          body.schema,
        )
        set.status = 201
        return result
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, formId: Uuid }),
        body: CreateFormVersionBody,
        response: { 201: FormVersionResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Forms'],
          summary: 'Create a new form version',
          description:
            'The field schema is validated against the fixed field-type catalogue. Immutable ' +
            'once created; creating a version does not publish it.',
        },
      },
    )
    .get(
      '/organizations/:organizationId/forms/:formId/versions',
      ({ access, params }) => controller.listVersions(access, params.organizationId, params.formId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, formId: Uuid }),
        response: { 200: FormVersionListResponse, ...CommonErrorResponses },
        detail: { tags: ['Forms'], summary: 'List form versions' },
      },
    )
    .get(
      '/organizations/:organizationId/forms/:formId/versions/:versionId',
      ({ access, params }) =>
        controller.getVersion(access, params.organizationId, params.formId, params.versionId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, formId: Uuid, versionId: Uuid }),
        response: { 200: FormVersionResponse, ...CommonErrorResponses },
        detail: { tags: ['Forms'], summary: 'Get a single form version' },
      },
    )
    .post(
      '/organizations/:organizationId/forms/:formId/versions/:versionId/publish',
      ({ access, params }) =>
        controller.publishVersion(access, params.organizationId, params.formId, params.versionId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, formId: Uuid, versionId: Uuid }),
        response: { 200: FormVersionResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Forms'],
          summary: 'Publish a form version',
          description: 'Unpublishes any previously published version of the same form first.',
        },
      },
    )
    .post(
      '/organizations/:organizationId/forms/:formId/responses',
      async ({ access, params, body, set }) => {
        const result = await controller.submitResponse(
          access,
          params.organizationId,
          params.formId,
          body.responseData,
        )
        set.status = 201
        return result
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, formId: Uuid }),
        body: SubmitFormResponseBody,
        response: { 201: FormResponseResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Forms'],
          summary: 'Submit a form response',
          description: 'Validated against the currently published version of the form.',
        },
      },
    )
    .get(
      '/organizations/:organizationId/forms/:formId/responses',
      ({ access, params, query }) =>
        controller.listResponses(access, params.organizationId, params.formId, query),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, formId: Uuid }),
        query: t.Object({ limit: t.Optional(t.Integer()), cursor: t.Optional(t.String()) }),
        response: { 200: FormResponseListResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Forms'],
          summary: 'List responses to a form',
          description: 'Organizer-only: lists responses to the currently published version.',
        },
      },
    )
}

import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, IdempotencyKey, PaginationQuery, Uuid } from '../../shared/http'
import type { OrganizationApplicationsController } from './organization-applications.controller'
import {
  ApplicationListQuery,
  ApplicationListResponse,
  ApplicationResponse,
  ApproveApplicationBody,
  CreateApplicationBody,
  RejectApplicationBody,
  UpdateApplicationBody,
} from './organization-applications.dto'

export function organizationApplicationsRoutes(
  controller: OrganizationApplicationsController,
  auth: AuthPlugin,
) {
  return (
    new Elysia({ name: 'organization-applications-routes' })
      .use(auth)
      .post(
        '/organization-applications',
        async ({ access, body, headers, set }) => {
          const result = await controller.create(access, body, headers['idempotency-key'])
          set.status = result.status
          return result.body
        },
        {
          requireAuth: true,
          body: CreateApplicationBody,
          headers: t.Object({ 'idempotency-key': IdempotencyKey }),
          response: { 201: ApplicationResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Organization Applications'],
            summary: 'Submit an organization application',
            description: 'Requires a verified email and an Idempotency-Key header.',
          },
        },
      )
      .get(
        '/me/organization-applications',
        ({ access, query }) => controller.listMine(access, query),
        {
          requireAuth: true,
          query: PaginationQuery,
          response: { 200: ApplicationListResponse, ...CommonErrorResponses },
          detail: { tags: ['Organization Applications'], summary: "The caller's own applications" },
        },
      )
      .get(
        '/organization-applications/:applicationId',
        ({ access, params }) => controller.get(access, params.applicationId),
        {
          requireAuth: true,
          params: t.Object({ applicationId: Uuid }),
          response: { 200: ApplicationResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Organization Applications'],
            summary: 'Get an application',
            description: 'Only the applicant or platform-authorized staff may view it.',
          },
        },
      )
      .patch(
        '/organization-applications/:applicationId',
        ({ access, params, body }) => controller.update(access, params.applicationId, body),
        {
          requireAuth: true,
          params: t.Object({ applicationId: Uuid }),
          body: UpdateApplicationBody,
          response: { 200: ApplicationResponse, ...CommonErrorResponses },
          detail: { tags: ['Organization Applications'], summary: 'Edit a pending application' },
        },
      )
      .post(
        '/organization-applications/:applicationId/resubmit',
        ({ access, params, body }) => controller.resubmit(access, params.applicationId, body),
        {
          requireAuth: true,
          params: t.Object({ applicationId: Uuid }),
          body: UpdateApplicationBody,
          response: { 200: ApplicationResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Organization Applications'],
            summary: 'Resubmit a rejected application',
          },
        },
      )
      // --- Platform surface ----------------------------------------------
      .get(
        '/platform/organization-applications',
        ({ access, query }) => controller.listForPlatform(access, query.status, query),
        {
          requireAuth: true,
          query: ApplicationListQuery,
          response: { 200: ApplicationListResponse, ...CommonErrorResponses },
          detail: { tags: ['Platform'], summary: 'List organization applications for review' },
        },
      )
      .get(
        '/platform/organization-applications/:applicationId',
        ({ access, params }) => controller.getForPlatform(access, params.applicationId),
        {
          requireAuth: true,
          params: t.Object({ applicationId: Uuid }),
          response: { 200: ApplicationResponse, ...CommonErrorResponses },
          detail: { tags: ['Platform'], summary: 'Get an application for review' },
        },
      )
      .post(
        '/platform/organization-applications/:applicationId/approve',
        ({ access, params, body }) => controller.approve(access, params.applicationId, body.notes),
        {
          requireAuth: true,
          params: t.Object({ applicationId: Uuid }),
          body: ApproveApplicationBody,
          response: {
            200: t.Object({ organizationId: Uuid, organizationSlug: t.String() }),
            ...CommonErrorResponses,
          },
          detail: {
            tags: ['Platform'],
            summary: 'Approve an organization application',
            description:
              'Creates and activates the organization, grants the applicant ORG_OWNER, and ' +
              'requires a fresh session.',
          },
        },
      )
      .post(
        '/platform/organization-applications/:applicationId/reject',
        async ({ access, params, body, set }) => {
          await controller.reject(access, params.applicationId, body.reason, body.internalNotes)
          set.status = 204
        },
        {
          requireAuth: true,
          params: t.Object({ applicationId: Uuid }),
          body: RejectApplicationBody,
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: {
            tags: ['Platform'],
            summary: 'Reject an organization application',
            description: 'Requires a fresh session and a reason.',
          },
        },
      )
  )
}

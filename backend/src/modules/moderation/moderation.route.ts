import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { ModerationController } from './moderation.controller'
import {
  ContentReportListResponse,
  ContentReportResponse,
  CreateReportBody,
  ModerationActionBody,
  PlatformReportListQuery,
} from './moderation.dto'

export function moderationRoutes(controller: ModerationController, auth: AuthPlugin) {
  return (
    new Elysia({ name: 'moderation-routes' })
      .use(auth)
      // --- User surface ------------------------------------------------------
      .post('/reports', ({ access, body }) => controller.create(access, body), {
        requireAuth: true,
        body: CreateReportBody,
        response: { 200: ContentReportResponse, ...CommonErrorResponses },
        detail: { tags: ['Moderation'], summary: 'Report an organization or a public challenge' },
      })
      .get('/reports/mine', ({ access, query }) => controller.listMine(access, query), {
        requireAuth: true,
        query: t.Object({
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
          cursor: t.Optional(t.String({ maxLength: 512 })),
        }),
        response: { 200: ContentReportListResponse, ...CommonErrorResponses },
        detail: { tags: ['Moderation'], summary: 'List reports the caller has filed' },
      })
      // --- Platform surface ----------------------------------------------------
      .get(
        '/platform/reports',
        ({ access, query }) => controller.listForPlatform(access, { status: query.status }, query),
        {
          requireAuth: true,
          query: PlatformReportListQuery,
          response: { 200: ContentReportListResponse, ...CommonErrorResponses },
          detail: { tags: ['Platform'], summary: 'List content reports for review' },
        },
      )
      .get(
        '/platform/reports/:reportId',
        ({ access, params }) => controller.getForPlatform(access, params.reportId),
        {
          requireAuth: true,
          params: t.Object({ reportId: Uuid }),
          response: { 200: ContentReportResponse, ...CommonErrorResponses },
          detail: { tags: ['Platform'], summary: 'Get a content report for review' },
        },
      )
      .post(
        '/platform/reports/:reportId/dismiss',
        ({ access, params, body }) => controller.dismiss(access, params.reportId, body.reason),
        {
          requireAuth: true,
          params: t.Object({ reportId: Uuid }),
          body: ModerationActionBody,
          response: { 200: ContentReportResponse, ...CommonErrorResponses },
          detail: { tags: ['Platform'], summary: 'Dismiss a content report' },
        },
      )
      .post(
        '/platform/reports/:reportId/hide-content',
        ({ access, params, body }) => controller.hideContent(access, params.reportId, body.reason),
        {
          requireAuth: true,
          params: t.Object({ reportId: Uuid }),
          body: ModerationActionBody,
          response: { 200: ContentReportResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Platform'],
            summary: 'Temporarily hide the reported challenge from public view',
            description: 'Only valid for a CHALLENGE-target report. Requires a fresh session.',
          },
        },
      )
      .post(
        '/platform/reports/:reportId/restore-content',
        ({ access, params, body }) =>
          controller.restoreContent(access, params.reportId, body.reason),
        {
          requireAuth: true,
          params: t.Object({ reportId: Uuid }),
          body: ModerationActionBody,
          response: { 200: ContentReportResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Platform'],
            summary: 'Restore a previously hidden challenge to public view',
            description: 'Only valid for a CHALLENGE-target report. Requires a fresh session.',
          },
        },
      )
      .post(
        '/platform/reports/:reportId/suspend-organization',
        ({ access, params, body }) =>
          controller.suspendOrganization(access, params.reportId, body.reason),
        {
          requireAuth: true,
          params: t.Object({ reportId: Uuid }),
          body: ModerationActionBody,
          response: { 200: ContentReportResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Platform'],
            summary: 'Suspend the reported organization',
            description:
              'Only valid for an ORGANIZATION-target report. Requires PlatformManageOrganizations ' +
              'in addition to PlatformModerate, and a fresh session.',
          },
        },
      )
  )
}

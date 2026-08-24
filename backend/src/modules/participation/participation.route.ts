import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { ParticipationController } from './participation.controller'
import {
  ApplicationFormResponse,
  ApproveParticipationBody,
  DisqualifyParticipationBody,
  ParticipationApplicationDraftResponse,
  ParticipationListQuery,
  ParticipationListResponse,
  ParticipationOrganizerResponse,
  ParticipationSelfResponse,
  RegisterBody,
  ReinstateParticipationBody,
  RejectParticipationBody,
  SaveApplicationBody,
  SubmitApplicationBody,
} from './participation.dto'

export function participationRoutes(controller: ParticipationController, auth: AuthPlugin) {
  return new Elysia({ name: 'participation-routes' })
    .use(auth)
    .post(
      '/organizations/:organizationId/challenges/:challengeId/participation/register',
      async ({ access, params, body, set }) => {
        const result = await controller.register(
          access,
          params.organizationId,
          params.challengeId,
          body,
        )
        set.status = 201
        return result
      },
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        body: RegisterBody,
        response: { 201: ParticipationSelfResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Participation'],
          summary: 'Register for a challenge',
          description:
            'Auto-approved when the challenge does not require screening; otherwise starts PENDING.',
        },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/participation/application-form',
      ({ access, params }) =>
        controller.getApplicationForm(access, params.organizationId, params.challengeId),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        response: { 200: ApplicationFormResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Participation'],
          summary: "The challenge's published screening-application form schema, if any",
          description:
            'Deliberately not routed through the generic forms module (organization.view_private) ' +
            '— a screening application exists specifically for prospective, not-yet-member ' +
            'participants, so this only requires authentication, matching save/submit-application.',
        },
      },
    )
    .patch(
      '/organizations/:organizationId/challenges/:challengeId/participation/application',
      ({ access, params, body }) =>
        controller.saveApplication(
          access,
          params.organizationId,
          params.challengeId,
          body.responseData,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        body: SaveApplicationBody,
        response: { 200: ParticipationApplicationDraftResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Participation'],
          summary: 'Save or update a screening application draft',
          description: 'Drafts remain private and mutable only until the application is submitted.',
        },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/participation/submit-application',
      async ({ access, params, body, set }) => {
        const result = await controller.submitApplication(
          access,
          params.organizationId,
          params.challengeId,
          body.responseData,
          body.acceptTermsVersionId,
        )
        set.status = 201
        return result
      },
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        body: SubmitApplicationBody,
        response: { 201: ParticipationSelfResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Participation'],
          summary: 'Submit a screening application and register in one step',
          description:
            'Validates the response against the published screening form, then registers — the ' +
            'owning-workflow alternative to submitting through the generic forms module and ' +
            'threading the resulting response ID into /register yourself.',
        },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/participation/me',
      ({ access, params }) => controller.getMine(access, params.organizationId, params.challengeId),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        response: {
          200: t.Union([ParticipationSelfResponse, t.Null()]),
          ...CommonErrorResponses,
        },
        detail: { tags: ['Participation'], summary: "Get the caller's own participation" },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/participation/withdraw',
      ({ access, params }) =>
        controller.withdraw(access, params.organizationId, params.challengeId),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        response: { 200: ParticipationSelfResponse, ...CommonErrorResponses },
        detail: { tags: ['Participation'], summary: 'Withdraw from a challenge' },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/participants',
      ({ access, params, query }) =>
        controller.list(access, params.organizationId, params.challengeId, query.status, query),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        query: ParticipationListQuery,
        response: { 200: ParticipationListResponse, ...CommonErrorResponses },
        detail: { tags: ['Participation'], summary: 'List participation applications (organizer)' },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/participants/:participationId',
      ({ access, params }) =>
        controller.get(access, params.organizationId, params.challengeId, params.participationId),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, participationId: Uuid }),
        response: { 200: ParticipationOrganizerResponse, ...CommonErrorResponses },
        detail: { tags: ['Participation'], summary: 'Get a participation application (organizer)' },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/participants/:participationId/approve',
      ({ access, params, body }) =>
        controller.approve(
          access,
          params.organizationId,
          params.challengeId,
          params.participationId,
          body.reason,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, participationId: Uuid }),
        body: ApproveParticipationBody,
        response: { 200: ParticipationOrganizerResponse, ...CommonErrorResponses },
        detail: { tags: ['Participation'], summary: 'Approve a pending application' },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/participants/:participationId/reject',
      ({ access, params, body }) =>
        controller.reject(
          access,
          params.organizationId,
          params.challengeId,
          params.participationId,
          body.reason,
          body.internalNotes,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, participationId: Uuid }),
        body: RejectParticipationBody,
        response: { 200: ParticipationOrganizerResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Participation'],
          summary: 'Reject a pending application',
          description: '`reason` is participant-visible; `internalNotes` is organizer-only.',
        },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/participants/:participationId/disqualify',
      ({ access, params, body }) =>
        controller.disqualify(
          access,
          params.organizationId,
          params.challengeId,
          params.participationId,
          body.reason,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, participationId: Uuid }),
        body: DisqualifyParticipationBody,
        response: { 200: ParticipationOrganizerResponse, ...CommonErrorResponses },
        detail: { tags: ['Participation'], summary: 'Disqualify an approved participant' },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/participants/:participationId/reinstate',
      ({ access, params, body }) =>
        controller.reinstate(
          access,
          params.organizationId,
          params.challengeId,
          params.participationId,
          body.reason,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, participationId: Uuid }),
        body: ReinstateParticipationBody,
        response: { 200: ParticipationOrganizerResponse, ...CommonErrorResponses },
        detail: { tags: ['Participation'], summary: 'Reinstate a disqualified participant' },
      },
    )
}

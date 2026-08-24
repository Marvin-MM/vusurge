import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, IdempotencyKey, PublicErrorResponses, Uuid } from '../../shared/http'
import type { UsersController } from './users.controller'
import {
  AccountDeletionRequestResponse,
  AccountDeletionRequestStatusResponse,
  CreateAccountDeletionRequestBody,
  MeResponse,
  MyChallengeParticipationListResponse,
  MyChallengeStaffInvitationListResponse,
  MyOrganizationsResponse,
  MyTeamInvitationListResponse,
  PublicProfileResponse,
  UpdateProfileBody,
  UpdateSkillsBody,
} from './users.dto'

export function usersRoutes(controller: UsersController, auth: AuthPlugin) {
  return new Elysia({ name: 'users-routes' })
    .use(auth)
    .get('/me', ({ access }) => controller.me(access), {
      requireAuth: true,
      response: { 200: MeResponse, ...CommonErrorResponses },
      detail: { tags: ['Users'], summary: 'The authenticated user' },
    })
    .get('/me/csrf-token', ({ access }) => controller.csrfToken(access), {
      requireAuth: true,
      response: {
        200: t.Object({ csrfToken: t.String({ minLength: 43, maxLength: 43 }) }),
        ...CommonErrorResponses,
      },
      detail: {
        tags: ['Users'],
        summary: 'Issue a CSRF token bound to the current session',
      },
    })
    .patch('/me/profile', ({ access, body }) => controller.updateProfile(access, body), {
      requireAuth: true,
      body: UpdateProfileBody,
      response: { 200: MeResponse, ...CommonErrorResponses },
      detail: { tags: ['Users'], summary: "Update the caller's profile" },
    })
    .put('/me/skills', ({ access, body }) => controller.updateSkills(access, body), {
      requireAuth: true,
      body: UpdateSkillsBody,
      response: { 200: MeResponse, ...CommonErrorResponses },
      detail: {
        tags: ['Users'],
        summary: "Replace the caller's claimed skills",
        description:
          'Fully replaces the skill set with the supplied catalogue IDs and custom names.',
      },
    })
    .get('/me/organizations', ({ access }) => controller.myOrganizations(access), {
      requireAuth: true,
      response: { 200: MyOrganizationsResponse, ...CommonErrorResponses },
      detail: { tags: ['Users'], summary: 'Organizations the caller actively belongs to' },
    })
    .get(
      '/me/challenge-participations',
      ({ access }) => controller.myChallengeParticipations(access),
      {
        requireAuth: true,
        response: { 200: MyChallengeParticipationListResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Users'],
          summary: "The caller's challenge participations across every organization",
        },
      },
    )
    .get('/me/team-invitations', ({ access }) => controller.myTeamInvitations(access), {
      requireAuth: true,
      response: { 200: MyTeamInvitationListResponse, ...CommonErrorResponses },
      detail: {
        tags: ['Users'],
        summary: "The caller's team invitations across every organization",
      },
    })
    .get(
      '/me/challenge-staff-invitations',
      ({ access }) => controller.myChallengeStaffInvitations(access),
      {
        requireAuth: true,
        response: { 200: MyChallengeStaffInvitationListResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Users'],
          summary: "The caller's challenge staff (judge/mentor) invitations, matched by email",
        },
      },
    )
    .get(
      '/users/:userId/profile',
      ({ access, params }) => controller.publicProfile(access, params.userId),
      {
        params: t.Object({ userId: Uuid }),
        response: { 200: PublicProfileResponse, ...PublicErrorResponses },
        detail: {
          tags: ['Users'],
          summary: 'A safe profile projection, respecting visibility',
          description:
            'Returns the same 404 whether the user does not exist or the caller may not view the ' +
            'profile, so existence is never leaked to an unrelated caller.',
        },
      },
    )
    .get(
      '/me/account-deletion-request',
      async ({ access }) => ({
        request: await controller.getPendingAccountDeletion(access),
      }),
      {
        requireAuth: true,
        response: { 200: AccountDeletionRequestStatusResponse, ...CommonErrorResponses },
        detail: { tags: ['Users'], summary: "Get the caller's pending account deletion request" },
      },
    )
    .post(
      '/me/account-deletion-request',
      async ({ access, body, headers, set }) => {
        const result = await controller.requestAccountDeletion(
          access,
          body.reason,
          headers['idempotency-key'],
        )
        set.status = result.status
        return result.body
      },
      {
        requireAuth: true,
        headers: t.Object({ 'idempotency-key': IdempotencyKey }),
        body: CreateAccountDeletionRequestBody,
        response: { 200: AccountDeletionRequestResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Users'],
          summary: 'Request account deletion',
          description:
            'Starts a grace-period deletion workflow. Organization/business records retain ' +
            'referential integrity; audit and consent records are retained or pseudonymized per policy.',
        },
      },
    )
    .delete(
      '/me/account-deletion-request',
      async ({ access, set }) => {
        await controller.cancelAccountDeletion(access)
        set.status = 204
      },
      {
        requireAuth: true,
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Users'], summary: 'Cancel a pending account deletion request' },
      },
    )
}

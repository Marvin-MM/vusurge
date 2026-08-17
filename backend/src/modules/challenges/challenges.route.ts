import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { ChallengesController } from './challenges.controller'
import {
  AcceptTermsResponse,
  ArchiveChallengeBody,
  CancelChallengeBody,
  ChallengeListQuery,
  ChallengeListResponse,
  ChallengeResponse,
  CreateChallengeBody,
  CreatePrizeBody,
  CreateSponsorBody,
  CreateTermsVersionBody,
  CreateTrackBody,
  ExtendDeadlineBody,
  PrizeListResponse,
  PrizeResponse,
  ReopenChallengeBody,
  RescheduleChallengeBody,
  SponsorListResponse,
  SponsorResponse,
  TermsVersionListResponse,
  TermsVersionResponse,
  TrackListResponse,
  TrackResponse,
  UpdateChallengeBody,
  UpdatePrizeBody,
  UpdateSponsorBody,
  UpdateTrackBody,
} from './challenges.dto'

export function challengesRoutes(controller: ChallengesController, auth: AuthPlugin) {
  return (
    new Elysia({ name: 'challenges-routes' })
      .use(auth)
      .post(
        '/organizations/:organizationId/challenges',
        async ({ access, params, body, set }) => {
          const result = await controller.create(access, params.organizationId, body)
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid }),
          body: CreateChallengeBody,
          response: { 201: ChallengeResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Create a challenge (starts DRAFT)' },
        },
      )
      .get(
        '/organizations/:organizationId/challenges',
        ({ access, params, query }) =>
          controller.list(access, params.organizationId, query.status, query),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid }),
          query: ChallengeListQuery,
          response: { 200: ChallengeListResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'List organization challenges' },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId',
        ({ access, params }) => controller.get(access, params.organizationId, params.challengeId),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: ChallengeResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Get a challenge' },
        },
      )
      .patch(
        '/organizations/:organizationId/challenges/:challengeId',
        ({ access, params, body }) =>
          controller.update(access, params.organizationId, params.challengeId, body),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: UpdateChallengeBody,
          response: { 200: ChallengeResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Challenges'],
            summary: 'Update a challenge',
            description:
              'Structural fields (participation policy, team size, visibility, timezone) may only ' +
              'change while the challenge is DRAFT or SCHEDULED. Cosmetic fields may change any time ' +
              'before the challenge is ARCHIVED or CANCELLED.',
          },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/publish',
        ({ access, params }) =>
          controller.publish(access, params.organizationId, params.challengeId),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: ChallengeResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Challenges'],
            summary: 'Publish a DRAFT challenge',
            description:
              'Requires a submission deadline to already be set. Moves to OPEN immediately or ' +
              'SCHEDULED, depending on the registration open time.',
          },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/reschedule',
        ({ access, params, body }) =>
          controller.reschedule(access, params.organizationId, params.challengeId, body),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: RescheduleChallengeBody,
          response: { 200: ChallengeResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Challenges'],
            summary: 'Reschedule one or more challenge timeline fields',
            description:
              'Shortening the submission deadline is rejected once any participation exists. Every ' +
              'changed field is recorded as its own schedule-change entry.',
          },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/extend-deadline',
        ({ access, params, body }) =>
          controller.extendDeadline(
            access,
            params.organizationId,
            params.challengeId,
            body.newDeadline,
            body.reason,
          ),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: ExtendDeadlineBody,
          response: { 200: ChallengeResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Challenges'],
            summary: 'Extend the submission deadline',
            description: 'The new deadline must be strictly later than the current one.',
          },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/reopen',
        ({ access, params, body }) =>
          controller.reopen(
            access,
            params.organizationId,
            params.challengeId,
            body.newDeadline,
            body.reason,
          ),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: ReopenChallengeBody,
          response: { 200: ChallengeResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Challenges'],
            summary: 'Reopen a CLOSED challenge',
            description: 'Moves back to OPEN with a new, future submission deadline.',
          },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/cancel',
        ({ access, params, body }) =>
          controller.cancel(access, params.organizationId, params.challengeId, body.reason),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: CancelChallengeBody,
          response: { 200: ChallengeResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Cancel a challenge' },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/archive',
        ({ access, params, body }) =>
          controller.archive(access, params.organizationId, params.challengeId, body.reason),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: ArchiveChallengeBody,
          response: { 200: ChallengeResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Archive a challenge' },
        },
      )
      // --- tracks --------------------------------------------------------------
      .post(
        '/organizations/:organizationId/challenges/:challengeId/tracks',
        async ({ access, params, body, set }) => {
          const result = await controller.createTrack(
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
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: CreateTrackBody,
          response: { 201: TrackResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Create a challenge track' },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/tracks',
        ({ access, params }) =>
          controller.listTracks(access, params.organizationId, params.challengeId),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: TrackListResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'List challenge tracks' },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/tracks/:trackId',
        ({ access, params }) =>
          controller.getTrack(access, params.organizationId, params.challengeId, params.trackId),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, trackId: Uuid }),
          response: { 200: TrackResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Get a single challenge track' },
        },
      )
      .patch(
        '/organizations/:organizationId/challenges/:challengeId/tracks/:trackId',
        ({ access, params, body }) =>
          controller.updateTrack(
            access,
            params.organizationId,
            params.challengeId,
            params.trackId,
            body,
          ),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, trackId: Uuid }),
          body: UpdateTrackBody,
          response: { 200: TrackResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Update a challenge track' },
        },
      )
      .delete(
        '/organizations/:organizationId/challenges/:challengeId/tracks/:trackId',
        async ({ access, params, set }) => {
          await controller.archiveTrack(
            access,
            params.organizationId,
            params.challengeId,
            params.trackId,
          )
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, trackId: Uuid }),
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Archive a challenge track' },
        },
      )
      // --- prizes --------------------------------------------------------------
      .post(
        '/organizations/:organizationId/challenges/:challengeId/prizes',
        async ({ access, params, body, set }) => {
          const result = await controller.createPrize(
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
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: CreatePrizeBody,
          response: { 201: PrizeResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Create a challenge prize' },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/prizes',
        ({ access, params }) =>
          controller.listPrizes(access, params.organizationId, params.challengeId),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: PrizeListResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'List challenge prizes' },
        },
      )
      .patch(
        '/organizations/:organizationId/challenges/:challengeId/prizes/:prizeId',
        ({ access, params, body }) =>
          controller.updatePrize(
            access,
            params.organizationId,
            params.challengeId,
            params.prizeId,
            body,
          ),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, prizeId: Uuid }),
          body: UpdatePrizeBody,
          response: { 200: PrizeResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Update a challenge prize' },
        },
      )
      .delete(
        '/organizations/:organizationId/challenges/:challengeId/prizes/:prizeId',
        async ({ access, params, set }) => {
          await controller.deletePrize(
            access,
            params.organizationId,
            params.challengeId,
            params.prizeId,
          )
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, prizeId: Uuid }),
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Remove a challenge prize' },
        },
      )
      // --- sponsors ------------------------------------------------------------
      .post(
        '/organizations/:organizationId/challenges/:challengeId/sponsors',
        async ({ access, params, body, set }) => {
          const result = await controller.createSponsor(
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
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: CreateSponsorBody,
          response: { 201: SponsorResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Create a challenge sponsor' },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/sponsors',
        ({ access, params }) =>
          controller.listSponsors(access, params.organizationId, params.challengeId),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: SponsorListResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'List challenge sponsors' },
        },
      )
      .patch(
        '/organizations/:organizationId/challenges/:challengeId/sponsors/:sponsorId',
        ({ access, params, body }) =>
          controller.updateSponsor(
            access,
            params.organizationId,
            params.challengeId,
            params.sponsorId,
            body,
          ),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, sponsorId: Uuid }),
          body: UpdateSponsorBody,
          response: { 200: SponsorResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Update a challenge sponsor' },
        },
      )
      .delete(
        '/organizations/:organizationId/challenges/:challengeId/sponsors/:sponsorId',
        async ({ access, params, set }) => {
          await controller.deleteSponsor(
            access,
            params.organizationId,
            params.challengeId,
            params.sponsorId,
          )
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, sponsorId: Uuid }),
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Remove a challenge sponsor' },
        },
      )
      // --- terms versions --------------------------------------------------------
      .post(
        '/organizations/:organizationId/challenges/:challengeId/terms/versions',
        async ({ access, params, body, set }) => {
          const result = await controller.createTermsVersion(
            access,
            params.organizationId,
            params.challengeId,
            body.content,
          )
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: CreateTermsVersionBody,
          response: { 201: TermsVersionResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Challenges'],
            summary: 'Create a new terms version',
            description: 'Immutable once created. Creating a new version does not activate it.',
          },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/terms',
        ({ access, params }) =>
          controller.listTermsVersions(access, params.organizationId, params.challengeId),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: TermsVersionListResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'List terms versions' },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/terms/versions/:termsVersionId/activate',
        ({ access, params }) =>
          controller.activateTermsVersion(
            access,
            params.organizationId,
            params.challengeId,
            params.termsVersionId,
          ),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, termsVersionId: Uuid }),
          response: { 200: TermsVersionResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Challenges'],
            summary: 'Activate a terms version',
            description: 'Deactivates any previously active version for this challenge first.',
          },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/terms/current',
        ({ access, params }) =>
          controller.getCurrentTerms(access, params.organizationId, params.challengeId),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: t.Union([TermsVersionResponse, t.Null()]), ...CommonErrorResponses },
          detail: {
            tags: ['Challenges'],
            summary: 'Get the currently active terms version',
            description: 'Null if the challenge has no active terms version.',
          },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/terms/versions/:termsVersionId',
        ({ access, params }) =>
          controller.getTermsVersion(
            access,
            params.organizationId,
            params.challengeId,
            params.termsVersionId,
          ),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, termsVersionId: Uuid }),
          response: { 200: TermsVersionResponse, ...CommonErrorResponses },
          detail: { tags: ['Challenges'], summary: 'Get a single terms version' },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/terms/:termsVersionId/accept',
        ({ access, params }) =>
          controller.acceptTerms(
            access,
            params.organizationId,
            params.challengeId,
            params.termsVersionId,
          ),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, termsVersionId: Uuid }),
          response: { 200: AcceptTermsResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Challenges'],
            summary: 'Explicitly accept a terms version',
            description:
              'Registration implicitly accepts the active version at that time; this endpoint ' +
              'is for re-accepting after a material terms change while already participating.',
          },
        },
      )
  )
}

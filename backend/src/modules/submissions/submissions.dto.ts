import { t } from 'elysia'
import {
  ActionReason,
  HttpsUrl,
  MarkdownText,
  PageOf,
  PaginationQuery,
  Uuid,
} from '../../shared/http'

const SubmissionStatus = t.Union([
  t.Literal('DRAFT'),
  t.Literal('FINALIZED'),
  t.Literal('DISQUALIFIED'),
])

const SupportingLink = t.Object({
  label: t.String({ minLength: 1, maxLength: 120 }),
  url: HttpsUrl,
})

export const SaveDraftBody = t.Object({
  title: t.Optional(t.String({ minLength: 2, maxLength: 200 })),
  tagline: t.Optional(t.String({ maxLength: 300 })),
  problemStatement: t.Optional(MarkdownText(5000)),
  solutionDescription: t.Optional(MarkdownText(5000)),
  impactBeneficiaries: t.Optional(MarkdownText(5000)),
  technologyTags: t.Optional(t.Array(t.String({ maxLength: 60 }), { maxItems: 30 })),
  repositoryUrl: t.Optional(HttpsUrl),
  demoUrl: t.Optional(HttpsUrl),
  pitchVideoUrl: t.Optional(HttpsUrl),
  presentationUrl: t.Optional(HttpsUrl),
  supportingLinks: t.Optional(t.Array(SupportingLink, { maxItems: 10 })),
  publicationConsent: t.Optional(t.Boolean()),
  termsVersionId: t.Optional(Uuid),
  screenshotAssetIds: t.Optional(t.Array(Uuid, { maxItems: 4 })),
})

export const SubmissionVersionResponse = t.Object({
  id: Uuid,
  submissionId: Uuid,
  versionNumber: t.Integer(),
  isFinal: t.Boolean(),
  title: t.Union([t.String(), t.Null()]),
  tagline: t.Union([t.String(), t.Null()]),
  problemStatement: t.Union([t.String(), t.Null()]),
  solutionDescription: t.Union([t.String(), t.Null()]),
  impactBeneficiaries: t.Union([t.String(), t.Null()]),
  technologyTags: t.Array(t.String()),
  repositoryUrl: t.Union([t.String(), t.Null()]),
  demoUrl: t.Union([t.String(), t.Null()]),
  pitchVideoUrl: t.Union([t.String(), t.Null()]),
  presentationUrl: t.Union([t.String(), t.Null()]),
  supportingLinks: t.Array(SupportingLink),
  publicationConsent: t.Boolean(),
  termsVersionId: t.Union([Uuid, t.Null()]),
  createdAt: t.String(),
})

export const SubmissionVersionListResponse = t.Array(SubmissionVersionResponse)

export const SubmissionScreenshotResponse = t.Object({
  slot: t.Integer(),
  mediaAssetId: Uuid,
})

export const SubmissionPresentationFileResponse = t.Object({
  fileAssetId: Uuid,
  displayName: t.String(),
  scanStatus: t.Union([
    t.Literal('PENDING_UPLOAD'),
    t.Literal('QUARANTINED'),
    t.Literal('CLEAN'),
    t.Literal('INFECTED'),
    t.Literal('FAILED'),
  ]),
})

export const SubmissionResponse = t.Object({
  id: Uuid,
  challengeId: Uuid,
  teamId: Uuid,
  trackId: t.Union([Uuid, t.Null()]),
  status: SubmissionStatus,
  draftVersion: t.Union([SubmissionVersionResponse, t.Null()]),
  screenshots: t.Array(SubmissionScreenshotResponse),
  presentationFiles: t.Array(SubmissionPresentationFileResponse),
  disqualificationReason: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

export const SubmissionSummaryResponse = t.Object({
  id: Uuid,
  challengeId: Uuid,
  teamId: Uuid,
  trackId: t.Union([Uuid, t.Null()]),
  status: SubmissionStatus,
  createdAt: t.String(),
})

export const SubmissionListResponse = PageOf(SubmissionSummaryResponse)
export const SubmissionListQuery = t.Composite([
  PaginationQuery,
  t.Object({ status: t.Optional(SubmissionStatus) }),
])

export const ReopenSubmissionBody = t.Object({ reason: ActionReason })
export const DisqualifySubmissionBody = t.Object({ reason: ActionReason })
export const ReinstateSubmissionBody = t.Object({ reason: ActionReason })

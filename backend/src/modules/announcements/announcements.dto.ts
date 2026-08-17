import { t } from 'elysia'
import { MarkdownText, PageOf, PaginationQuery, Uuid } from '../../shared/http'

const AnnouncementAudience = t.Union([
  t.Literal('ALL_MEMBERS'),
  t.Literal('CHALLENGE_PARTICIPANTS'),
  t.Literal('PUBLIC'),
])
const AnnouncementPriority = t.Union([
  t.Literal('LOW'),
  t.Literal('NORMAL'),
  t.Literal('HIGH'),
  t.Literal('URGENT'),
])

export const CreateAnnouncementBody = t.Object({
  challengeId: t.Optional(Uuid),
  title: t.String({ minLength: 2, maxLength: 200 }),
  body: MarkdownText(10_000),
  audience: t.Optional(AnnouncementAudience),
  priority: t.Optional(AnnouncementPriority),
  publishAt: t.Optional(t.String()),
  expiresAt: t.Optional(t.String()),
  deliverInApp: t.Optional(t.Boolean()),
  deliverEmail: t.Optional(t.Boolean()),
  deliverIntegration: t.Optional(t.Boolean()),
})

export const UpdateAnnouncementBody = t.Object({
  title: t.Optional(t.String({ minLength: 2, maxLength: 200 })),
  body: t.Optional(MarkdownText(10_000)),
  audience: t.Optional(AnnouncementAudience),
  priority: t.Optional(AnnouncementPriority),
  publishAt: t.Optional(t.Union([t.String(), t.Null()])),
  expiresAt: t.Optional(t.Union([t.String(), t.Null()])),
  deliverInApp: t.Optional(t.Boolean()),
  deliverEmail: t.Optional(t.Boolean()),
  deliverIntegration: t.Optional(t.Boolean()),
})

export const AnnouncementResponse = t.Object({
  id: Uuid,
  challengeId: t.Union([Uuid, t.Null()]),
  title: t.String(),
  body: t.String(),
  audience: AnnouncementAudience,
  priority: AnnouncementPriority,
  publishAt: t.Union([t.String(), t.Null()]),
  expiresAt: t.Union([t.String(), t.Null()]),
  isPublished: t.Boolean(),
  publishedAt: t.Union([t.String(), t.Null()]),
  deliverInApp: t.Boolean(),
  deliverEmail: t.Boolean(),
  deliverIntegration: t.Boolean(),
  createdAt: t.String(),
})

export const AnnouncementListResponse = PageOf(AnnouncementResponse)
export const AnnouncementListQuery = t.Composite([
  PaginationQuery,
  t.Object({ challengeId: t.Optional(Uuid) }),
])

export const CreateFaqBody = t.Object({
  challengeId: t.Optional(Uuid),
  question: t.String({ minLength: 2, maxLength: 500 }),
  answer: MarkdownText(5000),
  displayOrder: t.Optional(t.Integer({ minimum: 0 })),
})

export const UpdateFaqBody = t.Object({
  question: t.Optional(t.String({ minLength: 2, maxLength: 500 })),
  answer: t.Optional(MarkdownText(5000)),
  displayOrder: t.Optional(t.Integer({ minimum: 0 })),
  isPublished: t.Optional(t.Boolean()),
})

export const FaqResponse = t.Object({
  id: Uuid,
  challengeId: t.Union([Uuid, t.Null()]),
  question: t.String(),
  answer: t.String(),
  displayOrder: t.Integer(),
  isPublished: t.Boolean(),
  createdAt: t.String(),
})

export const FaqListResponse = t.Array(FaqResponse)
export const FaqListQuery = t.Object({ challengeId: t.Optional(Uuid) })
export const ReorderFaqsBody = t.Object({
  orderedIds: t.Array(Uuid, { minItems: 1, maxItems: 200 }),
})

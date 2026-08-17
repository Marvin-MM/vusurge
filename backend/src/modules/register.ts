import { Elysia } from 'elysia'
import type { Infrastructure } from '../container'
import type { AuthPlugin } from '../shared/auth'
import { createAnalyticsController } from './analytics/analytics.controller'
import { createAnalyticsRepository } from './analytics/analytics.repository'
import { analyticsRoutes } from './analytics/analytics.route'
import { createAnalyticsService } from './analytics/analytics.service'
import { createAnnouncementsController } from './announcements/announcements.controller'
import { createAnnouncementsRepository } from './announcements/announcements.repository'
import { announcementsRoutes } from './announcements/announcements.route'
import { createAnnouncementsService } from './announcements/announcements.service'
import { createAuditController } from './audit/audit.controller'
import { createAuditRepository } from './audit/audit.repository'
import { auditRoutes } from './audit/audit.route'
import { createAuditService } from './audit/audit.service'
import { createChallengesController } from './challenges/challenges.controller'
import { createChallengesRepository } from './challenges/challenges.repository'
import { challengesRoutes } from './challenges/challenges.route'
import { createChallengesService } from './challenges/challenges.service'
import { createExportsController } from './exports/exports.controller'
import { createExportsRepository } from './exports/exports.repository'
import { exportsRoutes } from './exports/exports.route'
import { createExportsService } from './exports/exports.service'
import { createFilesController } from './files/files.controller'
import { createFilesRepository } from './files/files.repository'
import { filesRoutes } from './files/files.route'
import { createFilesService } from './files/files.service'
import { createFormsController } from './forms/forms.controller'
import { createFormsRepository } from './forms/forms.repository'
import { formsRoutes } from './forms/forms.route'
import { createFormsService } from './forms/forms.service'
import { createInnovationPortfolioController } from './innovation-portfolio/innovation-portfolio.controller'
import { createInnovationPortfolioRepository } from './innovation-portfolio/innovation-portfolio.repository'
import { innovationPortfolioRoutes } from './innovation-portfolio/innovation-portfolio.route'
import { createInnovationPortfolioService } from './innovation-portfolio/innovation-portfolio.service'
import { createIntegrationsController } from './integrations/integrations.controller'
import { createIntegrationsRepository } from './integrations/integrations.repository'
import { integrationsRoutes } from './integrations/integrations.route'
import { createIntegrationsService } from './integrations/integrations.service'
import { createInvitationsController } from './invitations/invitations.controller'
import { createInvitationsRepository } from './invitations/invitations.repository'
import { invitationsRoutes } from './invitations/invitations.route'
import { createInvitationsService } from './invitations/invitations.service'
import { createJoinCodesController } from './join-codes/join-codes.controller'
import { createJoinCodesRepository } from './join-codes/join-codes.repository'
import { joinCodesRoutes } from './join-codes/join-codes.route'
import { createJoinCodesService } from './join-codes/join-codes.service'
import { createJoinRequestsController } from './join-requests/join-requests.controller'
import { createJoinRequestsRepository } from './join-requests/join-requests.repository'
import { joinRequestsRoutes } from './join-requests/join-requests.route'
import { createJoinRequestsService } from './join-requests/join-requests.service'
import { createJudgingController } from './judging/judging.controller'
import { createJudgingRepository } from './judging/judging.repository'
import { judgingRoutes } from './judging/judging.route'
import { createJudgingService } from './judging/judging.service'
import { createMatchmakingController } from './matchmaking/matchmaking.controller'
import { createMatchmakingRepository } from './matchmaking/matchmaking.repository'
import { matchmakingRoutes } from './matchmaking/matchmaking.route'
import { createMatchmakingService } from './matchmaking/matchmaking.service'
import { createMediaController } from './media/media.controller'
import { createMediaRepository } from './media/media.repository'
import { mediaRoutes } from './media/media.route'
import { createMediaService } from './media/media.service'
import { createMembershipsController } from './memberships/memberships.controller'
import { createMembershipsRepository } from './memberships/memberships.repository'
import { membershipsRoutes } from './memberships/memberships.route'
import { createMembershipsService } from './memberships/memberships.service'
import { createMetaController } from './meta/meta.controller'
import { createMetaRepository } from './meta/meta.repository'
import { metaRoutes } from './meta/meta.route'
import { createMetaService } from './meta/meta.service'
import { createModerationController } from './moderation/moderation.controller'
import { createModerationRepository } from './moderation/moderation.repository'
import { moderationRoutes } from './moderation/moderation.route'
import { createModerationService } from './moderation/moderation.service'
import { createNotificationsController } from './notifications/notifications.controller'
import { createNotificationsRepository } from './notifications/notifications.repository'
import { notificationsRoutes } from './notifications/notifications.route'
import { createNotificationsService } from './notifications/notifications.service'
import { createOrganizationApplicationsController } from './organization-applications/organization-applications.controller'
import { createOrganizationApplicationsRepository } from './organization-applications/organization-applications.repository'
import { organizationApplicationsRoutes } from './organization-applications/organization-applications.route'
import { createOrganizationApplicationsService } from './organization-applications/organization-applications.service'
import { createOrganizationsController } from './organizations/organizations.controller'
import { createOrganizationsRepository } from './organizations/organizations.repository'
import { organizationsRoutes } from './organizations/organizations.route'
import { createOrganizationsService } from './organizations/organizations.service'
import { createParticipationController } from './participation/participation.controller'
import { createParticipationRepository } from './participation/participation.repository'
import { participationRoutes } from './participation/participation.route'
import { createParticipationService } from './participation/participation.service'
import { createPlatformAdminController } from './platform-admin/platform-admin.controller'
import { platformAdminRoutes } from './platform-admin/platform-admin.route'
import { createPlatformAdminService } from './platform-admin/platform-admin.service'
import { createPublicController } from './public/public.controller'
import { createPublicRepository } from './public/public.repository'
import { publicRoutes } from './public/public.route'
import { createPublicService } from './public/public.service'
import { createSearchController } from './search/search.controller'
import { searchRoutes } from './search/search.route'
import { createSearchService } from './search/search.service'
import { createSubmissionsController } from './submissions/submissions.controller'
import { createSubmissionsRepository } from './submissions/submissions.repository'
import { submissionsRoutes } from './submissions/submissions.route'
import { createSubmissionsService } from './submissions/submissions.service'
import { createSupportController } from './support/support.controller'
import { createSupportRepository } from './support/support.repository'
import { supportRoutes } from './support/support.route'
import { createSupportService } from './support/support.service'
import { createTeamsController } from './teams/teams.controller'
import { createTeamsRepository } from './teams/teams.repository'
import { teamsRoutes } from './teams/teams.route'
import { createTeamsService } from './teams/teams.service'
import { createUsersController } from './users/users.controller'
import { createUsersRepository } from './users/users.repository'
import { usersRoutes } from './users/users.route'
import { createUsersService } from './users/users.service'

/**
 * Composes every business module onto the `/api/v1` group.
 *
 * Each module is wired the same way: repository takes the database, service
 * takes the repository plus whatever infrastructure it needs, controller
 * takes the service, route takes the controller. Adding a module means adding
 * one block here — nothing about existing modules changes.
 *
 * Some services depend on another module's repository directly (for example,
 * organization-application approval creates a membership). That is ordinary
 * composition-root wiring, not a violation of the per-module five-file
 * convention, which governs a module's own internal layout.
 */
export function registerModules(infrastructure: Infrastructure, auth: AuthPlugin) {
  const paginationLimits = {
    defaultPageSize: infrastructure.config.pagination.defaultPageSize,
    maxPageSize: infrastructure.config.pagination.maxPageSize,
  }
  const mediaRepository = createMediaRepository()

  // --- meta ----------------------------------------------------------------
  const metaRepository = createMetaRepository(infrastructure.database.client)
  const metaService = createMetaService(
    metaRepository,
    infrastructure.config,
    infrastructure.fileScanner,
    paginationLimits,
  )
  const metaController = createMetaController(metaService)

  // --- users -----------------------------------------------------------------
  const usersRepository = createUsersRepository()
  const usersService = createUsersService(
    usersRepository,
    mediaRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    infrastructure.config,
  )
  const usersController = createUsersController(
    usersService,
    infrastructure.config.auth.secret,
    infrastructure.idempotency,
  )

  // --- organizations -----------------------------------------------------
  const organizationsRepository = createOrganizationsRepository()
  const membershipsRepository = createMembershipsRepository()

  const organizationsService = createOrganizationsService(
    organizationsRepository,
    membershipsRepository,
    mediaRepository,
    infrastructure.transactions,
    infrastructure.audit,
  )
  const organizationsController = createOrganizationsController(organizationsService)

  // --- memberships -------------------------------------------------------
  const membershipsService = createMembershipsService(
    membershipsRepository,
    infrastructure.transactions,
    infrastructure.audit,
    paginationLimits,
  )
  const membershipsController = createMembershipsController(membershipsService)

  // --- organization applications ------------------------------------------
  const organizationApplicationsRepository = createOrganizationApplicationsRepository()
  const organizationApplicationsService = createOrganizationApplicationsService(
    organizationApplicationsRepository,
    organizationsRepository,
    membershipsRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    infrastructure.rateLimiter,
    paginationLimits,
  )
  const organizationApplicationsController = createOrganizationApplicationsController(
    organizationApplicationsService,
    infrastructure.idempotency,
  )

  // --- invitations ---------------------------------------------------------
  const invitationsRepository = createInvitationsRepository()
  const invitationsService = createInvitationsService(
    invitationsRepository,
    organizationsRepository,
    membershipsRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    infrastructure.rateLimiter,
    paginationLimits,
  )
  const invitationsController = createInvitationsController(
    invitationsService,
    infrastructure.idempotency,
  )

  // --- join codes ----------------------------------------------------------
  const joinCodesRepository = createJoinCodesRepository()
  const joinCodesService = createJoinCodesService(
    joinCodesRepository,
    organizationsRepository,
    membershipsRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.rateLimiter,
  )
  const joinCodesController = createJoinCodesController(joinCodesService)

  // --- join requests ---------------------------------------------------------
  const joinRequestsRepository = createJoinRequestsRepository()
  const joinRequestsService = createJoinRequestsService(
    joinRequestsRepository,
    organizationsRepository,
    membershipsRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    infrastructure.rateLimiter,
    paginationLimits,
  )
  const joinRequestsController = createJoinRequestsController(joinRequestsService)

  // --- challenges ------------------------------------------------------------
  const challengesRepository = createChallengesRepository()
  const challengesService = createChallengesService(
    challengesRepository,
    mediaRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    paginationLimits,
    infrastructure.config,
  )
  const challengesController = createChallengesController(challengesService)

  // --- forms -------------------------------------------------------------
  const formsRepository = createFormsRepository()
  const formsService = createFormsService(
    formsRepository,
    infrastructure.transactions,
    infrastructure.audit,
    paginationLimits,
  )
  const formsController = createFormsController(formsService)

  // --- participation -------------------------------------------------------
  const participationRepository = createParticipationRepository()
  const participationService = createParticipationService(
    participationRepository,
    challengesRepository,
    membershipsRepository,
    formsRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    paginationLimits,
  )
  const participationController = createParticipationController(participationService)

  // --- teams -----------------------------------------------------------------
  const teamsRepository = createTeamsRepository()
  const teamsService = createTeamsService(
    teamsRepository,
    challengesRepository,
    participationRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    infrastructure.rateLimiter,
  )
  const teamsController = createTeamsController(teamsService)

  // --- matchmaking -------------------------------------------------------
  const matchmakingRepository = createMatchmakingRepository()
  const matchmakingService = createMatchmakingService(
    matchmakingRepository,
    participationRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
  )
  const matchmakingController = createMatchmakingController(matchmakingService)

  // --- announcements and FAQs ---------------------------------------------
  const announcementsRepository = createAnnouncementsRepository()
  const announcementsService = createAnnouncementsService(
    announcementsRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    paginationLimits,
  )
  const announcementsController = createAnnouncementsController(announcementsService)

  // --- media -----------------------------------------------------------------
  const mediaService = createMediaService(
    mediaRepository,
    infrastructure.imageProvider,
    infrastructure.accessContextResolver,
    participationRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    infrastructure.rateLimiter,
    infrastructure.config,
  )
  const mediaController = createMediaController(mediaService)

  // --- notifications -------------------------------------------------------
  const notificationsRepository = createNotificationsRepository()
  const notificationsService = createNotificationsService(
    notificationsRepository,
    infrastructure.transactions,
    infrastructure.config,
    paginationLimits,
  )
  const notificationsController = createNotificationsController(notificationsService)

  // --- submissions -------------------------------------------------------
  const submissionsRepository = createSubmissionsRepository()
  const submissionsService = createSubmissionsService(
    submissionsRepository,
    teamsRepository,
    teamsService,
    challengesRepository,
    organizationsRepository,
    mediaRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
  )
  const submissionsController = createSubmissionsController(
    submissionsService,
    infrastructure.idempotency,
  )

  // --- judging -------------------------------------------------------------
  const judgingRepository = createJudgingRepository()
  const judgingService = createJudgingService(
    judgingRepository,
    challengesRepository,
    submissionsRepository,
    teamsRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
  )
  const judgingController = createJudgingController(judgingService, infrastructure.idempotency)

  // --- public ----------------------------------------------------------------
  const publicRepository = createPublicRepository()
  const publicService = createPublicService(
    publicRepository,
    infrastructure.database,
    infrastructure.rateLimiter,
    paginationLimits,
  )
  const publicController = createPublicController(publicService)

  // --- search ------------------------------------------------------------
  const searchService = createSearchService(
    publicRepository,
    infrastructure.database,
    infrastructure.rateLimiter,
  )
  const searchController = createSearchController(searchService)

  // --- audit ---------------------------------------------------------------
  const auditRepository = createAuditRepository()
  const auditService = createAuditService(
    auditRepository,
    infrastructure.transactions,
    infrastructure.audit,
    paginationLimits,
  )
  const auditController = createAuditController(auditService)

  // --- platform admin ----------------------------------------------------
  const platformAdminService = createPlatformAdminService(
    organizationsRepository,
    infrastructure.transactions,
    infrastructure.audit,
    paginationLimits,
    auditService,
  )
  const platformAdminController = createPlatformAdminController(platformAdminService)

  // --- support ---------------------------------------------------------------
  const supportRepository = createSupportRepository()
  const supportService = createSupportService(
    supportRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    infrastructure.rateLimiter,
    paginationLimits,
  )
  const supportController = createSupportController(supportService)

  // --- moderation --------------------------------------------------------
  const moderationRepository = createModerationRepository()
  const moderationService = createModerationService(
    moderationRepository,
    platformAdminService,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.rateLimiter,
    paginationLimits,
  )
  const moderationController = createModerationController(moderationService)

  // --- analytics -----------------------------------------------------------
  const analyticsRepository = createAnalyticsRepository()
  const analyticsService = createAnalyticsService(
    analyticsRepository,
    challengesRepository,
    infrastructure.transactions,
  )
  const analyticsController = createAnalyticsController(analyticsService)

  // --- exports ---------------------------------------------------------------
  const exportsRepository = createExportsRepository()
  const exportsService = createExportsService(
    exportsRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    infrastructure.objectStorage,
    infrastructure.rateLimiter,
    infrastructure.config,
    paginationLimits,
  )
  const exportsController = createExportsController(exportsService, infrastructure.idempotency)

  // --- private files -------------------------------------------------------
  const filesRepository = createFilesRepository()
  const filesService = createFilesService(
    filesRepository,
    infrastructure.accessContextResolver,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    infrastructure.objectStorage,
    infrastructure.fileScanner,
    infrastructure.rateLimiter,
    infrastructure.config,
  )
  const filesController = createFilesController(filesService)

  // --- integrations ------------------------------------------------------
  const integrationsRepository = createIntegrationsRepository()
  const integrationsService = createIntegrationsService(
    integrationsRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    infrastructure.encryption,
    infrastructure.rateLimiter,
    infrastructure.config,
    paginationLimits,
  )
  const integrationsController = createIntegrationsController(
    integrationsService,
    infrastructure.idempotency,
  )

  // --- innovation portfolio ------------------------------------------------
  const innovationPortfolioRepository = createInnovationPortfolioRepository()
  const innovationPortfolioService = createInnovationPortfolioService(
    innovationPortfolioRepository,
    submissionsRepository,
    mediaRepository,
    infrastructure.transactions,
    infrastructure.audit,
    infrastructure.outbox,
    paginationLimits,
    infrastructure.config,
  )
  const innovationPortfolioController = createInnovationPortfolioController(
    innovationPortfolioService,
  )

  return new Elysia({ prefix: '/api/v1' })
    .use(auth)
    .use(metaRoutes(metaController, auth))
    .use(usersRoutes(usersController, auth))
    .use(organizationsRoutes(organizationsController, auth))
    .use(membershipsRoutes(membershipsController, auth))
    .use(organizationApplicationsRoutes(organizationApplicationsController, auth))
    .use(invitationsRoutes(invitationsController, auth))
    .use(joinCodesRoutes(joinCodesController, auth))
    .use(joinRequestsRoutes(joinRequestsController, auth))
    .use(challengesRoutes(challengesController, auth))
    .use(formsRoutes(formsController, auth))
    .use(participationRoutes(participationController, auth))
    .use(teamsRoutes(teamsController, auth))
    .use(matchmakingRoutes(matchmakingController, auth))
    .use(submissionsRoutes(submissionsController, auth))
    .use(judgingRoutes(judgingController, auth))
    .use(announcementsRoutes(announcementsController, auth))
    .use(mediaRoutes(mediaController, auth))
    .use(notificationsRoutes(notificationsController, auth))
    .use(publicRoutes(publicController, auth))
    .use(platformAdminRoutes(platformAdminController, auth))
    .use(supportRoutes(supportController, auth))
    .use(moderationRoutes(moderationController, auth))
    .use(searchRoutes(searchController, auth))
    .use(analyticsRoutes(analyticsController, auth))
    .use(exportsRoutes(exportsController, auth))
    .use(filesRoutes(filesController, auth))
    .use(integrationsRoutes(integrationsController, auth))
    .use(innovationPortfolioRoutes(innovationPortfolioController, auth))
    .use(auditRoutes(auditController, auth))
}

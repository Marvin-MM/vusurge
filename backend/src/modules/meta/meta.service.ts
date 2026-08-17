import type { AppConfig } from '../../shared/config'
import type { FileScanner } from '../../shared/file-scanning'
import { type Page, type PaginationLimits, toPageRequest } from '../../shared/http'
import type { MetaRepository, SkillRow, TechnologyTagRow } from './meta.repository'

export interface MetaService {
  listSkills(input: { q?: string; limit?: number; cursor?: string }): Promise<Page<SkillRow>>
  listTechnologyTags(input: {
    q?: string
    limit?: number
    cursor?: string
  }): Promise<Page<TechnologyTagRow>>
  capabilities(): Promise<Omit<AppConfig['features'], 'openApiUi'>>
}

export function createMetaService(
  repository: MetaRepository,
  config: AppConfig,
  fileScanner: FileScanner,
  limits: PaginationLimits,
): MetaService {
  return {
    async listSkills(input) {
      const page = toPageRequest(input, limits)
      // Free-text search input is normalized (trimmed, bounded) before it
      // ever reaches a query; it is never interpolated into raw SQL.
      const query = input.q?.trim().slice(0, 100)
      return repository.listSkills(query === '' ? undefined : query, page)
    },

    async listTechnologyTags(input) {
      const page = toPageRequest(input, limits)
      const query = input.q?.trim().slice(0, 100)
      return repository.listTechnologyTags(query === '' ? undefined : query, page)
    },

    async capabilities() {
      const scannerHealthy =
        fileScanner.available && (await fileScanner.healthCheck().catch(() => false))
      return {
        // These are operational capabilities, not configuration echoes. A
        // route or provider that is missing/ill must never be advertised.
        sseNotifications: config.features.sseNotifications,
        documentUploads:
          config.features.documentUploads && config.objectStorage.enabled && scannerHealthy,
        slackIntegration: config.features.slackIntegration,
        discordIntegration: config.features.discordIntegration,
        unlistedChallenges: config.features.unlistedChallenges,
        openAuthenticatedParticipation: config.features.openAuthenticatedParticipation,
        mentorRole: config.features.mentorRole,
        directInnovationIntake: config.features.directInnovationIntake,
      }
    },
  }
}

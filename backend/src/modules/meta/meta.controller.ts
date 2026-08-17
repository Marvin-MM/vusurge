import type { MetaService } from './meta.service'

export interface MetaController {
  listSkills(query: {
    q?: string
    limit?: number
    cursor?: string
  }): ReturnType<MetaService['listSkills']>
  listTechnologyTags(query: {
    q?: string
    limit?: number
    cursor?: string
  }): ReturnType<MetaService['listTechnologyTags']>
  capabilities(): ReturnType<MetaService['capabilities']>
}

export function createMetaController(service: MetaService): MetaController {
  return {
    listSkills: (query) => service.listSkills(query),
    listTechnologyTags: (query) => service.listTechnologyTags(query),
    capabilities: () => service.capabilities(),
  }
}

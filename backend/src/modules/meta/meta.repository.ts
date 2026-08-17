import type { PrismaClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export interface SkillRow {
  id: string
  name: string
  slug: string
  category: string | null
  createdAt: Date
}

export interface TechnologyTagRow {
  id: string
  name: string
  slug: string
  category: string | null
  createdAt: Date
}

export interface MetaRepository {
  listSkills(query: string | undefined, page: PageRequest): Promise<Page<SkillRow>>
  listTechnologyTags(query: string | undefined, page: PageRequest): Promise<Page<TechnologyTagRow>>
}

export function createMetaRepository(client: PrismaClient): MetaRepository {
  return {
    async listSkills(query, page) {
      const rows = await client.skill.findMany({
        where: {
          active: true,
          ...(query
            ? {
                name: { contains: query, mode: 'insensitive' },
              }
            : {}),
          ...(page.cursor
            ? {
                OR: [
                  { createdAt: { lt: new Date(page.cursor.at) } },
                  { createdAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })

      return buildPage(rows, page, (row) => ({ at: row.createdAt.toISOString(), id: row.id }))
    },

    async listTechnologyTags(query, page) {
      const rows = await client.technologyTag.findMany({
        where: {
          active: true,
          ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
          ...(page.cursor
            ? {
                OR: [
                  { createdAt: { lt: new Date(page.cursor.at) } },
                  { createdAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })

      return buildPage(rows, page, (row) => ({ at: row.createdAt.toISOString(), id: row.id }))
    },
  }
}

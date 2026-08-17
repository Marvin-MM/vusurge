import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * The public, unauthenticated `/meta` catalogue endpoints. Technology tags
 * mirror the pre-existing skill catalogue exactly (curated/seeded, not
 * derived from private cross-tenant submission data), so seeding rows
 * directly through the migration connection matches how a real deployment's
 * seed script populates the table.
 */

let app: TestApp
let migration: Client

beforeAll(async () => {
  app = await createTestApp()
  migration = await connectMigrationSql()
})

afterAll(async () => {
  await app.dispose()
  await migration.end()
})

beforeEach(async () => {
  await resetDatabase(migration)
})

async function seedTechnologyTag(name: string, active = true): Promise<string> {
  const id = Bun.randomUUIDv7()
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  await migration.query(
    `insert into technology_tag (id, name, slug, category, active) values ($1, $2, $3, $4, $5)`,
    [id, name, slug, 'language', active],
  )
  return id
}

describe('meta: technology tags', () => {
  test('lists active technology tags and supports a search query', async () => {
    await seedTechnologyTag('TypeScript')
    await seedTechnologyTag('Kubernetes')
    await seedTechnologyTag('Retired Framework', false)

    const list = await app.request<{ items: { id: string; name: string }[] }>(
      'GET',
      '/api/v1/meta/technology-tags',
    )
    expect(list.status).toBe(200)
    const names = list.body.items.map((item) => item.name).sort()
    expect(names).toEqual(['Kubernetes', 'TypeScript'])

    const searched = await app.request<{ items: { name: string }[] }>(
      'GET',
      '/api/v1/meta/technology-tags?q=type',
    )
    expect(searched.status).toBe(200)
    expect(searched.body.items).toHaveLength(1)
    expect(searched.body.items[0]?.name).toBe('TypeScript')
  })

  test('does not require authentication', async () => {
    const response = await app.request('GET', '/api/v1/meta/technology-tags')
    expect(response.status).toBe(200)
  })

  test('reports operational capabilities rather than configured-but-missing features', async () => {
    const response = await app.request<{
      sseNotifications: boolean
      documentUploads: boolean
      slackIntegration: boolean
      discordIntegration: boolean
    }>('GET', '/api/v1/meta/capabilities')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      sseNotifications: false,
      documentUploads: false,
      slackIntegration: false,
      discordIntegration: false,
    })
  })
})

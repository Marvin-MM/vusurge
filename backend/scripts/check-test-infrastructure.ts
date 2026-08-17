import { Redis } from 'ioredis'
import { Client } from 'pg'
import { loadTestConfig, testMigrationDatabaseUrl } from '../tests/helpers/test-config'

const CONNECTION_TIMEOUT_MS = 2_000

function describeFailure(reason: unknown): string {
  if (reason instanceof Error) return reason.message.split('\n')[0] ?? reason.name
  return String(reason)
}

async function probePostgres(name: string, url: string): Promise<string> {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  })
  try {
    await client.connect()
    await client.query('select 1')
    return name
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function probeRedis(name: string, url: string): Promise<string> {
  const redis = new Redis(url, {
    lazyConnect: true,
    connectTimeout: CONNECTION_TIMEOUT_MS,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  })
  // The result is reported once below; suppress the client's additional
  // EventEmitter diagnostic so one missing service does not flood test output.
  redis.on('error', () => undefined)
  try {
    await redis.connect()
    await redis.ping()
    return name
  } finally {
    redis.disconnect(false)
  }
}

const config = loadTestConfig()
const probes = [
  ['runtime PostgreSQL', () => probePostgres('runtime PostgreSQL', config.database.url)],
  ['migration PostgreSQL', () => probePostgres('migration PostgreSQL', testMigrationDatabaseUrl())],
  ['cache Redis', () => probeRedis('cache Redis', config.cacheRedis.url)],
  ['queue Redis', () => probeRedis('queue Redis', config.queueRedis.url)],
] as const

const results = await Promise.allSettled(probes.map(([, probe]) => probe()))
const failures = results.flatMap((result, index) =>
  result.status === 'rejected'
    ? [`- ${probes[index]?.[0] ?? 'unknown dependency'}: ${describeFailure(result.reason)}`]
    : [],
)

if (failures.length > 0) {
  throw new Error(
    `Test infrastructure preflight failed. No test files were started.\n${failures.join('\n')}\n` +
      'Start the isolated test services and apply the baseline migration before retrying.',
  )
}

console.log(`Test infrastructure ready: ${results.length} dependency checks passed.`)

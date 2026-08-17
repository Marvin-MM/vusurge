/**
 * Export the OpenAPI specification to docs/openapi.json.
 *
 * The document is generated from the DTO schemas attached to each route, so it
 * cannot drift from the implementation: a changed request or response shape
 * changes the specification automatically.
 *
 * CI runs this and fails on a diff, which makes an undocumented contract change
 * a build failure rather than something a client discovers in production.
 *
 * Usage:
 *   bun run openapi:generate
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createApp } from '../src/app'
import { buildInfrastructure, shutdownInfrastructure } from '../src/container'
import { ConfigurationError } from '../src/shared/config'
import { routePolicy } from '../src/shared/http'

type OpenApiDocument = Record<string, unknown> & {
  paths?: Record<string, unknown>
  components?: Record<string, Record<string, unknown>>
  tags?: Array<{ name?: string } & Record<string, unknown>>
}

function joinOpenApiPath(prefix: string, path: string): string {
  return `${prefix.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

/** Merge Better Auth's exact endpoint contract into the application schema. */
function mergeAuthSchema(application: OpenApiDocument, auth: OpenApiDocument, basePath: string) {
  const applicationPaths = application.paths ?? {}
  const authPaths = auth.paths ?? {}

  for (const [path, operations] of Object.entries(authPaths)) {
    const mountedPath = joinOpenApiPath(basePath, path)
    if (applicationPaths[mountedPath] !== undefined) {
      throw new Error(`OpenAPI path collision while mounting Better Auth: ${mountedPath}`)
    }
    applicationPaths[mountedPath] = operations
  }
  application.paths = applicationPaths

  const applicationComponents = application.components ?? {}
  for (const [section, values] of Object.entries(auth.components ?? {})) {
    applicationComponents[section] = {
      ...(applicationComponents[section] ?? {}),
      ...values,
    }
  }
  application.components = applicationComponents

  const tags = application.tags ?? []
  const tagNames = new Set(tags.map((tag) => tag.name).filter(Boolean))
  for (const tag of auth.tags ?? []) {
    if (tag.name !== undefined && !tagNames.has(tag.name)) {
      tags.push(tag)
      tagNames.add(tag.name)
    }
  }
  application.tags = tags
}

function annotateRoutePolicies(document: OpenApiDocument) {
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    if (typeof pathItem !== 'object' || pathItem === null) continue
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) continue
      if (typeof operation !== 'object' || operation === null) continue
      const operationObject = operation as Record<string, unknown>
      const policy = routePolicy(method, path)
      operationObject['x-route-policy'] = policy

      // CSRF is enforced by the authentication-context plugin before route
      // handlers, so it has no per-route TypeBox header schema for Elysia to
      // export. Materialize that cross-cutting request contract here.
      if (policy.csrf === 'required') {
        const parameters = Array.isArray(operationObject['parameters'])
          ? (operationObject['parameters'] as Array<Record<string, unknown>>)
          : []
        if (
          !parameters.some(
            (parameter) =>
              parameter['in'] === 'header' &&
              String(parameter['name']).toLowerCase() === 'x-csrf-token',
          )
        ) {
          parameters.push({
            name: 'X-CSRF-Token',
            in: 'header',
            required: true,
            description: 'Session-bound token obtained from GET /api/v1/me/csrf-token.',
            schema: { type: 'string', minLength: 43, maxLength: 43 },
          })
          operationObject['parameters'] = parameters
        }
      }
    }
  }
}

async function main(): Promise<void> {
  // The specification is built from route metadata alone; no dependency is
  // contacted, but the infrastructure graph is still assembled because the app
  // is wired from it.
  const infrastructure = buildInfrastructure()

  try {
    const app = createApp({ infrastructure })

    const response = await app.handle(
      new Request(`${infrastructure.config.app.publicBaseUrl}/openapi/json`),
    )

    if (!response.ok) {
      throw new Error(`OpenAPI generation returned HTTP ${response.status}`)
    }

    const document = (await response.json()) as OpenApiDocument
    const authDocument = (await infrastructure.auth.api.generateOpenAPISchema()) as OpenApiDocument
    mergeAuthSchema(document, authDocument, infrastructure.config.auth.basePath)
    annotateRoutePolicies(document)

    const outputDirectory = join(import.meta.dir, '..', 'docs')
    mkdirSync(outputDirectory, { recursive: true })

    const outputPath = join(outputDirectory, 'openapi.json')
    // Stable key order and trailing newline so the CI diff check is meaningful.
    writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')

    const paths = document['paths'] as Record<string, unknown> | undefined
    console.log(`Wrote ${outputPath}`)
    console.log(`  paths documented: ${paths === undefined ? 0 : Object.keys(paths).length}`)
  } finally {
    await shutdownInfrastructure(infrastructure)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    if (error instanceof ConfigurationError) {
      console.error(error.message)
      process.exit(78)
    }
    console.error('OpenAPI generation failed:', error)
    process.exit(1)
  })

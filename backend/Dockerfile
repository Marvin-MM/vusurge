# Multi-target production image for the API and worker processes.
#
# Both processes run the same codebase and the same image; only the entrypoint
# and PROCESS_ROLE differ. Build them with:
#
#   docker build --target api    -t innovation-platform-api .
#   docker build --target worker -t innovation-platform-worker .
#
# The build needs no database: the Prisma client (including TypedSQL artefacts)
# is committed to the repository precisely so that image builds and clean
# checkouts work offline. See docs/adr/0019-prisma-7-generated-client-and-typedsql.md.

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
FROM oven/bun:1.3.13-alpine@sha256:4de475389889577f346c636f956b42a5c31501b654664e9ae5726f94d7bb5349 AS dependencies

WORKDIR /app

# Copied alone so the dependency layer is only rebuilt when the manifest or
# lockfile changes, not on every source edit.
COPY package.json bun.lock ./

# --frozen-lockfile: the build fails rather than silently resolving a different
# dependency tree than the one that was tested.
# Optional peer auto-installation can retain root dev tools (notably the native
# TypeScript compiler) even in production mode. Every runtime peer we use is a
# direct dependency, so omit peer auto-installation to keep the image minimal.
RUN bun install --frozen-lockfile --production --omit peer

# ---------------------------------------------------------------------------
# Build-time verification
# ---------------------------------------------------------------------------
FROM oven/bun:1.3.13-alpine@sha256:4de475389889577f346c636f956b42a5c31501b654664e9ae5726f94d7bb5349 AS verify

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json biome.json .gitignore ./
COPY src ./src
COPY prisma ./prisma
COPY scripts ./scripts
COPY tests ./tests

# A type error or lint violation fails the image build, so a broken artefact
# can never be pushed.
RUN bunx tsc --noEmit && bunx biome check .

# ---------------------------------------------------------------------------
# Shared runtime layer
# ---------------------------------------------------------------------------
FROM oven/bun:1.3.13-alpine@sha256:4de475389889577f346c636f956b42a5c31501b654664e9ae5726f94d7bb5349 AS runtime

WORKDIR /app

# The Bun tag is immutable-pinned, but Alpine security packages continue to
# receive fixes after that image is published. Apply those fixes at build time;
# the blocking image scan below the build pipeline prevents regressions.
RUN apk upgrade --no-cache libcrypto3 libssl3

# Unprivileged user. The bun image already provides uid/gid 1000 as `bun`.
ENV NODE_ENV=production

COPY --from=dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun package.json bun.lock tsconfig.json prisma.config.ts ./
COPY --chown=bun:bun src ./src
COPY --chown=bun:bun prisma ./prisma
COPY --chown=bun:bun scripts ./scripts

# Ensure verification ran before anything is shipped.
COPY --from=verify /app/package.json /tmp/verified.json

USER bun

# ---------------------------------------------------------------------------
# API process
# ---------------------------------------------------------------------------
FROM runtime AS api

ENV PROCESS_ROLE=api
EXPOSE 3000

# Liveness only: readiness is polled by the orchestrator against /health/ready,
# which must not restart the container when a dependency is briefly down.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD bun --eval "fetch('http://127.0.0.1:' + (process.env.PORT ?? 3000) + '/health/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Exec form so the process receives SIGTERM directly and can drain gracefully.
CMD ["bun", "run", "src/index.ts"]

# ---------------------------------------------------------------------------
# Worker process
# ---------------------------------------------------------------------------
FROM runtime AS worker

ENV PROCESS_ROLE=worker

# The worker serves no HTTP traffic; its health is observed through queue and
# outbox metrics rather than an endpoint.
CMD ["bun", "run", "src/worker.ts"]

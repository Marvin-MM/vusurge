# syntax=docker/dockerfile:1.7
#
# Multi-target production image for the API and worker processes.
#
# Both processes run the same codebase and the same image; only the entrypoint
# and PROCESS_ROLE differ. Build them with:
#
#   docker build --target api    -t innovation-platform-api    --build-arg GIT_SHA=$(git rev-parse HEAD) .
#   docker build --target worker -t innovation-platform-worker --build-arg GIT_SHA=$(git rev-parse HEAD) .
#
# The build needs no database: the Prisma client (including TypedSQL artefacts)
# is committed to the repository precisely so that image builds and clean
# checkouts work offline. See docs/adr/0019-prisma-7-generated-client-and-typedsql.md.
#
# Because the client is committed, `bun install` here never needs to run a
# generate step, which is why every install below runs with --ignore-scripts:
# @prisma/client ships a postinstall that shells out to the `prisma` CLI, and
# that CLI is a devDependency that --production installs deliberately exclude.
# Without --ignore-scripts, `bun install --production` would fail trying to
# invoke a binary that isn't there. Ignoring lifecycle scripts everywhere also
# closes off the most common supply-chain-attack vector in the JS ecosystem
# (a compromised transitive dependency running arbitrary code at install time).

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
# --omit peer: every runtime peer we use is a direct dependency, so peer
# auto-installation would only pull in unused packages (or root dev tools).
# --ignore-scripts: see header note above.
# Cache mount: speeds up repeated CI builds without adding anything to the
# final image — cache mounts are never committed to a layer.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --omit peer --ignore-scripts

# Because --ignore-scripts suppresses all postinstall steps, we must manually
# trigger the Prisma engines download. Without this, the schema-engine binary
# is missing and `prisma migrate deploy` crashes in the initContainer.
RUN bun run ./node_modules/@prisma/engines/scripts/postinstall.js

# ---------------------------------------------------------------------------
# Build-time verification
# ---------------------------------------------------------------------------
FROM oven/bun:1.3.13-alpine@sha256:4de475389889577f346c636f956b42a5c31501b654664e9ae5726f94d7bb5349 AS verify

WORKDIR /app

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts

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
# the blocking image scan in CI catches anything that regresses.
RUN apk upgrade --no-cache libcrypto3 libssl3

ARG BUILD_VERSION=0.0.0-unknown
ARG GIT_SHA=unknown

ENV NODE_ENV=production
ENV BUILD_VERSION=${BUILD_VERSION}
# Also expose GIT_SHA at runtime so health/info endpoints can report the
# exact commit without relying on OCI label inspection.
ENV GIT_SHA=${GIT_SHA}

# Standard OCI labels. org.opencontainers.image.source is what makes a
# container registry auto-link this package back to the repository, and
# .revision is what lets you go from "what's actually running in prod"
# (kubectl describe pod) straight back to the exact commit, without
# trusting a mutable tag to tell you the truth.
# TODO: replace OWNER/REPO with the real GitHub org/repo slug before
# pushing to any registry.
LABEL org.opencontainers.image.title="innovation-platform-backend" \
      org.opencontainers.image.source="https://github.com/OWNER/REPO" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.licenses="UNLICENSED"

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
EXPOSE 8080

# Liveness only: readiness is polled by the orchestrator against /health/ready,
# which must not restart the container when a dependency is briefly down.
# (Kubernetes ignores this HEALTHCHECK and uses its own probes — see the
# deployment manifest — but it still matters for `docker run` and any
# non-k8s host that runs this image directly.)
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD bun --eval "fetch('http://127.0.0.1:' + (process.env.PORT ?? 8080) + '/health/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Exec form so the process receives SIGTERM directly and can drain gracefully.
CMD ["bun", "run", "src/index.ts"]

# ---------------------------------------------------------------------------
# Worker process
# ---------------------------------------------------------------------------
FROM runtime AS worker

ENV PROCESS_ROLE=worker

# The worker serves no HTTP traffic, so there is no meaningful HEALTHCHECK to
# write here. Its health is observed through queue and outbox metrics rather
# than an endpoint — the k8s manifest calls this out explicitly rather than
# faking a TCP probe that would tell you the process exists but not that it's
# doing anything.
CMD ["bun", "run", "src/worker.ts"]
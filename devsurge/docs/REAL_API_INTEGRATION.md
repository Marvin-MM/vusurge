# DevArena — Real API Integration Guide

This document outlines the seamless transition pathway from DevArena's frontend mock transport layer to the production **Bun / Elysia / Node.js** backend at `/api/v1`.

---

## 1. Architectural Architecture & Migration Path

DevArena is engineered with strict separation of concerns, meaning the UI components never directly touch mock fixtures or transport-level mechanics.

```text
Current (Mock Dev Transport):
React Component
  └── Feature Query / Mutation Hook (e.g. useChallenge, useSubmitScorecard)
        └── TanStack Query (Caching, Invalidations, Optimistic states)
              └── Axios Client (apiClient in @/api/client/axiosClient)
                    └── Mock Adapter Interceptor (handleMockRequest in @/mocks)

Future (Production Backend):
React Component
  └── SAME Feature Query / Mutation Hook
        └── SAME TanStack Query Keys & Policies
              └── SAME Axios Client (with VITE_DATA_MODE=api)
                    └── Bun / Elysia / Node /api/v1 Backend HTTP Server
```

To switch from Mock mode to Real API mode:
1. Set `VITE_DATA_MODE=api` in `.env`.
2. Set `VITE_API_BASE_URL=https://api.devarena.io/api/v1` (or relative `/api/v1`).
3. Deploy the Elysia/Bun backend handling the endpoints outlined below.

---

## 2. Authentication & Session Seam

### Authentication Strategy
* **Cookie / Bearer Hybrid**:
  * The production Axios client (`apiClient`) automatically attaches `Authorization: Bearer <jwt>` from `localStorage.getItem("devarena_auth_token")` if present.
  * In production deployments, prefer `httpOnly`, `Secure`, `SameSite=Lax` session cookies.
* **Tenant Scoping Header**:
  * Organization-scoped requests include the tenant parameter in the URL route: `/api/v1/orgs/:orgId/...` or in the header `X-DevArena-Org-Id`.

---

## 3. Global Response & Error Envelope Contract

All endpoints follow the standard DevArena JSON envelope:

### Success Response:
```json
{
  "status": "success",
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 142,
    "totalPages": 8
  }
}
```

### Error Response:
```json
{
  "status": "error",
  "code": "PERMISSION_DENIED",
  "message": "User does not hold the ORG_ADMIN role for organization org-apex-labs.",
  "errors": [
    {
      "field": "role",
      "message": "Minimum role requirement: ORG_ADMIN"
    }
  ]
}
```

---

## 4. Query Key Strategy & Cache Synchronization

Query keys are centralized in `@/api/query-keys`. Invalidation triggers map to backend mutations as follows:

| Mutation | Invalidation Target | Notes |
| :--- | :--- | :--- |
| `POST /api/v1/submissions` | `queryKeys.submissions.all` | Invalidates user submission lists & org pool |
| `POST /api/v1/judging/scorecards` | `queryKeys.judging.assignments()`, `queryKeys.judging.scorecards()` | Refetches judge progress |
| `POST /api/v1/challenges/:id/publish-results` | `queryKeys.challenges.detail(id)`, `queryKeys.results.all` | Unlocks official leaderboard |
| `POST /api/v1/orgs/:id/members` | `queryKeys.organizations.members(id)` | Refreshes RBAC directory table |
| `POST /api/v1/teams/:id/members` | `queryKeys.teams.detail(id)`, `queryKeys.teams.myTeam(chalId)` | Updates team roster |

---

## 5. File Uploads & Cloud Storage Strategy

1. **Pre-signed URL Pattern**:
   * Participant calls `POST /api/v1/storage/upload-intent` with `{ filename, contentType, fileSize, target: "SUBMISSION_ARTIFACT" | "AVATAR" | "CHALLENGE_COVER" }`.
   * Server returns `{ uploadUrl, fileKey, publicUrl }`.
   * Client uploads directly to GCS/S3 with a PUT request.
   * Client includes `publicUrl` and `fileKey` in the form payload.

2. **Screenshot Limit Constraint**:
   * Submissions strictly limit screenshots to a maximum of 4 images. Pre-upload validation enforces this client-side and server-side.

---

## 6. Real API Route Map (Elysia / Bun Specification)

```text
Authentication:
POST   /api/v1/auth/signin
POST   /api/v1/auth/signup
POST   /api/v1/auth/signout
GET    /api/v1/auth/me

Organizations:
GET    /api/v1/orgs
GET    /api/v1/orgs/:orgId
PATCH  /api/v1/orgs/:orgId
GET    /api/v1/orgs/:orgId/members
POST   /api/v1/orgs/:orgId/members/invite
DELETE /api/v1/orgs/:orgId/members/:userId
GET    /api/v1/orgs/:orgId/join-codes
POST   /api/v1/orgs/:orgId/join-codes
GET    /api/v1/orgs/:orgId/audit-logs
GET    /api/v1/orgs/:orgId/analytics

Challenges:
GET    /api/v1/challenges
GET    /api/v1/challenges/:id
POST   /api/v1/challenges
PATCH  /api/v1/challenges/:id
POST   /api/v1/challenges/:id/publish
POST   /api/v1/challenges/:id/publish-results
GET    /api/v1/challenges/:id/participants
POST   /api/v1/challenges/:id/register

Submissions & Teams:
GET    /api/v1/challenges/:id/teams
POST   /api/v1/challenges/:id/teams
POST   /api/v1/challenges/:id/submissions
PATCH  /api/v1/submissions/:id
POST   /api/v1/submissions/:id/finalize
POST   /api/v1/submissions/:id/disqualify

Judging:
GET    /api/v1/judging/assignments
GET    /api/v1/judging/submissions/:id/evaluation
POST   /api/v1/judging/scorecards
POST   /api/v1/judging/conflicts

Superadmin Governance:
GET    /api/v1/admin/organizations
POST   /api/v1/admin/organization-applications/:id/approve
POST   /api/v1/admin/organization-applications/:id/reject
GET    /api/v1/admin/moderation/reports
POST   /api/v1/admin/moderation/reports/:id/resolve
GET    /api/v1/admin/audit-logs
GET    /api/v1/admin/system/health
PATCH  /api/v1/admin/system/settings
```

# Backend Migration Report

## Summary

The holistic health app has been split from a Next.js full-stack monolith
into a pnpm-workspaces monorepo: `packages/core` (the domain layer, shared
as `@health/core`), `apps/web` (Next.js 16 frontend on Vercel — UI only),
and `apps/api` (Fastify 5 backend on Render — all data routes). The 12
endpoints previously served by Next.js route handlers are now Fastify
routes with schema-first Zod validation, a shared `respond()` helper that
maps `Result<T>` to HTTP responses, and a shared-secret cookie auth plugin.
Test suite is fully green (53 core + 44 api = 97 passing), `pnpm --filter
@health/web build` succeeds with three static routes, and the server boots
cleanly under `tsx`.

## File moves (summary)

- **`packages/core/src/`** — 30 files lifted from `src/core/` (models,
  ports, services, usecases), `src/infrastructure/` (adapters), and
  `src/container.ts`. Imports collapse one directory level
  (`../core/models/...` → `../models/...`). Server-only Next.js guardrails
  (`import 'server-only'`) removed from container + adapters and replaced
  with a runtime `typeof window` check in container, since `tsx` would
  otherwise throw at import time. `packages/core/test/server-only-stub.ts`
  moved with the rest.
- **`apps/web/src/app/`** — Next.js shell only: `layout.tsx`, `page.tsx`,
  `globals.css`, `favicon.ico`, plus the new `/login` page. Configs
  (`next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`,
  `next-env.d.ts`) and `public/` SVGs moved out of repo root into
  `apps/web/`. No `/api` directory in the web tree.
- **`apps/api/`** — entirely new: Fastify bootstrap (`src/index.ts`),
  test-mode bootstrap (`src/testApp.ts`), auth plugin
  (`src/plugins/auth.ts`), `respond()` helper (`src/lib/respond.ts`),
  9 route modules and matching 9 test files. Plus deployment artifacts:
  `Dockerfile`, `render.yaml`, `vitest.config.ts`.
- **Root** — replaced `package.json` (devDeps + workspace scripts only),
  added `pnpm-workspace.yaml` and `tsconfig.base.json`. Removed legacy
  `tsconfig.json`, root `vitest.config.ts`, `package-lock.json`, and the
  full `src/` tree.

## New routes / endpoints created

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Set auth cookie (shared-secret) |
| POST | `/api/auth/logout` | Clear auth cookie |
| GET | `/api/dashboard` | Dashboard summary for a date |
| GET | `/api/meals` | List meals for a date |
| POST | `/api/meals` | Save a new meal |
| POST | `/api/meals/identify` | Identify foods from a photo (Claude Vision) |
| GET | `/api/supplements` | List supplement stack |
| POST | `/api/supplements` | Add a supplement |
| GET | `/api/supplements/logs` | Dose logs for a date |
| POST | `/api/supplements/logs` | Log a supplement dose |
| POST | `/api/sync` | Sync wearable data for today |
| POST | `/api/health/import` | Import Apple Health export rows |
| GET | `/api/oura/auth` | Redirect to Oura OAuth |
| GET | `/api/oura/callback` | Exchange OAuth code, redirect to web |

All non-auth/oura-callback routes require the `auth` cookie (set by
`/api/auth/login`); the auth plugin enforces this globally via an
`onRequest` hook wrapped in `fastify-plugin`.

## Tests

- **Total passing**: 97 (53 in `packages/core`, 44 in `apps/api`).
- **`packages/core`** (7 files, unchanged from the pre-migration suite):
  domain models, services, usecases, and the SupabaseAdapter /
  SupabaseStorageAdapter / ClaudeVisionAdapter integration tests.
- **`apps/api`** (9 files, all new): one per route module. Each covers
  the happy path (200, or 201 on create), Zod schema validation (400),
  and service-layer failure (500). Auth tests assert cookie behavior
  end-to-end; Oura callback tests assert all four redirect branches
  (no code / token-exchange-fail / invalid-shape / success).
- **Pattern**: route tests build the app via `buildTestApp()` and use
  Fastify's `app.inject()` — no real network, no real DB. Container is
  mocked via `vi.mock('@health/core/container', () => …)` with closure
  variables hoisted through `vi.hoisted` so the lifted factory can
  reference them.
- **Stub env**: `apps/api/vitest.config.ts` seeds
  `SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/ANTHROPIC_API_KEY/AUTH_SECRET/COOKIE_SECRET`
  with dummy values so the container can be constructed in tests that
  don't mock it (e.g. `auth.test.ts`).

## Design decisions worth reviewing

### 1. `@health/core` ships TypeScript source, no build step
**Decision**: `packages/core/package.json` sets `main`/`types` to
`./src/index.ts`; both apps consume it directly via `tsx` (api) or
Next.js/Turbopack (web).
**Alternative considered**: Pre-compile to `dist/`.
**Why not**: No watch-mode split, no double-compile cost. The web build
inlines the source into Next's bundle anyway; the api process runs under
`tsx` in both dev and prod.

### 2. Auth via shared-secret cookie, not JWT
**Decision**: `POST /api/auth/login` compares `body.password` to
`AUTH_SECRET` and sets an httpOnly `auth` cookie. The global onRequest
hook checks `request.cookies.auth === AUTH_SECRET`. Skip list is
`/api/auth/login` and `/api/oura/callback`.
**Alternative considered**: JWT with short expiry + refresh.
**Why not**: Single-user personal app. JWT machinery (sign, verify,
rotate, refresh) is pure overhead here. Shared secret is auditable in
one file and trivially rotatable.

### 3. `fastify-type-provider-zod` bumped from 4.x to 6.x
**Decision**: Zod 4 dropped the `.errors` getter (issues live under
`.issues`). `fastify-type-provider-zod@4.0.2` still calls
`error.errors.map(...)`, which produced a confusing
`Cannot read properties of undefined (reading 'map')` 500 for every
validation failure. 6.0.0 is the first version that declares
`zod >= 4.1.5` as a peer.
**Why this matters**: All 11 "returns 400 on bad input" tests fail
silently otherwise — they get 500s instead.

### 4. Removed `import 'server-only'` from packages/core
**Decision**: The barrel `import 'server-only'` was a Next.js convention
that throws at runtime in plain Node, blocking `tsx` from importing
`packages/core/container.ts`. Replaced with a runtime
`if (typeof globalThis.window !== 'undefined') throw …` in container.ts.
**Why not just stub server-only?** A package-level stub is easy to
forget when the next adapter is added. A runtime check is grepable, and
the check fires on real browser execution (the only place that ever
mattered) instead of on every Node import.

### 5. `vi.mock` factories captured via `vi.hoisted`
**Decision**: Each route test that needs to control a service method has
its mocks declared like
`const { mockX } = vi.hoisted(() => ({ mockX: vi.fn() }))`.
**Why**: Vitest hoists `vi.mock` calls above all imports — including
above the `const mockX = vi.fn()` declaration. Without `vi.hoisted`, the
factory closes over `undefined` and the test crashes at app build time
with `ReferenceError: Cannot access 'mockX' before initialization`.

### 6. Apple Health / supplement usecase mocked at the use-case boundary
**Decision**: For routes that wire a use-case (e.g.
`mealsIdentify` → `logMealFromPhoto`, `sync` → `syncWearableData`,
`supplementsLogs POST` → `logSupplement`,
`healthImport` → `importAppleHealthExport`), the tests
`vi.mock` the use-case module rather than reconstruct the entire service
graph through the container mock.
**Why**: Use-cases fan out to multiple services and external calls.
Mocking the use-case boundary is the minimal, brittle-free seam.

### 7. `apps/api` is "type": "module"
**Decision**: Required for top-level `await app.register(...)` in
`src/index.ts` under `tsx` (without it, esbuild's CJS transform rejects
top-level await). `packages/core` stays implicit-CJS-compatible because
it's consumed as raw `.ts` and never has top-level await.

## Deployment readiness

### Ready to ship
- **`apps/api/Dockerfile`** — Node 24-slim, corepack-pnpm, workspace
  install with `--frozen-lockfile`, `pnpm --filter @health/api start`
  (= `tsx src/index.ts`). Includes the workspace lockfile in the copy
  list so the frozen install works.
- **`apps/api/render.yaml`** — docker runtime, `PORT=3001`,
  `NODE_ENV=production`, `LOG_LEVEL=info`. All secrets documented as
  required env vars in the file's commented header; values must be set
  in the Render dashboard.
- **`apps/web`** — builds cleanly under Next.js 16 / Turbopack. Three
  routes total: `/`, `/login`, `/_not-found`. No `/api/*` in the route
  table.
- **`.env.local.example`** — covers all variables across both apps,
  grouped by where they belong (apps/api vs apps/web), with stub values
  appropriate for local dev (api on `:3001`, web on `:3000`).

### Requires manual setup
- Render account; new web service pointed at this repo with the
  `apps/api/Dockerfile` path.
- Render env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`, `OURA_REDIRECT_URI` (the
  Render URL + `/api/oura/callback`), `ANTHROPIC_API_KEY`, `AUTH_SECRET`,
  `COOKIE_SECRET`, `WEB_ORIGIN` (the Vercel URL).
- Vercel project: reconnect or recreate with root directory =
  `apps/web`. Vercel env var: `NEXT_PUBLIC_API_URL` = the Render URL.
- Oura developer dashboard: update redirect URI from
  `https://…vercel.app/api/oura/callback` to
  `https://…onrender.com/api/oura/callback`.

## TODOs left for the user

1. Push `backend-migration` once you've reviewed the diff.
2. Create the Render web service for `apps/api` (Docker runtime).
3. Set all `apps/api` env vars in Render and trigger a first deploy.
4. In Vercel, change the project root to `apps/web` (or recreate the
   project) and add `NEXT_PUBLIC_API_URL`.
5. Update the Oura redirect URI to the Render host.
6. End-to-end smoke test from the Vercel URL: visit `/login`, sign in,
   land on `/`, and verify the auth cookie is set on the Render origin
   (`SameSite=None; Secure` will be required when crossing TLD).
7. Once the dashboard hooks are built (post-migration work), confirm
   they fetch with `credentials: 'include'`.

## Commits on `backend-migration` branch

```
53e028d chore: restructure into pnpm workspaces (apps/web + packages/core)
fde9d08 feat(api): bootstrap Fastify server with all 12 endpoints
e21d634 test(api): port route tests to Fastify app.inject() pattern
50b7533 feat(web): switch hooks to NEXT_PUBLIC_API_URL; add /login page
(this commit) docs: update CLAUDE.md and INSTRUCTIONS.md for monorepo+Fastify
```

# INSTRUCTIONS.md — Build Guide

Step-by-step guide for building the holistic fitness app. Follow phases in order —
each builds on the last. Every decision here is made with the iOS app and agentic
layer in mind, even though neither is built yet.

---

## Prerequisites

- Node.js 20+
- Docker Desktop (for Supabase local dev)
- A [Supabase](https://supabase.com) account (free)
- A [Vercel](https://vercel.com) account (free)
- An [Oura developer app](https://cloud.ouraring.com/oauth/applications)
- An [Anthropic API key](https://console.anthropic.com)

---

## Phase 1 — Project scaffolding

### Step 1: Bootstrap the monorepo

The project uses pnpm workspaces with three packages: `packages/core` (shared
domain layer), `apps/web` (Next.js on Vercel), and `apps/api` (Fastify on Render).

```bash
# Install pnpm if needed
npm install -g pnpm

# Create workspace root files
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF

# Create directory structure
mkdir -p packages/core/src/{models,ports,services,usecases,infrastructure}
mkdir -p packages/core/test
mkdir -p apps/web/src/{app,components,hooks,store,config}
mkdir -p apps/api/src/{plugins,lib,routes}
```

Create `tsconfig.base.json` at the root with strict TS settings that all
packages extend (see repo root for the current file).

### Step 2: Bootstrap Next.js (apps/web)

```bash
cd apps/web
npx create-next-app@latest . \
  --typescript --tailwind --app --src-dir --eslint \
  --import-alias "@/*" --yes
```

`apps/web` has **no `/api` directory** — all API routes live in `apps/api`.
Add `NEXT_PUBLIC_API_URL` to `apps/web`'s `.env.local` pointing at `apps/api`.

### Step 3: Set up the Fastify API (apps/api)

```bash
cd apps/api
pnpm add fastify @fastify/cors @fastify/cookie @fastify/helmet \
  @fastify/multipart fastify-type-provider-zod fastify-plugin \
  zod tsx date-fns @health/core
pnpm add -D typescript @types/node vitest @vitest/coverage-v8
```

### Step 4: Set up Supabase CLI

```bash
pnpm add -D supabase   # or install globally
npx supabase init
npx supabase start   # starts local Postgres + Studio on localhost:54323
```

This creates `supabase/` directory. Add `supabase/.branches` and
`supabase/.temp` to `.gitignore`.

### Step 5: Set up environment variables

Copy `.env.local.example` to `.env.local` and fill in values. Key split:
- `apps/api` reads all secrets (`SUPABASE_*`, `OURA_*`, `ANTHROPIC_API_KEY`,
  `AUTH_SECRET`, `COOKIE_SECRET`, `WEB_ORIGIN`)
- `apps/web` only needs `NEXT_PUBLIC_API_URL` (the Render URL of `apps/api`)

---

## Phase 2 — Database

### Step 6: Write the migration

Copy the schema from CLAUDE.md into `supabase/migrations/001_initial_schema.sql`.

Apply it to your local Supabase:
```bash
npx supabase db push
```

Verify in Supabase Studio at `http://localhost:54323` — you should see all tables.

### Step 7: Seed your supplement stack

In `supabase/seed.sql`, insert your actual supplements. This runs once and pre-loads
your stack so you don't have to add them manually through the UI:

```sql
insert into supplements (id, name, brand, default_dose) values
  (gen_random_uuid(), 'Magnesium Glycinate', 'Thorne', '400mg before bed'),
  (gen_random_uuid(), 'Vitamin D3', 'Sports Research', '5000 IU with breakfast'),
  (gen_random_uuid(), 'Omega-3', 'Nordic Naturals', '2 capsules with dinner');
-- add your actual stack here
```

Run seed:
```bash
npx supabase db reset   # applies migrations + seed (wipes existing data)
```

---

## Phase 3 — Core domain layer

Build this layer entirely before touching Next.js or Supabase. It has no external
dependencies and can be tested with plain `tsx` scripts.

### Step 8: Result type

Create `src/core/Result.ts` using the definition in CLAUDE.md. This is used by
every service and use-case — define it first.

### Step 9: Data models

Create `src/core/models/health.ts`, `nutrition.ts`, `supplement.ts` using the
interfaces in CLAUDE.md. Add a Zod schema alongside each interface:

```typescript
// Pattern: type + validator in the same file
export const FoodItemSchema = z.object({
  name: z.string().min(1),
  portionGrams: z.number().positive(),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.enum(['ai', 'barcode', 'manual']),
})
export type FoodItem = z.infer<typeof FoodItemSchema>
```

Keep Zod schemas private to the infrastructure layer for external API responses,
and public for inter-layer data that needs validation.

### Step 10: Port interfaces

Create all four interfaces in `src/core/ports/` using the exact signatures in CLAUDE.md.
These are the only things domain services import from outside `src/core/models/`.

### Step 11: Build services

Create the four services in `src/core/services/`. Each takes its dependencies by
constructor. Implementation sketch:

```typescript
// src/core/services/NutritionService.ts
export class NutritionService {
  constructor(
    private readonly db: IDatabase,
    private readonly foodAI: IFoodAI,
  ) {}

  async getMealsForDate(date: string): Promise<Result<Meal[]>> {
    try {
      const meals = await this.db.getMeals(date)
      return ok(meals)
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  async getDailyMacros(date: string): Promise<Result<MacroSummary>> {
    const result = await this.getMealsForDate(date)
    if (!result.ok) return result
    // sum across meals
    const totals = result.value.reduce(...)
    return ok(totals)
  }
}
```

`HealthSyncService` is the one service that takes an **array** of providers
(see CLAUDE.md WF-01). It calls `getMetrics(date)` on each, merges by field
priority, and writes one row to `daily_health_metrics`:

```typescript
// src/core/services/HealthSyncService.ts
const MERGE_PRIORITY: Record<keyof DailyHealthMetrics, string[]> = {
  readiness:        ['oura'],
  hrv:              ['oura'],
  sleepScore:       ['oura'],
  sleepDuration:    ['oura'],
  deepSleepMinutes: ['oura'],
  remSleepMinutes:  ['oura'],
  bodyTempDeviation:['oura'],
  restingHR:        ['oura', 'apple-health', 'healthkit'],
  steps:            ['apple-health', 'healthkit'],
  activeCalories:   ['apple-health', 'healthkit'],
}

export class HealthSyncService {
  constructor(
    private readonly db: IDatabase,
    private readonly providers: IHealthDataProvider[],
  ) {}

  async syncDate(date: string): Promise<Result<DailyHealthMetrics>> {
    // Run all providers in parallel; one failure doesn't sink the rest
    const settled = await Promise.allSettled(
      this.providers.map(p => p.getMetrics(date).then(m => ({ source: p.sourceName, m }))),
    )
    const contributions = settled.flatMap(s =>
      s.status === 'fulfilled' ? [s.value] : []
    )
    const merged = mergeByPriority(date, contributions, MERGE_PRIORITY)
    await this.db.upsertHealthMetrics(merged)
    return ok(merged)
  }
}
```

The merge function walks each field, picks the first provider in priority
order that returned a non-undefined value, and records the contributing
provider in `sources[]`. Keep it in the same file — it's the heart of the
multi-source design.

Services never call `fetch` or import Supabase. They only call port interfaces.

### Step 12: Build use-cases

Implement each use-case in `src/core/usecases/` following the workflow definitions
in CLAUDE.md. Use-cases orchestrate multiple services and return a plain result
the UI can render directly.

The most complex is `LogMealFromPhoto.ts` (WF-02). Build it in this order:
1. Photo capture (delegate to `IImageCapture`)
2. Upload to storage (this step needs Supabase — move it to the API route for now,
   pass the storage path into the use-case)
3. Claude vision call (delegate to `IFoodAI`)
4. USDA lookup per item — call USDA FoodData Central search endpoint directly
   in this use-case, no wrapper needed
5. Return candidate meal for confirmation

The USDA lookup is a plain `fetch` inside the use-case — acceptable because it's a
pure public API with no credentials and consistent behaviour.

---

## Phase 4 — Infrastructure adapters

### Step 13: Supabase adapter

Create `src/infrastructure/SupabaseAdapter.ts`. This file is imported only by
`src/container.ts`, which is only imported by `/api/*` route handlers — never
by client components or hooks. That's why we use the service role key directly:
the adapter never runs in the browser.

```typescript
import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

export class SupabaseAdapter implements IDatabase {
  async getMeals(date: string): Promise<Meal[]> {
    const { data, error } = await supabase
      .from('meals')
      .select('*, meal_items(*)')
      .eq('date', date)
      .order('time')
    if (error) throw new Error(error.message)
    return data.map(mapDbMealToModel)
  }
  // ... rest of IDatabase methods
}
```

The `import 'server-only'` guard makes the bundler fail loudly if this file is
ever pulled into a client component — cheap insurance against accidentally
shipping the service role key to the browser.

Write a `mapDbMealToModel` mapping function for each table — keeps the DB shape
separate from the domain model shape. This is the only place column names like
`total_cals` appear; the rest of the codebase uses `totalCalories`.

### Step 14: Oura API adapter

Create `src/infrastructure/OuraApiAdapter.ts`. Implements `IHealthDataProvider`
with the new source-agnostic shape:

```typescript
export class OuraApiAdapter implements IHealthDataProvider {
  readonly sourceName = 'oura' as const

  constructor(private readonly db: IDatabase) {}

  async getMetrics(date: string): Promise<Partial<DailyHealthMetrics>> {
    const token = await this.getValidToken()
    const [readiness, sleep, activity] = await Promise.all([
      this.fetchOura('daily_readiness', date, token),
      this.fetchOura('daily_sleep',     date, token),
      this.fetchOura('daily_activity',  date, token),
    ])
    return {
      readinessScore:    readiness?.score,
      hrv:               readiness?.contributors?.hrv_balance,
      sleepScore:        sleep?.score,
      sleepDuration:     sleep?.total_sleep_duration ? sleep.total_sleep_duration / 60 : undefined,
      deepSleepMinutes:  sleep?.deep_sleep_duration ? sleep.deep_sleep_duration / 60 : undefined,
      remSleepMinutes:   sleep?.rem_sleep_duration ? sleep.rem_sleep_duration / 60 : undefined,
      bodyTempDeviation: sleep?.temperature_deviation,
      restingHR:         sleep?.lowest_heart_rate,
      steps:             activity?.steps,
      activeCalories:    activity?.active_calories,
    }
  }

  private async getValidToken(): Promise<string> {
    const tokens = await this.db.getOuraTokens()
    if (!tokens) throw new Error('Oura not connected')

    if (new Date(tokens.expiresAt) < new Date(Date.now() + 60_000)) {
      const refreshed = await this.refreshTokens(tokens.refreshToken)
      await this.db.saveOuraTokens(refreshed)
      return refreshed.accessToken
    }
    return tokens.accessToken
  }
}
```

Call `getValidToken()` before every Oura request. The adapter reads and writes
tokens via the `IDatabase` port — it never touches Supabase directly.

Oura v2 endpoints used:
```
GET https://api.ouraring.com/v2/usercollection/daily_readiness
GET https://api.ouraring.com/v2/usercollection/daily_sleep
GET https://api.ouraring.com/v2/usercollection/daily_activity
```

All take `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`. Pass the same date for both
to get a single day. Validate raw Oura responses with Zod before mapping to
`Partial<DailyHealthMetrics>` — Oura occasionally adds fields and the strict
parse catches drift.

### Step 14b: Apple Health XML adapter

Create `src/infrastructure/AppleHealthXmlAdapter.ts`. Same port as Oura — it's
the swap-in point for `HealthKitAdapter` later. This adapter doesn't parse XML;
the browser does that during import (WF-07). The adapter just reads the staging
table:

```typescript
import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

export class AppleHealthXmlAdapter implements IHealthDataProvider {
  readonly sourceName = 'apple-health' as const

  async getMetrics(date: string): Promise<Partial<DailyHealthMetrics>> {
    const { data, error } = await supabase
      .from('apple_health_daily')
      .select('steps, active_cals, resting_hr')
      .eq('date', date)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return {}
    return {
      steps:          data.steps          ?? undefined,
      activeCalories: data.active_cals    ?? undefined,
      restingHR:      data.resting_hr     ?? undefined,
    }
  }
}
```

When the iOS app is built, `apps/ios` will register a `HealthKitAdapter` with
`sourceName = 'healthkit'` that reads from `react-native-health` instead of
Supabase. Same return shape, same `IHealthDataProvider` interface — drop-in.

### Step 14c: Browser XML parser

Create `src/lib/parseAppleHealthExport.ts` (browser-only, no `'server-only'`
guard). This runs in `AppleHealthImportFlow.tsx`, not in any API route — the
file is too big for a serverless function.

```typescript
'use client'
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'

export interface AppleHealthDailyRow {
  date: string                  // YYYY-MM-DD (HealthKit local time)
  steps?: number
  activeCals?: number
  restingHr?: number            // mean of day
  workouts?: object[]
}

export async function parseAppleHealthExport(file: File): Promise<AppleHealthDailyRow[]> {
  const zip = await JSZip.loadAsync(file)
  const xmlEntry = zip.file(/export\.xml$/i)[0]
  if (!xmlEntry) throw new Error('No export.xml found inside the zip')

  const xml = await xmlEntry.async('text')
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
  const parsed = parser.parse(xml) as { HealthData: { Record?: any[]; Workout?: any[] } }

  // Accumulate per-date — see WF-07 for the exact aggregations
  const byDate = new Map<string, AppleHealthDailyRow>()
  // ... walk parsed.HealthData.Record + parsed.HealthData.Workout

  return Array.from(byDate.values())
}
```

This is the only piece of XML parsing in the codebase. If you later move to a
streaming parser (sax) to handle very large exports, only this file changes.

### Step 14d: Import use-case and API route

`src/core/usecases/ImportAppleHealthExport.ts`:

```typescript
export async function importAppleHealthExport(
  db: IDatabase,
  healthSync: HealthSyncService,
  rows: AppleHealthDailyRow[],
): Promise<Result<{ imported: number; datesAffected: string[] }>> {
  try {
    await db.upsertAppleHealthDaily(rows)
    // Re-merge daily_health_metrics for each touched date so the dashboard
    // reflects the new Apple-side numbers alongside whatever Oura already wrote.
    await Promise.all(rows.map(r => healthSync.syncDate(r.date)))
    return ok({ imported: rows.length, datesAffected: rows.map(r => r.date) })
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }
}
```

`src/app/api/health/import/route.ts`:

```typescript
import { services } from '@/container'
import { importAppleHealthExport } from '@/core/usecases/ImportAppleHealthExport'
import { z } from 'zod'

const Body = z.object({
  rows: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    steps:      z.number().int().nonnegative().optional(),
    activeCals: z.number().nonnegative().optional(),
    restingHr:  z.number().int().positive().optional(),
    workouts:   z.array(z.any()).optional(),
  })).max(5000),
})

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json())
  if (!parsed.success) return Response.json({ error: 'Invalid payload' }, { status: 400 })

  const result = await importAppleHealthExport(
    services.db, services.health, parsed.data.rows,
  )
  return result.ok
    ? Response.json(result.value)
    : Response.json({ error: result.error.message }, { status: 500 })
}
```

Add `upsertAppleHealthDaily(rows)` to `IDatabase` and the Supabase adapter — a
single batched upsert keyed on `date`.

### Step 15: Claude Vision adapter

Create `src/infrastructure/ClaudeVisionAdapter.ts`. Implements `IFoodAI`.

This adapter is called from Next.js API routes (server-side only) — never from
client components. The `ANTHROPIC_API_KEY` must not be exposed to the browser.

Food identification prompt:
```typescript
const FOOD_SYSTEM_PROMPT = `You are a nutrition expert identifying food from photos.
Return ONLY valid JSON matching this schema exactly:
{
  "items": [
    {
      "name": "string (specific, e.g. 'grilled chicken breast' not 'chicken')",
      "portionGrams": number,
      "confidence": number between 0 and 1
    }
  ]
}
Estimate portions based on visual cues and typical serving sizes.
If you cannot identify a food item confidently, still include it with a low confidence score.`
```

Supplement label extraction prompt:
```typescript
const SUPPLEMENT_SYSTEM_PROMPT = `You are extracting supplement information from a product label.
Return ONLY valid JSON matching this schema:
{
  "name": "product name",
  "brand": "brand name or null",
  "servingSize": "e.g. '2 capsules'",
  "ingredients": [
    { "name": "ingredient name", "amount": number, "unit": "mg|mcg|IU|g" }
  ]
}
Extract every active ingredient listed on the label.`
```

Always validate Claude's JSON response with Zod — Claude occasionally returns
malformed JSON or extra text. Strip markdown code fences before parsing.

### Step 16: Web camera adapter

Create `src/infrastructure/WebCameraAdapter.ts`. Implements `IImageCapture`.

For `capturePhoto()`:
- Open `getUserMedia({ video: { facingMode: 'environment' } })` for rear camera
- Mount stream on a `<video>` element in a fullscreen modal
- On shutter: draw current frame to an offscreen `<canvas>`
- Export as base64 JPEG at 0.85 quality: `canvas.toDataURL('image/jpeg', 0.85)`
- Stop all tracks after capture

For `scanBarcode()`:
- Use `new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })`
- Detect on each video frame with a `requestAnimationFrame` loop
- Return the first detected barcode value
- Fallback: if `BarcodeDetector` is not defined, return `null` immediately —
  the UI will show a manual entry form

### Step 17: Dependency injection — composition root

Create `src/container.ts`. This is **server-only** — it's imported only by
`/api/*` route handlers, never by hooks or components. That's why it holds
Supabase, Oura, and Claude adapters (all Node-side), but not `WebCameraAdapter`
(browser-only).

```typescript
import 'server-only'
import { SupabaseAdapter }         from './infrastructure/SupabaseAdapter'
import { OuraApiAdapter }          from './infrastructure/OuraApiAdapter'
import { AppleHealthXmlAdapter }   from './infrastructure/AppleHealthXmlAdapter'
import { ClaudeVisionAdapter }     from './infrastructure/ClaudeVisionAdapter'
import { NutritionService }        from './core/services/NutritionService'
import { HealthSyncService }       from './core/services/HealthSyncService'
import { SupplementService }       from './core/services/SupplementService'
import { DashboardService }        from './core/services/DashboardService'

const db = new SupabaseAdapter()
const providers = [
  new OuraApiAdapter(db),
  new AppleHealthXmlAdapter(),
  // When iOS app exists, replace AppleHealthXmlAdapter with HealthKitAdapter here
  // and remove the WF-07 import UI. Nothing else changes.
]
const foodAI = new ClaudeVisionAdapter()

export const services = {
  db,                                                  // exposed for use-cases that need raw upserts (import)
  nutrition:   new NutritionService(db, foodAI),
  health:      new HealthSyncService(db, providers),   // ← array now
  supplements: new SupplementService(db),
  dashboard:   new DashboardService(db),
}
```

`WebCameraAdapter` is instantiated directly inside the React component that
uses it (`PhotoCaptureFlow.tsx`) — it's a browser-only object and doesn't
belong in a server module. Hooks never import the container; they `fetch`
from `/api/*` routes, which import the container.

---

## Phase 5 — Fastify API routes (apps/api)

All business logic routes live in `apps/api/src/routes/`. They run on Render,
can safely use `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, and are
never bundled into the browser.

### Step 18: Auth plugin + routes

`apps/api/src/plugins/auth.ts` — wrap with `fastify-plugin` (`fp`) so the
`onRequest` hook applies globally. Skip `/api/auth/login` and
`/api/oura/callback`. Check `request.cookies.auth === process.env.AUTH_SECRET`.

`apps/api/src/routes/auth.ts`:
```typescript
export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/login', {
    schema: { body: z.object({ password: z.string() }) },
  }, async (req, reply) => {
    if (req.body.password !== process.env.AUTH_SECRET)
      return reply.code(401).send({ error: 'Invalid password' })
    reply.setCookie('auth', process.env.AUTH_SECRET!, { httpOnly: true, ... })
    return reply.code(200).send({ ok: true })
  })
  app.post('/logout', async (_req, reply) => {
    reply.clearCookie('auth', { path: '/' })
    return reply.code(200).send({ ok: true })
  })
}
```

### Step 19: respond() helper

`apps/api/src/lib/respond.ts`:
```typescript
import type { FastifyReply } from 'fastify'
import type { Result } from '@health/core'

export function respond<T>(reply: FastifyReply, result: Result<T>, successStatus = 200) {
  return result.ok
    ? reply.code(successStatus).send(result.value)
    : reply.code(500).send({ error: result.error.message })
}
```

### Step 20: Domain routes

Use the **schema-first** pattern — Fastify validates via Zod before the handler runs:
```typescript
// apps/api/src/routes/meals.ts
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { services } from '@health/core/container'
import { respond } from '../lib/respond'

export const mealsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: { querystring: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }) },
  }, async (req, reply) => respond(reply, await services.nutrition.getMeals(req.query.date)))

  app.post('/', {
    schema: { body: MealSchema.omit({ id: true }) },
  }, async (req, reply) => respond(reply, await services.nutrition.saveMeal(req.body), 201))
}
```

Build the same schema-first wrapper for:
- `dashboard.ts` — `GET ?date=` → `getDashboardSummary`
- `mealsIdentify.ts` — `POST imageBase64` → `logMealFromPhoto`
- `supplements.ts` — `GET` (stack), `POST` (add supplement)
- `supplementsLogs.ts` — `GET ?date=`, `POST` (dose log via `logSupplement`)
- `sync.ts` — `POST` → `syncWearableData`
- `healthImport.ts` — `POST rows[]` → `importAppleHealthExport`
- `oura.ts` — `GET /auth` (redirect), `GET /callback` (exchange + redirect to `WEB_ORIGIN`)

---

## Phase 6 — React application

### Step 21: Zustand store

`src/store/index.ts` — keep it thin:
```typescript
interface AppStore {
  selectedDate: string
  setSelectedDate: (date: string) => void
}

export const useAppStore = create<AppStore>((set) => ({
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  setSelectedDate: (date) => set({ selectedDate: date }),
}))
```

Everything else (loading states, data) is local to each hook.

### Step 22: Hooks

Each hook in `src/hooks/` fetches from an `/api/*` route. Hooks never import
the container or any adapter — that would pull server-only code into the
browser bundle.

```typescript
// src/hooks/useDashboard.ts
'use client'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import type { DashboardSummary } from '@/core/services/DashboardService'

export function useDashboard() {
  const { selectedDate } = useAppStore()
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/dashboard?date=${selectedDate}`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'Failed to load dashboard')
        setData(body)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [selectedDate])

  return { data, loading, error }
}
```

Mirror this shape for `useNutrition` (`/api/meals?date=`) and `useSupplements`
(`/api/supplements` + `/api/supplements/logs?date=`). Mutations (logging a
dose, saving a meal) POST to the same routes and re-fetch on success.

### Step 23: Dashboard components

Build each card as a self-contained presentational component.
No service calls, no hooks inside leaf components — just props and render.

`RecoveryCard` props: `readiness, sleepScore, hrv, restingHR`
Color logic: ≥ 70 → green, 50–69 → amber, < 50 → red. Apply to the numeric value
and a background tint on the card.

`NutritionBar` props: `calories, caloriesTarget, proteinG, proteinTargetG`
Show percentage-fill bars for each. Include the raw numbers.

`SupplementChecklist` props: `supplements, loggedIds, onToggle`
Render each supplement as a tappable row. Checked state is visual-only until
`onToggle` resolves — handle optimistic updates in the parent hook.

`ActivityCard` props: `steps, activeCalories`
Simple numeric display. Steps as the primary figure.

### Step 24: Photo logging flow

`PhotoCaptureFlow` manages a local step machine with `useReducer`:
```
idle → capturing → processing → confirming → saving → idle
```

On `capturing` → mount camera modal (calls `WebCameraAdapter.capturePhoto()`)
On `processing` → POST to `/api/food/identify` with base64
On `confirming` → render `MealConfirmScreen` with editable items
On `saving`     → call use-case, on success return to `idle`

Keep this state local to `PhotoCaptureFlow`. Only call out to Zustand/hooks
once the meal is confirmed and saved.

`MealConfirmScreen` renders each `FoodItem` with:
- Name (editable text)
- Portion in grams (number input)
- Computed calories (recalculates on portion change)
- Amber warning badge if `confidence < 0.6`
- Delete button

### Step 25: Supplement logger

`SupplementLogger` is the "My stack" screen:
- List of all supplements from `useSupplements()`
- Each row: supplement name, default dose, "Taken" toggle
- Toggle calls `LogSupplement` use-case (WF-04)
- "Add supplement" button opens `AddSupplementFlow` (WF-05)

`AddSupplementFlow` mirrors the photo logging flow:
`idle → capturing → processing → reviewing → saving`

### Step 26: Settings page

Minimum viable settings:
- Oura connection status: "Connected (synced 5 min ago)" or "Not connected"
- "Connect Oura" button → calls `/api/oura/auth` (redirects to OAuth)
- "Sync now" button → calls `/api/sync`
- **"Import Apple Health export"** → renders `AppleHealthImportFlow.tsx`:
  - Drag-and-drop zone for `export.zip`
  - On drop → `parseAppleHealthExport(file)` (browser-side, see Step 14c)
  - Preview: "Found N days, YYYY-MM-DD → YYYY-MM-DD"
  - On confirm → POST `/api/health/import` with `{ rows }` (chunk to 500 at a time if N > 5000)
  - Status: "Last imported: 2026-05-13 — 412 days"
  - Note in UI: "Apple Health export is a one-time / periodic refresh. When the
    iOS app ships, this section goes away."
- Daily calorie and protein targets (two number inputs, save on blur)

---

## Phase 7 — Deployment

Two targets: **Vercel** for `apps/web`, **Render** for `apps/api`.

### Step 27: Push to GitHub

```bash
git add .
git commit -m "initial commit"
gh repo create holistic-health --private
git push -u origin main
```

### Step 28: Link Supabase to production

In Supabase dashboard:
1. Create a new project
2. Push migrations: `npx supabase db push --linked`
3. Run seed SQL in the dashboard SQL editor
4. Copy the project URL and service role key

### Step 29: Deploy apps/api to Render

1. Create a new **Web Service** on Render
2. Connect the GitHub repo; set:
   - **Runtime**: Docker
   - **Dockerfile path**: `./apps/api/Dockerfile`
   - **Docker context**: `.` (repo root)
3. Set all `apps/api` environment variables in the Render dashboard:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OURA_CLIENT_ID`,
   `OURA_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `AUTH_SECRET`,
   `COOKIE_SECRET`, `WEB_ORIGIN` (Vercel URL, set after Step 30),
   `OURA_REDIRECT_URI` (= `https://your-api.onrender.com/api/oura/callback`)
4. Note the Render URL (`https://your-api.onrender.com`)

`apps/api/render.yaml` in the repo documents the service definition.

### Step 30: Deploy apps/web to Vercel

```bash
npx vercel --cwd apps/web
```

Set in Vercel dashboard (Settings → Environment Variables):
- `NEXT_PUBLIC_API_URL` → `https://your-api.onrender.com`

Note the Vercel URL (`https://your-app.vercel.app`).

### Step 31: Cross-link the two services

1. In Render, update `WEB_ORIGIN` to the Vercel URL
2. Update the Oura developer app's redirect URI to
   `https://your-api.onrender.com/api/oura/callback`

### Step 32: Reconnect Oura

Visit your deployed app → Settings → Connect Oura. The OAuth flow redirects
to the Render callback, stores tokens in production Supabase, then redirects
back to the Vercel frontend.

---

## Phase 8 — Agentic layer (future)

This phase is not built now. When ready:

### Step 31: Create agent tool manifest

Create `src/core/agent/tools.ts` following the design in CLAUDE.md.
Each tool wraps an existing service method. No service changes needed.

### Step 32: Build streaming agent route

`src/app/api/agent/route.ts` — accepts `{ message, history }`, streams response:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { agentTools, handleToolCall } from '@/core/agent/tools'

const client = new Anthropic()

export async function POST(request: Request) {
  const { message, history } = await request.json()

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    tools: agentTools,
    messages: [...history, { role: 'user', content: message }],
    system: `You are a personal health coach with access to the user's health data.
    Use the provided tools to look up their metrics before answering questions.
    Be specific and data-driven. Today's date is ${new Date().toISOString().split('T')[0]}.`,
  })

  // Handle tool use loop, stream text back to client
  return new Response(stream.toReadableStream())
}
```

### Step 33: Add chat UI

A floating chat button on the dashboard opens a chat drawer.
The drawer maintains conversation history in local state and streams responses
from `/api/agent`.

### Step 34: Add write tools incrementally

Start with read-only tools. Add write tools one at a time:
1. `log_supplement` — agent can mark a supplement as taken
2. `update_nutrition_goal` — agent can adjust calorie/protein targets
3. Always require confirmation before writes: agent proposes, user approves in UI

---

## Running locally (summary)

```bash
# First time
pnpm install                        # from repo root — installs all packages
cp .env.local.example .env.local    # fill in your keys
npx supabase start
npx supabase db push
npx supabase db reset               # applies seed with your supplement stack

# Every time (two terminals)
pnpm --filter @health/api dev       # Fastify on localhost:3001
pnpm --filter @health/web dev       # Next.js on localhost:3000

# Tests (all packages)
pnpm -r test

# Typecheck (all packages)
pnpm -r typecheck
```

Supabase Studio: `http://localhost:54323` — inspect your DB directly.

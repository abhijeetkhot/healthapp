# CLAUDE.md — Holistic Fitness App

## Project overview

A personal-use holistic health dashboard that aggregates data from Oura Ring, Apple Watch
(via HealthKit), food photos, and supplement logs. Split into a **Next.js frontend on
Vercel** and a **Fastify API on Render**, sharing a `packages/core` domain layer in a
pnpm-workspaces monorepo. Architected so an **iOS app and an agentic AI layer** can be
added on top with minimal rework.

Single user for now. Auth is a shared-secret cookie set at `POST /api/auth/login`. Data
lives in Supabase Postgres.

---

## Architecture overview

```
┌──────────────────────────────────────────────────────────┐
│                    Presentation layer                    │
│   apps/web — Next.js (App Router) — deployed on Vercel   │
│   browser fetches /api/* on Render with credentials      │
├──────────────────────────────────────────────────────────┤
│                      API layer                           │
│   apps/api — Fastify on Render                           │
│   schema-first routes · shared-secret cookie auth        │
├──────────────────────────────────────────────────────────┤
│         Agentic layer  (Phase 2+ — not built yet)        │
│   Claude tool-calling agent · scheduled jobs ·           │
│   cross-domain reasoning · proactive alerts              │
├──────────────────────────────────────────────────────────┤
│         Domain layer  (packages/core — @health/core)     │
│     Pure TypeScript — services, models, use-cases        │
│     No framework deps. Reused by iOS app and agent.      │
├──────────────────────────────────────────────────────────┤
│                  Infrastructure layer                    │
│  Supabase  │  Oura API  │  Claude API  │  USDA  │  OFF   │
└──────────────────────────────────────────────────────────┘
```

### Three design principles

**1. Domain layer is platform-agnostic.**
`packages/core/src/` has no Next.js, no Supabase client, no browser APIs. Every service
and use-case can be imported unchanged by a React Native app or an AI agent. Both
`apps/web` and `apps/api` import it as `@health/core` (workspace package).

**2. Infrastructure adapters implement typed ports.**
The domain layer only calls interfaces (`IDatabase`, `IHealthDataProvider`, `IFoodAI`,
`IImageCapture`). Swapping implementations is one file. The agent will call the same
port interfaces as tools.

**3. Agentic layer is additive, not invasive.**
When Phase 2 arrives, domain services are exposed as Claude tool handlers. No services
are rewritten — the agent is a new consumer of what already exists.

---

## Repository structure

pnpm-workspaces monorepo. `packages/core` is shared by both apps as `@health/core`.

```
/
├── apps/
│   ├── web/                             # Next.js — UI only (Vercel)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (dashboard)/page.tsx # / → dashboard
│   │   │   │   ├── food/page.tsx
│   │   │   │   ├── supplements/page.tsx
│   │   │   │   ├── settings/page.tsx
│   │   │   │   └── login/page.tsx       # Password form → POST /api/auth/login
│   │   │   ├── components/
│   │   │   ├── hooks/                   # fetch ${NEXT_PUBLIC_API_URL}/api/* with credentials
│   │   │   ├── store/
│   │   │   └── config/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   └── public/
│   │
│   └── api/                             # Fastify backend (Render)
│       ├── src/
│       │   ├── index.ts                 # Bootstrap: plugins + routes + listen
│       │   ├── plugins/
│       │   │   └── auth.ts              # Global onRequest: cookie check (fp-wrapped)
│       │   ├── lib/
│       │   │   └── respond.ts           # Result<T> → Fastify reply helper
│       │   └── routes/
│       │       ├── auth.ts              # POST /api/auth/login · POST /api/auth/logout
│       │       ├── dashboard.ts         # GET  /api/dashboard?date=
│       │       ├── meals.ts             # GET  /api/meals?date= · POST /api/meals
│       │       ├── mealsIdentify.ts     # POST /api/meals/identify
│       │       ├── supplements.ts       # GET  /api/supplements · POST /api/supplements
│       │       ├── supplementsLogs.ts   # GET  /api/supplements/logs?date= · POST
│       │       ├── sync.ts              # POST /api/sync
│       │       ├── healthImport.ts      # POST /api/health/import
│       │       └── oura.ts              # GET  /api/oura/auth · GET /api/oura/callback
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile
│       └── render.yaml
│
├── packages/
│   └── core/                            # Platform-agnostic domain layer (@health/core)
│       ├── src/
│       │   ├── Result.ts                # Result<T, E> type
│       │   ├── index.ts                 # Re-exports for @health/core barrel
│       │   ├── container.ts             # Composition root (server-only)
│       │   ├── models/
│       │   │   ├── health.ts            # DailyHealthMetrics
│       │   │   ├── nutrition.ts         # Meal, FoodItem, MacroSummary
│       │   │   └── supplement.ts        # Supplement, DoseLog, IngredientDose
│       │   ├── ports/                   # Interfaces infrastructure must implement
│       │   │   ├── IDatabase.ts
│       │   │   ├── IHealthDataProvider.ts
│       │   │   ├── IFoodAI.ts
│       │   │   ├── IImageCapture.ts
│       │   │   └── IStorage.ts
│       │   ├── services/                # Business logic — zero platform deps
│       │   │   ├── HealthSyncService.ts
│       │   │   ├── NutritionService.ts
│       │   │   ├── SupplementService.ts
│       │   │   └── DashboardService.ts
│       │   ├── usecases/                # One file per user-facing workflow
│       │   │   ├── SyncWearableData.ts
│       │   │   ├── LogMealFromPhoto.ts
│       │   │   ├── LogMealFromBarcode.ts
│       │   │   ├── LogSupplement.ts
│       │   │   ├── AddSupplementFromPhoto.ts
│       │   │   ├── ImportAppleHealthExport.ts
│       │   │   └── GetDashboardSummary.ts
│       │   └── infrastructure/
│       │       ├── SupabaseAdapter.ts
│       │       ├── OuraApiAdapter.ts
│       │       ├── AppleHealthXmlAdapter.ts
│       │       ├── ClaudeVisionAdapter.ts
│       │       ├── SupabaseStorageAdapter.ts
│       │       └── WebCameraAdapter.ts
│       ├── package.json                 # name: "@health/core", main: ./src/index.ts
│       ├── tsconfig.json
│       └── vitest.config.ts
│
├── supabase/
│   ├── migrations/001_initial_schema.sql
│   └── seed.sql
│
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── package.json                         # root — devDependencies only
├── .env.local                           # Never committed
├── .env.local.example
├── CLAUDE.md
└── INSTRUCTIONS.md
```

---

## Tech stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) | API routes + SSR in one project; no separate Express server |
| Deployment | Vercel | Zero-config for Next.js; edge functions for OAuth |
| Database | Supabase Postgres | Free tier covers personal use; JS client works in RN too |
| File storage | Supabase Storage | Meal photos stored here, referenced by path in DB |
| Styling | Tailwind CSS | Maps cleanly to NativeWind on iOS |
| State | Zustand | Minimal, no boilerplate, works in React Native |
| Charts | Recharts | Web only; swap for Victory Native on iOS |
| Validation | Zod | Runtime safety at all external boundaries |
| Dates | date-fns | Lightweight, tree-shakeable |

### External services

| Service | Phase | Purpose |
|---|---|---|
| Oura API v2 | 1 | Sleep, HRV, readiness, activity |
| Anthropic Claude API | 1 | Food photo recognition, supplement label extraction |
| USDA FoodData Central | 1 | Nutritional lookup by food name (free, no key needed) |
| Open Food Facts | 1 | Barcode lookup for packaged food and supplements |
| Apple HealthKit | iOS | Steps, HR, workouts (web gets manual import stub) |
| Function Health | 2 | Lab biomarker ingestion |

---

## Core interfaces (ports)

```typescript
// src/core/ports/IDatabase.ts
export interface IDatabase {
  getMeals(date: string): Promise<Meal[]>
  saveMeal(meal: Omit<Meal, 'id'>): Promise<Meal>
  getSupplementLogs(date: string): Promise<DoseLog[]>
  saveSupplementLog(log: Omit<DoseLog, 'id'>): Promise<DoseLog>
  getSupplements(): Promise<Supplement[]>
  saveSupplement(supplement: Omit<Supplement, 'id' | 'createdAt'>): Promise<Supplement>
  getHealthMetrics(date: string): Promise<DailyHealthMetrics | null>
  getHealthMetricsRange(from: string, to: string): Promise<DailyHealthMetrics[]>
  upsertHealthMetrics(metrics: DailyHealthMetrics): Promise<void>
  getOuraTokens(): Promise<OuraTokens | null>
  saveOuraTokens(tokens: OuraTokens): Promise<void>
}

// src/core/ports/IHealthDataProvider.ts
// One implementation per data source. Today: Oura (live API) + Apple Health (XML import).
// Tomorrow: HealthKit on iOS — drops in with the same shape, nothing else changes.
export interface IHealthDataProvider {
  /** Stable identifier — used in DailyHealthMetrics.sources and for merge priority. */
  readonly sourceName: 'oura' | 'apple-health' | 'healthkit'
  /** Return whatever this source knows for the given date. Missing fields stay undefined. */
  getMetrics(date: string): Promise<Partial<DailyHealthMetrics>>
}

// src/core/ports/IFoodAI.ts
// Returns IdentifiedFood (name + portion + confidence). USDA enrichment in
// LogMealFromPhoto converts each into a full FoodItem (with macros).
export interface IFoodAI {
  identifyFoodsFromImage(imageBase64: string): Promise<IdentifiedFood[]>
  extractSupplementFromLabel(imageBase64: string): Promise<SupplementInfo>
}

// src/core/ports/IImageCapture.ts
export interface IImageCapture {
  capturePhoto(): Promise<Result<string>>          // base64 JPEG
  scanBarcode(): Promise<Result<string | null>>    // barcode string or null
}

// src/core/ports/IStorage.ts
// Photo uploads. Web uses SupabaseStorageAdapter; iOS would use a native
// file-system adapter under the app's documents directory.
export interface IStorage {
  uploadMealPhoto(imageBase64: string): Promise<Result<string>>  // returns storage path
}
```

---

## Data models

```typescript
// src/core/models/health.ts
export interface DailyHealthMetrics {
  date: string                  // YYYY-MM-DD
  readinessScore?: number       // 0–100
  sleepScore?: number           // 0–100
  hrv?: number                  // ms RMSSD
  restingHR?: number            // bpm
  sleepDuration?: number        // minutes
  deepSleepMinutes?: number
  remSleepMinutes?: number
  bodyTempDeviation?: number    // °C delta
  steps?: number
  activeCalories?: number
  /** Providers that contributed to this row, e.g. ['oura', 'apple-health']. */
  sources: string[]
  syncedAt: string
}

// src/core/models/nutrition.ts

// What Claude Vision returns from a food photo — name + portion + confidence.
// Macros come from USDA enrichment in LogMealFromPhoto, not from the AI.
export interface IdentifiedFood {
  name: string
  portionGrams: number
  confidence: number            // 0–1; items < 0.6 flagged in UI
}

// A fully-enriched food item ready to save. Macros are required here.
export interface FoodItem {
  name: string
  portionGrams: number
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  confidence?: number           // carried over from IdentifiedFood if source = 'ai'
  source: 'ai' | 'barcode' | 'manual'
}

export interface Meal {
  id: string
  date: string
  time: string
  photoStoragePath?: string     // Supabase Storage path
  items: FoodItem[]
  totalCalories: number
  totalProteinG: number
  totalCarbsG: number
  totalFatG: number
}

// src/core/models/supplement.ts
export interface IngredientDose {
  name: string
  amount: number
  unit: 'mg' | 'mcg' | 'IU' | 'g'
}

export interface Supplement {
  id: string
  name: string
  brand?: string
  keyIngredients: IngredientDose[]
  defaultDoseDescription: string
  createdAt: string
}

export interface DoseLog {
  id: string
  supplementId: string
  date: string
  time: string
  doseDescription?: string
}
```

---

## Result type

```typescript
// src/core/Result.ts
export type Result<T, E extends Error = Error> =
  | { ok: true;  value: T }
  | { ok: false; error: E }

export const ok  = <T>(value: T): Result<T>           => ({ ok: true,  value })
export const err = <E extends Error>(e: E): Result<never, E> => ({ ok: false, error: e })
```

All service methods and use-cases return `Promise<Result<T>>`.
Errors are handled at the use-case boundary. Components never catch.

---

## Database schema

`supabase/migrations/001_initial_schema.sql`

```sql
create table daily_health_metrics (
  date            date primary key,
  readiness       smallint,
  sleep_score     smallint,
  hrv             numeric(6,2),
  resting_hr      smallint,
  sleep_minutes   smallint,
  deep_minutes    smallint,
  rem_minutes     smallint,
  body_temp_dev   numeric(4,2),
  steps           integer,
  active_cals     integer,
  sources         text[]      not null default '{}',
  synced_at       timestamptz not null default now()
);

-- Staging table for Apple Health export uploads (Phase 1). When iOS app is built,
-- HealthKitAdapter reads directly from device — this table becomes unused.
create table apple_health_daily (
  date            date primary key,
  steps           integer,
  active_cals     integer,
  resting_hr      smallint,
  workouts        jsonb,                -- raw list of workout records for the day
  imported_at     timestamptz not null default now()
);

create table meals (
  id              uuid primary key default gen_random_uuid(),
  date            date        not null,
  time            time        not null,
  photo_path      text,
  total_cals      smallint,
  total_prot      numeric(6,1),
  total_carbs     numeric(6,1),
  total_fat       numeric(6,1),
  created_at      timestamptz not null default now()
);

create table meal_items (
  id              uuid primary key default gen_random_uuid(),
  meal_id         uuid        not null references meals(id) on delete cascade,
  name            text        not null,
  portion_g       numeric(7,1),
  calories        smallint,
  protein_g       numeric(6,1),
  carbs_g         numeric(6,1),
  fat_g           numeric(6,1),
  confidence      numeric(3,2),
  source          text        not null default 'ai'
);

create table supplements (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  brand           text,
  default_dose    text,
  created_at      timestamptz not null default now()
);

create table supplement_ingredients (
  id              uuid primary key default gen_random_uuid(),
  supplement_id   uuid        not null references supplements(id) on delete cascade,
  name            text        not null,
  amount          numeric(8,2),
  unit            text        not null default 'mg'
);

create table dose_logs (
  id              uuid primary key default gen_random_uuid(),
  supplement_id   uuid        not null references supplements(id),
  date            date        not null,
  time            time        not null,
  dose_desc       text,
  created_at      timestamptz not null default now()
);

-- Oura OAuth tokens (single row — personal use)
create table oura_tokens (
  id              int primary key default 1,
  access_token    text        not null,
  refresh_token   text        not null,
  expires_at      timestamptz not null,
  updated_at      timestamptz not null default now(),
  constraint single_row check (id = 1)
);

create index on meals(date);
create index on dose_logs(date);
create index on meal_items(meal_id);
create index on dose_logs(supplement_id);
```

---

## Workflow definitions (Phase 1)

Phase 1 is all deterministic workflows — no autonomous decisions, no agent loops.
Every workflow is a sequential async function in `src/core/usecases/`.

### WF-01 · Daily wearable sync

```
Trigger: app load, or manual "Sync now" tap in settings
──────────────────────────────────────────────────────────────
1. Read today's row from daily_health_metrics (Supabase)
   → row exists AND synced_at < 60 min ago → return cached, skip
   → stale or missing → continue
2. Call getMetrics(today) on every provider in parallel:
   - OuraApiAdapter        → readiness, HRV, sleep_*, resting_hr, body_temp_dev
   - AppleHealthXmlAdapter → steps, active_cals, resting_hr (if no Oura value)
   (When iOS app exists: replace AppleHealthXmlAdapter with HealthKitAdapter,
    same port, same merge logic.)
3. Validate each provider's response with its own Zod schema
4. Merge into a single DailyHealthMetrics by field-priority:
     readiness, hrv, sleep_*, body_temp_dev   → Oura wins
     resting_hr                                → Oura > Apple
     steps, active_cals                        → Apple wins
     sources                                   → union of providers that returned data
5. Upsert into daily_health_metrics (Supabase)
6. Return Result<DailyHealthMetrics>
──────────────────────────────────────────────────────────────
Errors per provider — failures are isolated, never block other providers:
  Oura 401          → OuraApiAdapter.refreshToken(), retry once
  Oura 5xx/network  → omit Oura fields from merge, still write Apple fields
  Apple not imported → omit Apple fields; row reflects Oura only
  Zod validation fail → log malformed fields, drop them, keep the rest
```

### WF-02 · Log meal from photo

```
Trigger: user taps "Log food" → camera shutter fires
──────────────────────────────────────────────────────────────
1. Capture photo → base64 JPEG  (WebCameraAdapter)
2. Upload to Supabase Storage → get storage path
3. Send base64 to Claude Vision API  (ClaudeVisionAdapter)
   System prompt: food identification specialist
   User prompt:   identify all visible foods, estimate portions in grams,
                  return JSON: {items: [{name, portionGrams, confidence}]}
4. For each identified item (run in parallel, max 5):
   a. GET https://api.nal.usda.gov/fdc/v1/foods/search?query={name}
   b. Take top result, extract kcal/protein/carbs/fat per 100g
   c. Scale macros to estimated portionGrams
   d. On USDA failure → use Claude's direct calorie estimate as fallback
5. Assemble Meal candidate, return to UI
──────────────────────────────────────────────────────────────
   ↓  MealConfirmScreen renders:
      - Each item with name, portion, macros (editable)
      - Items with confidence < 0.6 shown with amber warning
      - User can adjust portions, remove items, confirm
──────────────────────────────────────────────────────────────
6. On confirm → INSERT meals row + meal_items rows (Supabase)
7. Invalidate today's nutrition totals in Zustand store
──────────────────────────────────────────────────────────────
Errors:
  Claude returns 0 items → show "Nothing recognised" + manual search CTA
  USDA rate limit → use Claude estimate, flag as approximate
  Upload fails → skip photo storage, continue with logging
```

### WF-03 · Log meal from barcode

```
Trigger: user taps "Scan barcode" in food log
──────────────────────────────────────────────────────────────
1. Open BarcodeDetector stream  (WebCameraAdapter)
2. On barcode detected →
   GET https://world.openfoodfacts.org/api/v0/product/{barcode}.json
3. Extract: product_name, serving_size, nutriments (energy_kcal,
   proteins, carbohydrates, fat) per serving
4. Map to FoodItem with source: 'barcode', confidence: 1.0
5. Pre-fill MealConfirmScreen with 1 serving (editable)
6. On confirm → INSERT into meals + meal_items (same as WF-02 step 6)
──────────────────────────────────────────────────────────────
Errors:
  Barcode not in Open Food Facts → show "Not found" + manual search fallback
  BarcodeDetector API not supported → show manual entry form
```

### WF-04 · Log supplement dose (from stack)

```
Trigger: user taps supplement row in "My stack" checklist
──────────────────────────────────────────────────────────────
1. Optimistically mark supplement as taken in UI
2. INSERT dose_logs row: { supplement_id, date: today, time: now }
3. On DB error → revert UI optimistic update, show error toast
──────────────────────────────────────────────────────────────
No AI, no external calls. Simplest write in the app.
```

### WF-05 · Add new supplement via photo

```
Trigger: user taps "Add supplement" → selects camera
──────────────────────────────────────────────────────────────
1. Capture photo of supplement bottle label → base64
2. Send to Claude Vision API  (ClaudeVisionAdapter)
   Prompt: extract product name, brand, serving size,
           key ingredients with amounts and units
   Response: { name, brand, servingSize, ingredients: [{name, amount, unit}] }
3. Validate response with Zod
4. Pre-fill supplement form with extracted data
──────────────────────────────────────────────────────────────
   ↓  User reviews, edits, confirms
──────────────────────────────────────────────────────────────
5. INSERT supplements row + supplement_ingredients rows
6. Optionally trigger WF-04 to log first dose immediately
──────────────────────────────────────────────────────────────
Errors:
  Claude can't read label → show blank form, user types manually
  Partial extraction → pre-fill what was found, leave rest blank
```

### WF-06 · Oura OAuth connect

```
Trigger: user taps "Connect Oura" in settings
──────────────────────────────────────────────────────────────
1. GET /api/oura/auth (Next.js route handler)
   → builds Oura OAuth URL, redirects browser
2. User grants access on Oura's site
3. Oura redirects to /api/oura/callback?code=xxx
4. Server-side: POST to https://api.ouraring.com/oauth/token
   with: code, client_id, client_secret, redirect_uri
5. Store access_token, refresh_token, expires_at
   in oura_tokens table (Supabase, server-side write only)
6. Redirect to /settings with ?connected=true
──────────────────────────────────────────────────────────────
Token refresh (automatic, inside OuraApiAdapter):
  Before every API call → check expires_at
  If expired → POST to Oura refresh endpoint
              → update oura_tokens row
              → retry original call
```

### WF-07 · Import Apple Health export

```
Trigger: user drops export.zip onto Settings → "Import Apple Health"
──────────────────────────────────────────────────────────────
ALL parsing runs in the browser. Apple's export.xml is often >500 MB —
the server only sees the aggregated daily rows, not the raw XML.

Client (AppleHealthImportFlow.tsx):
1. Read uploaded File with FileReader
2. JSZip.loadAsync(file) → extract apple_health_export/export.xml
3. Stream-parse with fast-xml-parser (or sax) — accumulate per-date totals:
     HKQuantityTypeIdentifierStepCount         → sum per date
     HKQuantityTypeIdentifierActiveEnergyBurned → sum per date
     HKQuantityTypeIdentifierRestingHeartRate   → mean per date
     <Workout> records                          → push raw object to array per date
4. Show preview: "Found N days of data, range YYYY-MM-DD to YYYY-MM-DD"
5. On confirm → POST /api/health/import with { rows: AppleHealthDaily[] }
──────────────────────────────────────────────────────────────
Server (POST /api/health/import):
6. Validate payload with Zod (limit ~5000 rows per request)
7. Upsert into apple_health_daily (one row per date)
8. For each affected date → trigger HealthSyncService.syncDate(date)
   to re-merge daily_health_metrics from all providers
9. Return { imported: N, datesAffected: [...] }
──────────────────────────────────────────────────────────────
Errors:
  Zip missing export.xml → "Not a valid Apple Health export"
  XML parse failure       → show error + offer to retry
  Network failure mid-upload → chunk the POST into batches of 500 days
```

When the iOS app exists, this workflow disappears entirely — `HealthKitAdapter`
reads live from the device's HealthKit store. The `apple_health_daily` table
can be archived; nothing else in the codebase changes.

---

## Agentic layer — Phase 2 design (not built in Phase 1)

### What triggers an agent vs a workflow

| User intent | Phase 1 | Phase 2 |
|---|---|---|
| Log a meal | WF-02 deterministic flow | Same, unchanged |
| "Why am I tired this week?" | Not available | Agent queries metrics + nutrition + supplements, reasons across them |
| "Is my magnesium making a difference?" | Not available | Agent pulls 30-day supplement logs vs HRV data, looks for correlation |
| Morning summary | Not available | Scheduled agent: summarise yesterday, flag any trends |
| "Adjust my supplement stack" | Not available | Agent reasons over biomarkers + current stack, proposes changes |

### How the agent slots in — zero changes to Phase 1 code

The agent lives in `src/app/api/agent/route.ts`.
It receives a message + conversation history, calls Claude with tool use enabled,
and streams the response back to the UI.

The tools are thin wrappers around the same domain services Phase 1 already built:

```typescript
// src/core/agent/tools.ts  (Phase 2 — not built yet)

export const agentTools: Tool[] = [
  {
    name: 'get_health_metrics',
    description: 'Retrieve daily health metrics (HRV, sleep score, readiness, steps) for a date range. Use for trend analysis or answering questions about recovery.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to:   { type: 'string', description: 'End date YYYY-MM-DD' },
      },
      required: ['from', 'to'],
    },
    handler: (input) => services.health.getMetricsRange(input.from, input.to),
  },
  {
    name: 'get_nutrition_summary',
    description: 'Retrieve daily calorie and macro totals for a date range.',
    input_schema: { /* ... */ },
    handler: (input) => services.nutrition.getDailyMacrosRange(input.from, input.to),
  },
  {
    name: 'get_supplement_logs',
    description: 'Retrieve which supplements were taken and when, over a date range.',
    input_schema: { /* ... */ },
    handler: (input) => services.supplements.getLogsRange(input.from, input.to),
  },
  {
    name: 'get_meals',
    description: 'Retrieve individual meal logs and food items for a specific date.',
    input_schema: { /* ... */ },
    handler: (input) => services.nutrition.getMeals(input.date),
  },
]
```

The agent tool loop:
```
User message
    ↓
Claude (with tool manifest)
    ↓
Tool call requested?
  → Yes → execute handler (calls domain service → Supabase)
        → return result to Claude
        → repeat until no more tool calls
  → No  → stream final answer to UI
```

Phase 1 services need no changes. The agent is a new consumer of what's already there.

---

## Key conventions

- **No `any` types.** Use `unknown` and narrow with Zod.
- **All dates as `YYYY-MM-DD` strings** in the domain layer. Postgres `date` handles storage.
- **All async service/use-case methods return `Promise<Result<T>>`** — no thrown exceptions crossing layer boundaries.
- **Domain services are constructor-injected.** Never import concrete adapters inside `packages/core/src/`.
- **One use-case per file.** Each orchestrates services and returns a plain object.
- **No business logic in React components.** Components → hooks → Fastify API → use-cases → services.
- **Browser fetches cross-origin with credentials.** `apps/web` hooks call `${NEXT_PUBLIC_API_URL}/api/*` (the Fastify server on Render) with `credentials: 'include'`. The Fastify CORS config mirrors `WEB_ORIGIN` and allows credentials.
- **Auth is a shared-secret cookie.** `POST /api/auth/login` checks `body.password === AUTH_SECRET` and sets an httpOnly cookie. All other routes (except `/api/oura/callback`) require that cookie.
- **Supabase is `apps/api`-only.** The browser never imports `@supabase/supabase-js`. `packages/core/src/container.ts` (server-only) creates the Supabase client with the service role key. No anon key, no RLS.
- **All secrets are `apps/api`-only.** `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OURA_CLIENT_SECRET`, `AUTH_SECRET`, `COOKIE_SECRET` are never set in `apps/web`. `NEXT_PUBLIC_API_URL` is the only public variable.
- **`packages/core/src/container.ts` is server-only.** It imports Node-side adapters (Supabase, Oura, Claude). Browser-only adapters like `WebCameraAdapter` are imported directly by the React component that uses them.
- **Tailwind only** — no inline styles, no CSS modules. NativeWind uses the same class names on iOS.

---

## Environment variables

Variables are split by app. `apps/api` is entirely server-side.
`NEXT_PUBLIC_API_URL` is the only variable visible to the browser.

```bash
# ── apps/api (Render) — all server-only ──────────────────────────────────
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

OURA_CLIENT_ID=
OURA_CLIENT_SECRET=
OURA_REDIRECT_URI=https://your-api.onrender.com/api/oura/callback  # update after deploy

ANTHROPIC_API_KEY=

# Shared secret — browser POSTs this to /api/auth/login, API sets it as cookie
AUTH_SECRET=<long random string>
# Used to sign/verify cookies in Fastify
COOKIE_SECRET=<long random string>
# Vercel URL of apps/web — used for CORS origin and Oura OAuth redirect
WEB_ORIGIN=https://your-app.vercel.app  # http://localhost:3000 in dev

# ── apps/web (Vercel) — browser-visible ──────────────────────────────────
NEXT_PUBLIC_API_URL=https://your-api.onrender.com  # http://localhost:3001 in dev
```

---

## Personal config

```typescript
// src/config/user.ts — edit directly, no UI needed
export const USER_PROFILE = {
  name: 'Your Name',
  age: 30,
  sexBiological: 'male' as const,
  heightCm: 180,
  weightKg: 80,
  goals: {
    dailyCaloriesKcal: 2400,
    dailyProteinG: 180,
    targetSleepMinutes: 480,
  },
} as const
```

---

## iOS extension plan (when ready)

The monorepo structure (`packages/core`, `apps/web`, `apps/api`) is already in place.

1. Add `apps/ios` — bootstraps Expo, imports `@health/core` workspace package
3. Implement `IDatabase` with `expo-sqlite` (same schema) — or keep Supabase JS, which works in RN
4. **Implement `HealthKitAdapter` with `react-native-health` — same `IHealthDataProvider` port as `AppleHealthXmlAdapter`.** In the iOS container, swap `AppleHealthXmlAdapter` for `HealthKitAdapter`. `HealthSyncService`, the merge logic, and every consumer of health data stay byte-identical. The XML import UI and `apple_health_daily` table become dead code on iOS — remove the route and component from the iOS app's render tree.
5. Implement `IImageCapture` with `expo-camera` + `expo-barcode-scanner`
6. Replace Recharts with Victory Native; Tailwind → NativeWind

New code for iOS layer: ~25%. The other 75% (core, services, Oura, Claude,
Supabase adapters, merge logic) is already written and shared. The iOS swap is
why we kept `IHealthDataProvider` source-agnostic from day one.

---

## Running locally

```bash
npm install
cp .env.local.example .env.local       # fill in keys
npx supabase start                     # local Supabase via Docker
npx supabase db push                   # apply migrations
npm run dev                            # Next.js on localhost:3000
```

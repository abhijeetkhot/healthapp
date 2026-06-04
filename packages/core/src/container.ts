import { DashboardService } from './services/DashboardService'
import { HealthSyncService } from './services/HealthSyncService'
import { NutritionService } from './services/NutritionService'
import { SupplementService } from './services/SupplementService'
import { AppleHealthXmlAdapter } from './infrastructure/AppleHealthXmlAdapter'
import { ClaudeVisionAdapter } from './infrastructure/ClaudeVisionAdapter'
import { OuraApiAdapter } from './infrastructure/OuraApiAdapter'
import { SupabaseAdapter } from './infrastructure/SupabaseAdapter'
import { SupabaseStorageAdapter } from './infrastructure/SupabaseStorageAdapter'

// Server-only composition root. Imported by Fastify route handlers in apps/api.
// Hooks and React components in apps/web must NEVER import this file — that
// would pull the service-role Supabase key into the client bundle.
//
// WebCameraAdapter is NOT here — it's browser-only and is instantiated
// directly inside the React component that uses it (PhotoCaptureFlow).
if (typeof (globalThis as { window?: unknown }).window !== 'undefined') {
  throw new Error('@health/core/container is server-only and must not be imported in the browser')
}

const db = new SupabaseAdapter()
const storage = new SupabaseStorageAdapter()
const foodAI = new ClaudeVisionAdapter()
const providers = [
  new OuraApiAdapter(db),
  new AppleHealthXmlAdapter(db),
  // When the iOS app exists, swap AppleHealthXmlAdapter for HealthKitAdapter
  // here. Nothing else changes — the HealthSyncService merge logic is
  // source-agnostic.
]

export const services = {
  db,
  storage,
  foodAI,
  nutrition: new NutritionService(db, foodAI),
  health: new HealthSyncService(db, providers),
  supplements: new SupplementService(db),
  dashboard: new DashboardService(db),
}

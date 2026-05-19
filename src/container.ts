import 'server-only'
import { DashboardService } from './core/services/DashboardService'
import { HealthSyncService } from './core/services/HealthSyncService'
import { NutritionService } from './core/services/NutritionService'
import { SupplementService } from './core/services/SupplementService'
import { AppleHealthXmlAdapter } from './infrastructure/AppleHealthXmlAdapter'
import { ClaudeVisionAdapter } from './infrastructure/ClaudeVisionAdapter'
import { OuraApiAdapter } from './infrastructure/OuraApiAdapter'
import { SupabaseAdapter } from './infrastructure/SupabaseAdapter'
import { SupabaseStorageAdapter } from './infrastructure/SupabaseStorageAdapter'

// Server-only composition root. Imported by /api/* route handlers.
// Hooks and React components must NEVER import this file — that would
// pull the service-role Supabase key into the client bundle.
//
// WebCameraAdapter is NOT here — it's browser-only and is instantiated
// directly inside the React component that uses it (PhotoCaptureFlow).

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

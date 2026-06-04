import type { DailyHealthMetrics } from '../models/health'
import type { HealthSyncService } from '../services/HealthSyncService'
import { type Result, ok } from '../Result'

const STALE_AFTER_MS = 60 * 60 * 1000

export async function syncWearableData(
  health: HealthSyncService,
  date: string,
): Promise<Result<DailyHealthMetrics>> {
  const existing = await health.getMetrics(date)
  if (existing.ok && existing.value) {
    const age = Date.now() - new Date(existing.value.syncedAt).getTime()
    if (age < STALE_AFTER_MS) return ok(existing.value)
  }
  return health.syncDate(date)
}

import type { AppleHealthDailyRow, IDatabase } from '../ports/IDatabase'
import type { HealthSyncService } from '../services/HealthSyncService'
import { type Result, err, ok } from '../Result'

export interface ImportResult {
  imported: number
  datesAffected: string[]
}

export async function importAppleHealthExport(
  db: IDatabase,
  healthSync: HealthSyncService,
  rows: AppleHealthDailyRow[],
): Promise<Result<ImportResult>> {
  if (rows.length === 0) return err(new Error('No rows to import'))
  try {
    await db.upsertAppleHealthDaily(rows)
    // Re-merge daily_health_metrics for each touched date so the dashboard
    // reflects new Apple-side numbers alongside whatever Oura already wrote.
    await Promise.all(rows.map((r) => healthSync.syncDate(r.date)))
    return ok({
      imported: rows.length,
      datesAffected: rows.map((r) => r.date),
    })
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }
}

import 'server-only'
import type { DailyHealthMetrics } from '../core/models/health'
import type { IDatabase } from '../core/ports/IDatabase'
import type { HealthSourceName, IHealthDataProvider } from '../core/ports/IHealthDataProvider'

// Reads pre-aggregated daily rows from the apple_health_daily table.
// The XML import flow (WF-07) populates that table from the user's
// Apple Health export.zip. When the iOS app exists, swap this for a
// HealthKitAdapter that reads live from the device — same port, no
// other code changes.
export class AppleHealthXmlAdapter implements IHealthDataProvider {
  readonly sourceName: HealthSourceName = 'apple-health'

  constructor(private readonly db: IDatabase) {}

  async getMetrics(date: string): Promise<Partial<DailyHealthMetrics>> {
    const row = await this.db.getAppleHealthDaily(date)
    if (!row) return {}
    return {
      steps: row.steps,
      activeCalories: row.activeCals,
      restingHR: row.restingHr,
    }
  }
}

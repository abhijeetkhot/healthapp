import type { DailyHealthMetrics } from '../models/health'
import { type MacroSummary, sumMacros } from '../models/nutrition'
import type { DoseLog, Supplement } from '../models/supplement'
import type { IDatabase } from '../ports/IDatabase'
import { type Result, err, ok } from '../Result'

export interface DashboardSummary {
  date: string
  metrics: DailyHealthMetrics | null
  nutrition: MacroSummary
  supplements: {
    stack: Supplement[]
    logsToday: DoseLog[]
  }
}

export class DashboardService {
  constructor(private readonly db: IDatabase) {}

  async getDashboardSummary(date: string): Promise<Result<DashboardSummary>> {
    try {
      const [metrics, meals, stack, logsToday] = await Promise.all([
        this.db.getHealthMetrics(date),
        this.db.getMeals(date),
        this.db.getSupplements(),
        this.db.getSupplementLogs(date),
      ])
      const items = meals.flatMap((m) => m.items)
      return ok({
        date,
        metrics,
        nutrition: sumMacros(items),
        supplements: { stack, logsToday },
      })
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }
}

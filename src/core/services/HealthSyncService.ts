import type { DailyHealthMetrics } from '../models/health'
import type { IDatabase } from '../ports/IDatabase'
import type { HealthSourceName, IHealthDataProvider } from '../ports/IHealthDataProvider'
import { type Result, err, ok } from '../Result'

type MetricKey = Exclude<keyof DailyHealthMetrics, 'date' | 'sources' | 'syncedAt'>

const MERGE_PRIORITY: Record<MetricKey, HealthSourceName[]> = {
  readinessScore:    ['oura'],
  sleepScore:        ['oura'],
  hrv:               ['oura'],
  sleepDuration:     ['oura'],
  deepSleepMinutes:  ['oura'],
  remSleepMinutes:   ['oura'],
  bodyTempDeviation: ['oura'],
  restingHR:         ['oura', 'apple-health', 'healthkit'],
  steps:             ['apple-health', 'healthkit'],
  activeCalories:    ['apple-health', 'healthkit'],
}

interface Contribution {
  source: HealthSourceName
  metrics: Partial<DailyHealthMetrics>
}

export function mergeByPriority(date: string, contributions: Contribution[]): DailyHealthMetrics {
  const byName = new Map<HealthSourceName, Partial<DailyHealthMetrics>>()
  for (const c of contributions) byName.set(c.source, c.metrics)

  const merged: DailyHealthMetrics = {
    date,
    sources: [],
    syncedAt: new Date().toISOString(),
  }
  const contributingSources = new Set<string>()

  for (const key of Object.keys(MERGE_PRIORITY) as MetricKey[]) {
    for (const source of MERGE_PRIORITY[key]) {
      const value = byName.get(source)?.[key]
      if (value !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(merged as any)[key] = value
        contributingSources.add(source)
        break
      }
    }
  }
  merged.sources = [...contributingSources]
  return merged
}

export class HealthSyncService {
  constructor(
    private readonly db: IDatabase,
    private readonly providers: IHealthDataProvider[],
  ) {}

  async syncDate(date: string): Promise<Result<DailyHealthMetrics>> {
    const settled = await Promise.allSettled(
      this.providers.map(async (p) => ({
        source: p.sourceName,
        metrics: await p.getMetrics(date),
      })),
    )
    const contributions = settled.flatMap((s) =>
      s.status === 'fulfilled' ? [s.value] : [],
    )
    const merged = mergeByPriority(date, contributions)
    try {
      await this.db.upsertHealthMetrics(merged)
      return ok(merged)
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  async getMetrics(date: string): Promise<Result<DailyHealthMetrics | null>> {
    try {
      return ok(await this.db.getHealthMetrics(date))
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  async getMetricsRange(from: string, to: string): Promise<Result<DailyHealthMetrics[]>> {
    try {
      return ok(await this.db.getHealthMetricsRange(from, to))
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }
}

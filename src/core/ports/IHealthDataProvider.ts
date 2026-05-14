import type { DailyHealthMetrics } from '../models/health'

export type HealthSourceName = 'oura' | 'apple-health' | 'healthkit'

export interface IHealthDataProvider {
  readonly sourceName: HealthSourceName
  getMetrics(date: string): Promise<Partial<DailyHealthMetrics>>
}

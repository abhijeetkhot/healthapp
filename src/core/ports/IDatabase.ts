import type { DailyHealthMetrics, OuraTokens } from '../models/health'
import type { Meal } from '../models/nutrition'
import type { DoseLog, Supplement } from '../models/supplement'

export interface AppleHealthDailyRow {
  date: string
  steps?: number
  activeCals?: number
  restingHr?: number
  workouts?: unknown[]
}

export interface IDatabase {
  // Meals
  getMeals(date: string): Promise<Meal[]>
  saveMeal(meal: Omit<Meal, 'id'>): Promise<Meal>

  // Supplements
  getSupplements(): Promise<Supplement[]>
  saveSupplement(supplement: Omit<Supplement, 'id' | 'createdAt'>): Promise<Supplement>
  getSupplementLogs(date: string): Promise<DoseLog[]>
  saveSupplementLog(log: Omit<DoseLog, 'id'>): Promise<DoseLog>

  // Health metrics (merged output)
  getHealthMetrics(date: string): Promise<DailyHealthMetrics | null>
  getHealthMetricsRange(from: string, to: string): Promise<DailyHealthMetrics[]>
  upsertHealthMetrics(metrics: DailyHealthMetrics): Promise<void>

  // Apple Health staging (Phase 1 only — see WF-07)
  upsertAppleHealthDaily(rows: AppleHealthDailyRow[]): Promise<void>
  getAppleHealthDaily(date: string): Promise<AppleHealthDailyRow | null>

  // Oura OAuth
  getOuraTokens(): Promise<OuraTokens | null>
  saveOuraTokens(tokens: OuraTokens): Promise<void>
}

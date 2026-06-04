import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DailyHealthMetrics, OuraTokens } from '../models/health'
import type { FoodItem, Meal } from '../models/nutrition'
import type { DoseLog, IngredientDose, Supplement } from '../models/supplement'
import type { AppleHealthDailyRow, IDatabase } from '../ports/IDatabase'

// ─── DB row shapes (Postgres column names) ──────────────────────────────────

interface DbMealItem {
  id: string
  meal_id: string
  name: string
  portion_g: number | null
  calories: number | null
  protein_g: string | number | null
  carbs_g: string | number | null
  fat_g: string | number | null
  confidence: string | number | null
  source: string
}

interface DbMeal {
  id: string
  date: string
  time: string
  photo_path: string | null
  total_cals: number | null
  total_prot: string | number | null
  total_carbs: string | number | null
  total_fat: string | number | null
  meal_items: DbMealItem[]
}

interface DbDailyHealthMetrics {
  date: string
  readiness: number | null
  sleep_score: number | null
  hrv: string | number | null
  resting_hr: number | null
  sleep_minutes: number | null
  deep_minutes: number | null
  rem_minutes: number | null
  body_temp_dev: string | number | null
  steps: number | null
  active_cals: number | null
  sources: string[]
  synced_at: string
}

interface DbSupplementIngredient {
  id: string
  supplement_id: string
  name: string
  amount: string | number | null
  unit: string
}

interface DbSupplement {
  id: string
  name: string
  brand: string | null
  default_dose: string | null
  created_at: string
  supplement_ingredients: DbSupplementIngredient[]
}

interface DbDoseLog {
  id: string
  supplement_id: string
  date: string
  time: string
  dose_desc: string | null
  created_at: string
}

interface DbOuraTokens {
  id: number
  access_token: string
  refresh_token: string
  expires_at: string
  updated_at: string
}

interface DbAppleHealthDaily {
  date: string
  steps: number | null
  active_cals: number | null
  resting_hr: number | null
  workouts: unknown[] | null
  imported_at: string
}

// ─── Mappers (pure, exported for unit tests) ────────────────────────────────

const numOrUndef = (v: string | number | null): number | undefined =>
  v === null || v === undefined ? undefined : Number(v)

const numOrZero = (v: string | number | null): number =>
  v === null || v === undefined ? 0 : Number(v)

export function toDomainFoodItem(row: DbMealItem): FoodItem {
  return {
    name: row.name,
    portionGrams: numOrZero(row.portion_g),
    calories: row.calories ?? 0,
    proteinG: numOrZero(row.protein_g),
    carbsG: numOrZero(row.carbs_g),
    fatG: numOrZero(row.fat_g),
    confidence: numOrUndef(row.confidence),
    source: row.source as FoodItem['source'],
  }
}

export function toDomainMeal(row: DbMeal): Meal {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    photoStoragePath: row.photo_path ?? undefined,
    items: (row.meal_items ?? []).map(toDomainFoodItem),
    totalCalories: row.total_cals ?? 0,
    totalProteinG: numOrZero(row.total_prot),
    totalCarbsG: numOrZero(row.total_carbs),
    totalFatG: numOrZero(row.total_fat),
  }
}

export function toDomainHealthMetrics(row: DbDailyHealthMetrics): DailyHealthMetrics {
  return {
    date: row.date,
    readinessScore: row.readiness ?? undefined,
    sleepScore: row.sleep_score ?? undefined,
    hrv: numOrUndef(row.hrv),
    restingHR: row.resting_hr ?? undefined,
    sleepDuration: row.sleep_minutes ?? undefined,
    deepSleepMinutes: row.deep_minutes ?? undefined,
    remSleepMinutes: row.rem_minutes ?? undefined,
    bodyTempDeviation: numOrUndef(row.body_temp_dev),
    steps: row.steps ?? undefined,
    activeCalories: row.active_cals ?? undefined,
    sources: row.sources ?? [],
    syncedAt: row.synced_at,
  }
}

export function toDomainSupplement(row: DbSupplement): Supplement {
  const keyIngredients: IngredientDose[] = (row.supplement_ingredients ?? []).map((i) => ({
    name: i.name,
    amount: numOrZero(i.amount),
    unit: i.unit as IngredientDose['unit'],
  }))
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    keyIngredients,
    defaultDoseDescription: row.default_dose ?? '',
    createdAt: row.created_at,
  }
}

export function toDomainDoseLog(row: DbDoseLog): DoseLog {
  return {
    id: row.id,
    supplementId: row.supplement_id,
    date: row.date,
    time: row.time,
    doseDescription: row.dose_desc ?? undefined,
  }
}

export function toDomainOuraTokens(row: DbOuraTokens): OuraTokens {
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.expires_at,
  }
}

export function toDomainAppleHealthDaily(row: DbAppleHealthDaily): AppleHealthDailyRow {
  return {
    date: row.date,
    steps: row.steps ?? undefined,
    activeCals: row.active_cals ?? undefined,
    restingHr: row.resting_hr ?? undefined,
    workouts: row.workouts ?? undefined,
  }
}

// ─── Adapter ────────────────────────────────────────────────────────────────

function makeClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export class SupabaseAdapter implements IDatabase {
  private readonly client: SupabaseClient

  constructor(client?: SupabaseClient) {
    this.client = client ?? makeClient()
  }

  // ── Meals ─────────────────────────────────────────────────────────────────

  async getMeals(date: string): Promise<Meal[]> {
    const { data, error } = await this.client
      .from('meals')
      .select('*, meal_items(*)')
      .eq('date', date)
      .order('time')
    if (error) throw new Error(`getMeals: ${error.message}`)
    return (data ?? []).map(toDomainMeal)
  }

  async saveMeal(meal: Omit<Meal, 'id'>): Promise<Meal> {
    const { data: mealRow, error: mealErr } = await this.client
      .from('meals')
      .insert({
        date: meal.date,
        time: meal.time,
        photo_path: meal.photoStoragePath ?? null,
        total_cals: meal.totalCalories,
        total_prot: meal.totalProteinG,
        total_carbs: meal.totalCarbsG,
        total_fat: meal.totalFatG,
      })
      .select()
      .single()
    if (mealErr || !mealRow) throw new Error(`saveMeal: ${mealErr?.message ?? 'no row'}`)

    if (meal.items.length > 0) {
      const { error: itemsErr } = await this.client.from('meal_items').insert(
        meal.items.map((i) => ({
          meal_id: mealRow.id,
          name: i.name,
          portion_g: i.portionGrams,
          calories: i.calories,
          protein_g: i.proteinG,
          carbs_g: i.carbsG,
          fat_g: i.fatG,
          confidence: i.confidence ?? null,
          source: i.source,
        })),
      )
      if (itemsErr) throw new Error(`saveMeal.items: ${itemsErr.message}`)
    }

    return { id: mealRow.id, ...meal }
  }

  // ── Supplements ───────────────────────────────────────────────────────────

  async getSupplements(): Promise<Supplement[]> {
    const { data, error } = await this.client
      .from('supplements')
      .select('*, supplement_ingredients(*)')
      .order('created_at')
    if (error) throw new Error(`getSupplements: ${error.message}`)
    return (data ?? []).map(toDomainSupplement)
  }

  async saveSupplement(supplement: Omit<Supplement, 'id' | 'createdAt'>): Promise<Supplement> {
    const { data: row, error } = await this.client
      .from('supplements')
      .insert({
        name: supplement.name,
        brand: supplement.brand ?? null,
        default_dose: supplement.defaultDoseDescription,
      })
      .select()
      .single()
    if (error || !row) throw new Error(`saveSupplement: ${error?.message ?? 'no row'}`)

    if (supplement.keyIngredients.length > 0) {
      const { error: ingErr } = await this.client.from('supplement_ingredients').insert(
        supplement.keyIngredients.map((i) => ({
          supplement_id: row.id,
          name: i.name,
          amount: i.amount,
          unit: i.unit,
        })),
      )
      if (ingErr) throw new Error(`saveSupplement.ingredients: ${ingErr.message}`)
    }

    return {
      id: row.id,
      ...supplement,
      createdAt: row.created_at,
    }
  }

  async getSupplementLogs(date: string): Promise<DoseLog[]> {
    const { data, error } = await this.client
      .from('dose_logs')
      .select('*')
      .eq('date', date)
      .order('time')
    if (error) throw new Error(`getSupplementLogs: ${error.message}`)
    return (data ?? []).map(toDomainDoseLog)
  }

  async saveSupplementLog(log: Omit<DoseLog, 'id'>): Promise<DoseLog> {
    const { data, error } = await this.client
      .from('dose_logs')
      .insert({
        supplement_id: log.supplementId,
        date: log.date,
        time: log.time,
        dose_desc: log.doseDescription ?? null,
      })
      .select()
      .single()
    if (error || !data) throw new Error(`saveSupplementLog: ${error?.message ?? 'no row'}`)
    return toDomainDoseLog(data)
  }

  // ── Health metrics ────────────────────────────────────────────────────────

  async getHealthMetrics(date: string): Promise<DailyHealthMetrics | null> {
    const { data, error } = await this.client
      .from('daily_health_metrics')
      .select('*')
      .eq('date', date)
      .maybeSingle()
    if (error) throw new Error(`getHealthMetrics: ${error.message}`)
    return data ? toDomainHealthMetrics(data) : null
  }

  async getHealthMetricsRange(from: string, to: string): Promise<DailyHealthMetrics[]> {
    const { data, error } = await this.client
      .from('daily_health_metrics')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date')
    if (error) throw new Error(`getHealthMetricsRange: ${error.message}`)
    return (data ?? []).map(toDomainHealthMetrics)
  }

  async upsertHealthMetrics(m: DailyHealthMetrics): Promise<void> {
    const { error } = await this.client.from('daily_health_metrics').upsert(
      {
        date: m.date,
        readiness: m.readinessScore ?? null,
        sleep_score: m.sleepScore ?? null,
        hrv: m.hrv ?? null,
        resting_hr: m.restingHR ?? null,
        sleep_minutes: m.sleepDuration ?? null,
        deep_minutes: m.deepSleepMinutes ?? null,
        rem_minutes: m.remSleepMinutes ?? null,
        body_temp_dev: m.bodyTempDeviation ?? null,
        steps: m.steps ?? null,
        active_cals: m.activeCalories ?? null,
        sources: m.sources,
        synced_at: m.syncedAt,
      },
      { onConflict: 'date' },
    )
    if (error) throw new Error(`upsertHealthMetrics: ${error.message}`)
  }

  // ── Apple Health staging ──────────────────────────────────────────────────

  async upsertAppleHealthDaily(rows: AppleHealthDailyRow[]): Promise<void> {
    if (rows.length === 0) return
    const { error } = await this.client.from('apple_health_daily').upsert(
      rows.map((r) => ({
        date: r.date,
        steps: r.steps ?? null,
        active_cals: r.activeCals ?? null,
        resting_hr: r.restingHr ?? null,
        workouts: r.workouts ?? null,
      })),
      { onConflict: 'date' },
    )
    if (error) throw new Error(`upsertAppleHealthDaily: ${error.message}`)
  }

  async getAppleHealthDaily(date: string): Promise<AppleHealthDailyRow | null> {
    const { data, error } = await this.client
      .from('apple_health_daily')
      .select('*')
      .eq('date', date)
      .maybeSingle()
    if (error) throw new Error(`getAppleHealthDaily: ${error.message}`)
    return data ? toDomainAppleHealthDaily(data) : null
  }

  // ── Oura OAuth tokens ─────────────────────────────────────────────────────

  async getOuraTokens(): Promise<OuraTokens | null> {
    const { data, error } = await this.client
      .from('oura_tokens')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw new Error(`getOuraTokens: ${error.message}`)
    return data ? toDomainOuraTokens(data) : null
  }

  async saveOuraTokens(tokens: OuraTokens): Promise<void> {
    const { error } = await this.client.from('oura_tokens').upsert(
      {
        id: 1,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    if (error) throw new Error(`saveOuraTokens: ${error.message}`)
  }
}

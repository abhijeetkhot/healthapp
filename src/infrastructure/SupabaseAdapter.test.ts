import { describe, expect, it } from 'vitest'
import {
  toDomainAppleHealthDaily,
  toDomainDoseLog,
  toDomainFoodItem,
  toDomainHealthMetrics,
  toDomainMeal,
  toDomainOuraTokens,
  toDomainSupplement,
} from './SupabaseAdapter'

describe('toDomainFoodItem', () => {
  it('maps a fully-populated DB row to a domain FoodItem', () => {
    const result = toDomainFoodItem({
      id: 'x', meal_id: 'm',
      name: 'chicken', portion_g: 150, calories: 250,
      protein_g: '46.5', carbs_g: '0', fat_g: '5.5',
      confidence: '0.92', source: 'ai',
    })
    expect(result.name).toBe('chicken')
    expect(result.portionGrams).toBe(150)
    expect(result.calories).toBe(250)
    expect(result.proteinG).toBe(46.5)
    expect(result.fatG).toBe(5.5)
    expect(result.confidence).toBe(0.92)
    expect(result.source).toBe('ai')
  })

  it('treats null numeric DB values as zero for required macro fields', () => {
    const result = toDomainFoodItem({
      id: 'x', meal_id: 'm', name: 'unknown',
      portion_g: null, calories: null,
      protein_g: null, carbs_g: null, fat_g: null,
      confidence: null, source: 'manual',
    })
    expect(result.portionGrams).toBe(0)
    expect(result.calories).toBe(0)
    expect(result.proteinG).toBe(0)
  })

  it('leaves confidence undefined when null (it is optional, not zero)', () => {
    const result = toDomainFoodItem({
      id: 'x', meal_id: 'm', name: 'rice',
      portion_g: 100, calories: 130,
      protein_g: 2.7, carbs_g: 28, fat_g: 0.3,
      confidence: null, source: 'barcode',
    })
    expect(result.confidence).toBeUndefined()
  })
})

describe('toDomainMeal', () => {
  it('joins meal_items into the meal and renames totals', () => {
    const meal = toDomainMeal({
      id: 'meal-1', date: '2026-05-13', time: '12:30:00',
      photo_path: 'meal-photos/2026/05/13/abc.jpg',
      total_cals: 500, total_prot: '40', total_carbs: '60', total_fat: '15',
      meal_items: [
        {
          id: 'mi-1', meal_id: 'meal-1', name: 'chicken',
          portion_g: 150, calories: 250,
          protein_g: 30, carbs_g: 0, fat_g: 5,
          confidence: 0.9, source: 'ai',
        },
      ],
    })
    expect(meal.id).toBe('meal-1')
    expect(meal.photoStoragePath).toBe('meal-photos/2026/05/13/abc.jpg')
    expect(meal.totalCalories).toBe(500)
    expect(meal.totalProteinG).toBe(40)
    expect(meal.items).toHaveLength(1)
    expect(meal.items[0].name).toBe('chicken')
  })

  it('handles a meal with no items (defensive — should never happen in prod)', () => {
    const meal = toDomainMeal({
      id: 'm', date: '2026-05-13', time: '12:00:00',
      photo_path: null,
      total_cals: 0, total_prot: 0, total_carbs: 0, total_fat: 0,
      meal_items: [],
    })
    expect(meal.items).toEqual([])
    expect(meal.photoStoragePath).toBeUndefined()
  })
})

describe('toDomainHealthMetrics', () => {
  it('renames snake_case columns to camelCase fields', () => {
    const m = toDomainHealthMetrics({
      date: '2026-05-13',
      readiness: 85,
      sleep_score: 78,
      hrv: '42.5',
      resting_hr: 55,
      sleep_minutes: 420,
      deep_minutes: 90,
      rem_minutes: 110,
      body_temp_dev: '-0.10',
      steps: 8200,
      active_cals: 350,
      sources: ['oura', 'apple-health'],
      synced_at: '2026-05-13T12:00:00Z',
    })
    expect(m.readinessScore).toBe(85)
    expect(m.sleepScore).toBe(78)
    expect(m.hrv).toBe(42.5)
    expect(m.restingHR).toBe(55)
    expect(m.bodyTempDeviation).toBe(-0.1)
    expect(m.sources).toEqual(['oura', 'apple-health'])
  })

  it('preserves undefined for nullable optional fields (not zero)', () => {
    const m = toDomainHealthMetrics({
      date: '2026-05-13',
      readiness: null, sleep_score: null, hrv: null, resting_hr: null,
      sleep_minutes: null, deep_minutes: null, rem_minutes: null,
      body_temp_dev: null, steps: null, active_cals: null,
      sources: [],
      synced_at: '2026-05-13T12:00:00Z',
    })
    expect(m.readinessScore).toBeUndefined()
    expect(m.hrv).toBeUndefined()
    expect(m.steps).toBeUndefined()
    expect(m.sources).toEqual([])
  })
})

describe('toDomainSupplement', () => {
  it('joins ingredients and provides a default empty doseDescription', () => {
    const s = toDomainSupplement({
      id: 's-1', name: 'Magnesium Glycinate', brand: 'Thorne',
      default_dose: '400mg before bed',
      created_at: '2026-01-01T00:00:00Z',
      supplement_ingredients: [
        { id: 'i-1', supplement_id: 's-1', name: 'Magnesium', amount: 400, unit: 'mg' },
      ],
    })
    expect(s.name).toBe('Magnesium Glycinate')
    expect(s.brand).toBe('Thorne')
    expect(s.defaultDoseDescription).toBe('400mg before bed')
    expect(s.keyIngredients).toHaveLength(1)
    expect(s.keyIngredients[0].amount).toBe(400)
    expect(s.keyIngredients[0].unit).toBe('mg')
  })

  it('coerces a numeric-string amount to a number', () => {
    const s = toDomainSupplement({
      id: 's-1', name: 'X', brand: null, default_dose: null,
      created_at: '2026-01-01T00:00:00Z',
      supplement_ingredients: [
        { id: 'i-1', supplement_id: 's-1', name: 'X', amount: '12.5', unit: 'mg' },
      ],
    })
    expect(s.keyIngredients[0].amount).toBe(12.5)
    expect(s.brand).toBeUndefined()
    expect(s.defaultDoseDescription).toBe('')
  })
})

describe('toDomainDoseLog', () => {
  it('renames supplement_id and dose_desc', () => {
    const log = toDomainDoseLog({
      id: 'dl-1', supplement_id: 's-1',
      date: '2026-05-13', time: '08:00:00',
      dose_desc: '400mg', created_at: '2026-05-13T08:00:00Z',
    })
    expect(log.supplementId).toBe('s-1')
    expect(log.doseDescription).toBe('400mg')
  })

  it('leaves doseDescription undefined when null', () => {
    const log = toDomainDoseLog({
      id: 'dl-1', supplement_id: 's-1',
      date: '2026-05-13', time: '08:00:00',
      dose_desc: null, created_at: '2026-05-13T08:00:00Z',
    })
    expect(log.doseDescription).toBeUndefined()
  })
})

describe('toDomainOuraTokens', () => {
  it('renames snake_case to camelCase and drops id/updated_at', () => {
    const t = toDomainOuraTokens({
      id: 1,
      access_token: 'at_abc',
      refresh_token: 'rt_xyz',
      expires_at: '2026-05-13T12:00:00Z',
      updated_at: '2026-05-13T11:00:00Z',
    })
    expect(t).toEqual({
      accessToken: 'at_abc',
      refreshToken: 'rt_xyz',
      expiresAt: '2026-05-13T12:00:00Z',
    })
  })
})

describe('toDomainAppleHealthDaily', () => {
  it('renames columns and maps null to undefined', () => {
    const row = toDomainAppleHealthDaily({
      date: '2026-05-13',
      steps: 8200,
      active_cals: 350,
      resting_hr: null,
      workouts: [{ activity: 'running' }],
      imported_at: '2026-05-13T20:00:00Z',
    })
    expect(row.date).toBe('2026-05-13')
    expect(row.steps).toBe(8200)
    expect(row.activeCals).toBe(350)
    expect(row.restingHr).toBeUndefined()
    expect(row.workouts).toEqual([{ activity: 'running' }])
  })
})

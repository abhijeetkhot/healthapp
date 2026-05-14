import { describe, expect, it } from 'vitest'
import { FoodItemSchema, IdentifiedFoodSchema, type FoodItem, sumMacros } from './nutrition'

const make = (over: Partial<FoodItem> = {}): FoodItem => ({
  name: 'chicken breast',
  portionGrams: 100,
  calories: 165,
  proteinG: 31,
  carbsG: 0,
  fatG: 3.6,
  source: 'ai',
  ...over,
})

describe('sumMacros', () => {
  it('returns all zeros for an empty array', () => {
    expect(sumMacros([])).toEqual({
      totalCalories: 0,
      totalProteinG: 0,
      totalCarbsG: 0,
      totalFatG: 0,
    })
  })

  it('returns a single item unchanged', () => {
    const totals = sumMacros([make()])
    expect(totals).toEqual({
      totalCalories: 165,
      totalProteinG: 31,
      totalCarbsG: 0,
      totalFatG: 3.6,
    })
  })

  it('sums across multiple items', () => {
    const totals = sumMacros([
      make(),
      make({ name: 'rice', calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 }),
    ])
    expect(totals.totalCalories).toBe(295)
    expect(totals.totalProteinG).toBeCloseTo(33.7, 5)
    expect(totals.totalCarbsG).toBe(28)
    expect(totals.totalFatG).toBeCloseTo(3.9, 5)
  })
})

describe('IdentifiedFoodSchema', () => {
  it('accepts a well-formed AI response', () => {
    const parsed = IdentifiedFoodSchema.parse({
      name: 'avocado',
      portionGrams: 80,
      confidence: 0.92,
    })
    expect(parsed.name).toBe('avocado')
  })

  it('rejects zero portion (AI must estimate something)', () => {
    expect(() =>
      IdentifiedFoodSchema.parse({ name: 'x', portionGrams: 0, confidence: 0.5 }),
    ).toThrow()
  })

  it('rejects confidence outside [0, 1]', () => {
    expect(() =>
      IdentifiedFoodSchema.parse({ name: 'x', portionGrams: 50, confidence: 1.5 }),
    ).toThrow()
  })

  it('rejects empty name', () => {
    expect(() =>
      IdentifiedFoodSchema.parse({ name: '', portionGrams: 50, confidence: 0.8 }),
    ).toThrow()
  })
})

describe('FoodItemSchema', () => {
  it('round-trips a valid item through parse', () => {
    const item = make()
    const parsed = FoodItemSchema.parse(item)
    expect(parsed).toEqual(item)
  })

  it('rejects negative calories', () => {
    expect(() => FoodItemSchema.parse(make({ calories: -1 }))).toThrow()
  })

  it("rejects unknown source values", () => {
    expect(() => FoodItemSchema.parse(make({ source: 'guess' as never }))).toThrow()
  })
})

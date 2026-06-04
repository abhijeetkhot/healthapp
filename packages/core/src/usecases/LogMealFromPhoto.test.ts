import { describe, expect, it } from 'vitest'
import type { IdentifiedFood } from '../models/nutrition'
import { enrichWithMacros } from './LogMealFromPhoto'

const ai = (over: Partial<IdentifiedFood> = {}): IdentifiedFood => ({
  name: 'chicken breast',
  portionGrams: 100,
  confidence: 0.9,
  ...over,
})

describe('enrichWithMacros', () => {
  it('returns zeroed macros when USDA lookup failed', () => {
    const result = enrichWithMacros(ai(), null)
    expect(result.calories).toBe(0)
    expect(result.proteinG).toBe(0)
    expect(result.carbsG).toBe(0)
    expect(result.fatG).toBe(0)
    expect(result.source).toBe('ai')
    expect(result.confidence).toBe(0.9)
  })

  it('scales per-100g macros to actual portion size', () => {
    const per100g = { kcal: 165, protein: 31, carbs: 0, fat: 3.6 }
    const result = enrichWithMacros(ai({ portionGrams: 200 }), per100g)
    expect(result.calories).toBe(330)
    expect(result.proteinG).toBe(62)
    expect(result.carbsG).toBe(0)
    expect(result.fatG).toBe(7.2)
  })

  it('rounds calories to whole numbers and macros to one decimal', () => {
    const per100g = { kcal: 165.7, protein: 31.234, carbs: 0.567, fat: 3.65 }
    const result = enrichWithMacros(ai({ portionGrams: 150 }), per100g)
    expect(Number.isInteger(result.calories)).toBe(true)
    expect(result.proteinG.toString()).toMatch(/^\d+(\.\d)?$/)
    expect(result.fatG.toString()).toMatch(/^\d+(\.\d)?$/)
  })

  it('preserves the original name, portion, and confidence', () => {
    const result = enrichWithMacros(
      ai({ name: 'salmon fillet', portionGrams: 175, confidence: 0.72 }),
      { kcal: 208, protein: 20, carbs: 0, fat: 13 },
    )
    expect(result.name).toBe('salmon fillet')
    expect(result.portionGrams).toBe(175)
    expect(result.confidence).toBe(0.72)
  })

  it('handles small portions (< 100g) by scaling down', () => {
    const per100g = { kcal: 884, protein: 0, carbs: 0, fat: 100 } // olive oil
    const result = enrichWithMacros(ai({ name: 'olive oil', portionGrams: 14 }), per100g)
    expect(result.calories).toBe(124)
    expect(result.fatG).toBe(14)
  })
})

import { z } from 'zod'

export const IdentifiedFoodSchema = z.object({
  name: z.string().min(1),
  portionGrams: z.number().positive(),
  confidence: z.number().min(0).max(1),
})
export type IdentifiedFood = z.infer<typeof IdentifiedFoodSchema>

export const FoodItemSchema = z.object({
  name: z.string().min(1),
  portionGrams: z.number().positive(),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.enum(['ai', 'barcode', 'manual']),
})
export type FoodItem = z.infer<typeof FoodItemSchema>

export const MealSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  photoStoragePath: z.string().optional(),
  items: z.array(FoodItemSchema),
  totalCalories: z.number().nonnegative(),
  totalProteinG: z.number().nonnegative(),
  totalCarbsG: z.number().nonnegative(),
  totalFatG: z.number().nonnegative(),
})
export type Meal = z.infer<typeof MealSchema>

export interface MacroSummary {
  totalCalories: number
  totalProteinG: number
  totalCarbsG: number
  totalFatG: number
}

export function sumMacros(items: FoodItem[]): MacroSummary {
  return items.reduce<MacroSummary>(
    (acc, i) => ({
      totalCalories: acc.totalCalories + i.calories,
      totalProteinG: acc.totalProteinG + i.proteinG,
      totalCarbsG: acc.totalCarbsG + i.carbsG,
      totalFatG: acc.totalFatG + i.fatG,
    }),
    { totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0 },
  )
}

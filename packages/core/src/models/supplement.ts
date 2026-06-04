import { z } from 'zod'

export const IngredientDoseSchema = z.object({
  name: z.string().min(1),
  amount: z.number().nonnegative(),
  unit: z.enum(['mg', 'mcg', 'IU', 'g']),
})
export type IngredientDose = z.infer<typeof IngredientDoseSchema>

export const SupplementSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  brand: z.string().optional(),
  keyIngredients: z.array(IngredientDoseSchema),
  defaultDoseDescription: z.string(),
  createdAt: z.string(),
})
export type Supplement = z.infer<typeof SupplementSchema>

export const DoseLogSchema = z.object({
  id: z.string().uuid(),
  supplementId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  doseDescription: z.string().optional(),
})
export type DoseLog = z.infer<typeof DoseLogSchema>

// Raw extraction from Claude Vision for a supplement label.
// Distinct from `Supplement` because it has no id, no created_at, and the
// shape mirrors what the AI returns (servingSize, ingredients[]).
export const SupplementInfoSchema = z.object({
  name: z.string().min(1),
  brand: z.string().nullable(),
  servingSize: z.string(),
  ingredients: z.array(IngredientDoseSchema),
})
export type SupplementInfo = z.infer<typeof SupplementInfoSchema>

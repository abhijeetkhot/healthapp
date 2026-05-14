import { type FoodItem, type IdentifiedFood, type Meal, sumMacros } from '../models/nutrition'
import type { IFoodAI } from '../ports/IFoodAI'
import type { IStorage } from '../ports/IStorage'
import { type Result, err, ok } from '../Result'

interface UsdaFood {
  description: string
  foodNutrients: Array<{ nutrientName: string; value: number }>
}

const USDA_SEARCH = 'https://api.nal.usda.gov/fdc/v1/foods/search'

async function fetchUsdaMacros(name: string): Promise<{ kcal: number; protein: number; carbs: number; fat: number } | null> {
  const url = `${USDA_SEARCH}?query=${encodeURIComponent(name)}&pageSize=1`
  const res = await fetch(url)
  if (!res.ok) return null
  const body = (await res.json()) as { foods?: UsdaFood[] }
  const top = body.foods?.[0]
  if (!top) return null

  const get = (n: string): number =>
    top.foodNutrients.find((f) => f.nutrientName.toLowerCase().includes(n))?.value ?? 0
  return {
    kcal: get('energy'),
    protein: get('protein'),
    carbs: get('carbohydrate'),
    fat: get('total lipid'),
  }
}

export function enrichWithMacros(id: IdentifiedFood, per100g: { kcal: number; protein: number; carbs: number; fat: number } | null): FoodItem {
  const scale = id.portionGrams / 100
  if (!per100g) {
    return {
      name: id.name,
      portionGrams: id.portionGrams,
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      confidence: id.confidence,
      source: 'ai',
    }
  }
  return {
    name: id.name,
    portionGrams: id.portionGrams,
    calories: Math.round(per100g.kcal * scale),
    proteinG: Math.round(per100g.protein * scale * 10) / 10,
    carbsG: Math.round(per100g.carbs * scale * 10) / 10,
    fatG: Math.round(per100g.fat * scale * 10) / 10,
    confidence: id.confidence,
    source: 'ai',
  }
}

export interface MealCandidate {
  items: FoodItem[]
  photoStoragePath?: string
}

export async function logMealFromPhoto(
  storage: IStorage,
  foodAI: IFoodAI,
  imageBase64: string,
): Promise<Result<MealCandidate>> {
  try {
    const [uploadResult, identified] = await Promise.all([
      storage.uploadMealPhoto(imageBase64),
      foodAI.identifyFoodsFromImage(imageBase64),
    ])
    if (identified.length === 0) {
      return err(new Error('No foods recognised in image'))
    }
    const enriched = await Promise.all(
      identified.map(async (id) => enrichWithMacros(id, await fetchUsdaMacros(id.name))),
    )
    return ok({
      items: enriched,
      photoStoragePath: uploadResult.ok ? uploadResult.value : undefined,
    })
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }
}

export type ConfirmedMeal = Omit<Meal, 'id'>

export function buildMealFromConfirmation(
  date: string,
  time: string,
  items: FoodItem[],
  photoStoragePath?: string,
): ConfirmedMeal {
  const totals = sumMacros(items)
  return {
    date,
    time,
    photoStoragePath,
    items,
    ...totals,
  }
}

import type { FoodItem } from '../models/nutrition'
import { type Result, err, ok } from '../Result'

const OFF_PRODUCT = 'https://world.openfoodfacts.org/api/v0/product'

interface OffResponse {
  status: number
  product?: {
    product_name?: string
    serving_quantity?: string | number
    nutriments?: {
      'energy-kcal_serving'?: number
      'proteins_serving'?: number
      'carbohydrates_serving'?: number
      'fat_serving'?: number
    }
  }
}

export async function logMealFromBarcode(barcode: string): Promise<Result<FoodItem>> {
  try {
    const res = await fetch(`${OFF_PRODUCT}/${encodeURIComponent(barcode)}.json`)
    if (!res.ok) return err(new Error(`OpenFoodFacts ${res.status}`))
    const body = (await res.json()) as OffResponse
    if (body.status !== 1 || !body.product) {
      return err(new Error(`Barcode ${barcode} not found`))
    }
    const p = body.product
    const n = p.nutriments ?? {}
    const portion = typeof p.serving_quantity === 'string'
      ? Number(p.serving_quantity)
      : p.serving_quantity ?? 100

    return ok({
      name: p.product_name ?? 'Unknown product',
      portionGrams: Number.isFinite(portion) ? Number(portion) : 100,
      calories: n['energy-kcal_serving'] ?? 0,
      proteinG: n.proteins_serving ?? 0,
      carbsG: n.carbohydrates_serving ?? 0,
      fatG: n.fat_serving ?? 0,
      confidence: 1.0,
      source: 'barcode',
    })
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }
}

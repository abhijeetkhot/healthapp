import { type MacroSummary, type Meal, sumMacros } from '../models/nutrition'
import type { IDatabase } from '../ports/IDatabase'
import type { IFoodAI } from '../ports/IFoodAI'
import { type Result, err, ok } from '../Result'

export class NutritionService {
  constructor(
    private readonly db: IDatabase,
    readonly foodAI: IFoodAI,
  ) {}

  async getMeals(date: string): Promise<Result<Meal[]>> {
    try {
      return ok(await this.db.getMeals(date))
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  async getDailyMacros(date: string): Promise<Result<MacroSummary>> {
    const result = await this.getMeals(date)
    if (!result.ok) return result
    const items = result.value.flatMap((m) => m.items)
    return ok(sumMacros(items))
  }

  async saveMeal(meal: Omit<Meal, 'id'>): Promise<Result<Meal>> {
    try {
      return ok(await this.db.saveMeal(meal))
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }
}

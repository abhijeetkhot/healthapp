// Main entry point for @health/core package.
// Sub-path imports (@health/core/container, @health/core/Result, etc.)
// are resolved directly via tsconfig paths.
export type { Result } from './Result'
export { ok, err } from './Result'
export type { DailyHealthMetrics, OuraTokens } from './models/health'
export type { FoodItem, IdentifiedFood, Meal, MacroSummary } from './models/nutrition'
export type { DoseLog, Supplement, SupplementInfo, IngredientDose } from './models/supplement'
export type { IDatabase, AppleHealthDailyRow } from './ports/IDatabase'
export type { IFoodAI } from './ports/IFoodAI'
export type { IHealthDataProvider, HealthSourceName } from './ports/IHealthDataProvider'
export type { IStorage } from './ports/IStorage'

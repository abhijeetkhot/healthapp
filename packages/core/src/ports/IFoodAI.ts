import type { IdentifiedFood } from '../models/nutrition'
import type { SupplementInfo } from '../models/supplement'

export interface IFoodAI {
  identifyFoodsFromImage(imageBase64: string): Promise<IdentifiedFood[]>
  extractSupplementFromLabel(imageBase64: string): Promise<SupplementInfo>
}

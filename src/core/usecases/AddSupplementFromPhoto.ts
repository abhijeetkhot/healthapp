import type { SupplementInfo } from '../models/supplement'
import type { IFoodAI } from '../ports/IFoodAI'
import { type Result, err, ok } from '../Result'

export async function extractSupplementFromPhoto(
  foodAI: IFoodAI,
  imageBase64: string,
): Promise<Result<SupplementInfo>> {
  try {
    return ok(await foodAI.extractSupplementFromLabel(imageBase64))
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }
}

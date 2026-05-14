import type { DoseLog } from '../models/supplement'
import type { SupplementService } from '../services/SupplementService'
import type { Result } from '../Result'

export async function logSupplement(
  supplements: SupplementService,
  supplementId: string,
  doseDescription?: string,
): Promise<Result<DoseLog>> {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 8)
  return supplements.logDose(supplementId, date, time, doseDescription)
}

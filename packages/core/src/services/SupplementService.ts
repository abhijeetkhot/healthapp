import type { DoseLog, Supplement } from '../models/supplement'
import type { IDatabase } from '../ports/IDatabase'
import { type Result, err, ok } from '../Result'

export class SupplementService {
  constructor(private readonly db: IDatabase) {}

  async getStack(): Promise<Result<Supplement[]>> {
    try {
      return ok(await this.db.getSupplements())
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  async getLogsForDate(date: string): Promise<Result<DoseLog[]>> {
    try {
      return ok(await this.db.getSupplementLogs(date))
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  async logDose(supplementId: string, date: string, time: string, doseDescription?: string): Promise<Result<DoseLog>> {
    try {
      return ok(await this.db.saveSupplementLog({ supplementId, date, time, doseDescription }))
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  async addSupplement(supplement: Omit<Supplement, 'id' | 'createdAt'>): Promise<Result<Supplement>> {
    try {
      return ok(await this.db.saveSupplement(supplement))
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }
}

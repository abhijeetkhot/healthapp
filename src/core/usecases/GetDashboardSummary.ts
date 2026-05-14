import type { DashboardService, DashboardSummary } from '../services/DashboardService'
import type { Result } from '../Result'

export async function getDashboardSummary(
  dashboard: DashboardService,
  date: string,
): Promise<Result<DashboardSummary>> {
  return dashboard.getDashboardSummary(date)
}

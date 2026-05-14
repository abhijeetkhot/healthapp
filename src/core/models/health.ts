import { z } from 'zod'

export const DailyHealthMetricsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  readinessScore: z.number().min(0).max(100).optional(),
  sleepScore: z.number().min(0).max(100).optional(),
  hrv: z.number().nonnegative().optional(),
  restingHR: z.number().int().positive().optional(),
  sleepDuration: z.number().nonnegative().optional(),
  deepSleepMinutes: z.number().nonnegative().optional(),
  remSleepMinutes: z.number().nonnegative().optional(),
  bodyTempDeviation: z.number().optional(),
  steps: z.number().int().nonnegative().optional(),
  activeCalories: z.number().nonnegative().optional(),
  sources: z.array(z.string()),
  syncedAt: z.string(),
})
export type DailyHealthMetrics = z.infer<typeof DailyHealthMetricsSchema>

export interface OuraTokens {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

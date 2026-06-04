import { z } from 'zod'
import type { DailyHealthMetrics, OuraTokens } from '../models/health'
import type { IDatabase } from '../ports/IDatabase'
import type { HealthSourceName, IHealthDataProvider } from '../ports/IHealthDataProvider'

const OURA_API = 'https://api.ouraring.com/v2/usercollection'
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token'

// ─── Response schemas (loose — Oura adds fields freely) ─────────────────────

const ReadinessItem = z.object({
  day: z.string(),
  score: z.number().nullable().optional(),
  temperature_deviation: z.number().nullable().optional(),
})

const SleepDailyItem = z.object({
  day: z.string(),
  score: z.number().nullable().optional(),
})

const SleepPeriodItem = z.object({
  day: z.string(),
  type: z.string(),
  average_hrv: z.number().nullable().optional(),
  lowest_heart_rate: z.number().nullable().optional(),
  total_sleep_duration: z.number().nullable().optional(), // seconds
  deep_sleep_duration: z.number().nullable().optional(),  // seconds
  rem_sleep_duration: z.number().nullable().optional(),   // seconds
})

const ActivityItem = z.object({
  day: z.string(),
  steps: z.number().nullable().optional(),
  active_calories: z.number().nullable().optional(),
})

const ListResponse = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.array(item) })

const TokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(), // seconds
})

// ─── Adapter ────────────────────────────────────────────────────────────────

export class OuraApiAdapter implements IHealthDataProvider {
  readonly sourceName: HealthSourceName = 'oura'

  constructor(private readonly db: IDatabase) {}

  async getMetrics(date: string): Promise<Partial<DailyHealthMetrics>> {
    const token = await this.getValidToken()
    const headers = { Authorization: `Bearer ${token}` }
    const dateParams = `?start_date=${date}&end_date=${date}`

    const [readiness, dailySleep, sleepPeriods, activity] = await Promise.all([
      this.fetchJson(`${OURA_API}/daily_readiness${dateParams}`, headers, ListResponse(ReadinessItem)),
      this.fetchJson(`${OURA_API}/daily_sleep${dateParams}`, headers, ListResponse(SleepDailyItem)),
      this.fetchJson(`${OURA_API}/sleep${dateParams}`, headers, ListResponse(SleepPeriodItem)),
      this.fetchJson(`${OURA_API}/daily_activity${dateParams}`, headers, ListResponse(ActivityItem)),
    ])

    const r = readiness.data[0]
    const s = dailySleep.data[0]
    // The main night's sleep is type "long_sleep". Fall back to the first
    // period if Oura hasn't classified one yet.
    const sleep = sleepPeriods.data.find((p) => p.type === 'long_sleep') ?? sleepPeriods.data[0]
    const a = activity.data[0]

    const secondsToMinutes = (sec: number | null | undefined): number | undefined =>
      sec == null ? undefined : Math.round(sec / 60)

    return {
      readinessScore: r?.score ?? undefined,
      sleepScore: s?.score ?? undefined,
      hrv: sleep?.average_hrv ?? undefined,
      restingHR: sleep?.lowest_heart_rate ?? undefined,
      sleepDuration: secondsToMinutes(sleep?.total_sleep_duration),
      deepSleepMinutes: secondsToMinutes(sleep?.deep_sleep_duration),
      remSleepMinutes: secondsToMinutes(sleep?.rem_sleep_duration),
      bodyTempDeviation: r?.temperature_deviation ?? undefined,
      steps: a?.steps ?? undefined,
      activeCalories: a?.active_calories ?? undefined,
    }
  }

  // ── Token management ──────────────────────────────────────────────────────

  private async getValidToken(): Promise<string> {
    const tokens = await this.db.getOuraTokens()
    if (!tokens) throw new Error('Oura not connected — run OAuth flow first')

    const expiresInMs = new Date(tokens.expiresAt).getTime() - Date.now()
    if (expiresInMs < 60_000) {
      const refreshed = await this.refreshTokens(tokens.refreshToken)
      await this.db.saveOuraTokens(refreshed)
      return refreshed.accessToken
    }
    return tokens.accessToken
  }

  private async refreshTokens(refreshToken: string): Promise<OuraTokens> {
    const clientId = process.env.OURA_CLIENT_ID
    const clientSecret = process.env.OURA_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error('OURA_CLIENT_ID and OURA_CLIENT_SECRET must be set')
    }

    const res = await fetch(OURA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    if (!res.ok) {
      throw new Error(`Oura token refresh ${res.status}: ${await res.text()}`)
    }
    const parsed = TokenResponse.parse(await res.json())
    return {
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token,
      expiresAt: new Date(Date.now() + parsed.expires_in * 1000).toISOString(),
    }
  }

  // ── HTTP helper ───────────────────────────────────────────────────────────

  private async fetchJson<T>(url: string, headers: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
    const res = await fetch(url, { headers })
    if (!res.ok) {
      throw new Error(`Oura ${url} ${res.status}: ${await res.text()}`)
    }
    return schema.parse(await res.json())
  }
}

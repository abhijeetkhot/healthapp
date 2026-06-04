import { describe, expect, it, vi } from 'vitest'
import type { DailyHealthMetrics } from '../models/health'
import { HealthSyncService } from '../services/HealthSyncService'
import { ok, type Result } from '../Result'
import { syncWearableData } from './SyncWearableData'

const minutesAgo = (n: number): string => new Date(Date.now() - n * 60_000).toISOString()

function makeFakeService(opts: {
  cached?: DailyHealthMetrics | null
  syncResponse: DailyHealthMetrics
}) {
  const getMetrics = vi.fn(async (): Promise<Result<DailyHealthMetrics | null>> => ok(opts.cached ?? null))
  const syncDate = vi.fn(async (): Promise<Result<DailyHealthMetrics>> => ok(opts.syncResponse))
  // Cast through unknown — we only need the two methods syncWearableData calls.
  const fake = { getMetrics, syncDate } as unknown as HealthSyncService
  return { fake, getMetrics, syncDate }
}

const fresh: DailyHealthMetrics = {
  date: '2026-05-13',
  readinessScore: 80,
  sources: ['oura'],
  syncedAt: new Date().toISOString(),
}

describe('syncWearableData', () => {
  it('returns cached row when it is < 60 minutes old, without calling syncDate', async () => {
    const { fake, syncDate } = makeFakeService({
      cached: { ...fresh, syncedAt: minutesAgo(10) },
      syncResponse: fresh,
    })
    const result = await syncWearableData(fake, '2026-05-13')
    expect(result.ok).toBe(true)
    expect(syncDate).not.toHaveBeenCalled()
    if (result.ok) expect(result.value.readinessScore).toBe(80)
  })

  it('re-syncs when cached row is older than 60 minutes', async () => {
    const stale = { ...fresh, syncedAt: minutesAgo(90), readinessScore: 50 }
    const refreshed = { ...fresh, readinessScore: 90 }
    const { fake, syncDate } = makeFakeService({ cached: stale, syncResponse: refreshed })

    const result = await syncWearableData(fake, '2026-05-13')
    expect(syncDate).toHaveBeenCalledOnce()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.readinessScore).toBe(90)
  })

  it('syncs when no cached row exists', async () => {
    const { fake, syncDate } = makeFakeService({ cached: null, syncResponse: fresh })
    const result = await syncWearableData(fake, '2026-05-13')
    expect(syncDate).toHaveBeenCalledOnce()
    expect(result.ok).toBe(true)
  })

  it('uses exactly 60 minutes as the stale boundary', async () => {
    const justStale = { ...fresh, syncedAt: minutesAgo(60) }
    const { fake, syncDate } = makeFakeService({ cached: justStale, syncResponse: fresh })
    await syncWearableData(fake, '2026-05-13')
    expect(syncDate).toHaveBeenCalledOnce()
  })
})

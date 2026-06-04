import { describe, expect, it, vi, beforeAll } from 'vitest'
import { err, ok } from '@health/core'
import type { DailyHealthMetrics } from '@health/core/models/health'
import { buildTestApp } from '../testApp'

vi.mock('@health/core/container', () => ({
  services: {
    health: {},
  },
}))

vi.mock('@health/core/usecases/SyncWearableData', () => ({
  syncWearableData: vi.fn(),
}))

import { syncWearableData } from '@health/core/usecases/SyncWearableData'

let app: Awaited<ReturnType<typeof buildTestApp>>

beforeAll(async () => {
  app = await buildTestApp()
})

const metrics: DailyHealthMetrics = {
  date: '2026-05-19',
  readinessScore: 85,
  sleepScore: 78,
  hrv: 42,
  restingHR: 55,
  sleepDuration: 450,
  sources: ['oura'],
  syncedAt: '2026-05-19T08:00:00Z',
}

describe('POST /api/sync', () => {
  it('returns 200 with synced metrics', async () => {
    vi.mocked(syncWearableData).mockResolvedValueOnce(ok(metrics))
    const res = await app.inject({ method: 'POST', url: '/api/sync' })
    expect(res.statusCode).toBe(200)
    expect(res.json().readinessScore).toBe(85)
    expect(res.json().sources).toContain('oura')
  })

  it('returns 500 when sync fails', async () => {
    vi.mocked(syncWearableData).mockResolvedValueOnce(err(new Error('Oura API unreachable')))
    const res = await app.inject({ method: 'POST', url: '/api/sync' })
    expect(res.statusCode).toBe(500)
    expect(res.json().error).toBe('Oura API unreachable')
  })
})

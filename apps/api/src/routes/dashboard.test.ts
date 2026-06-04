import { describe, expect, it, vi, beforeAll } from 'vitest'
import { err, ok } from '@health/core'
import type { DashboardSummary } from '@health/core/services/DashboardService'
import { buildTestApp } from '../testApp'

const { mockGetDashboardSummary } = vi.hoisted(() => ({
  mockGetDashboardSummary: vi.fn(),
}))

vi.mock('@health/core/container', () => ({
  services: {
    dashboard: { getDashboardSummary: mockGetDashboardSummary },
  },
}))

let app: Awaited<ReturnType<typeof buildTestApp>>

beforeAll(async () => {
  app = await buildTestApp()
})

const summary: DashboardSummary = {
  date: '2026-05-19',
  metrics: null,
  nutrition: { totalCalories: 1800, totalProteinG: 120, totalCarbsG: 200, totalFatG: 60 },
  supplements: { stack: [], logsToday: [] },
}

describe('GET /api/dashboard', () => {
  it('returns 200 with dashboard data', async () => {
    mockGetDashboardSummary.mockResolvedValueOnce(ok(summary))
    const res = await app.inject({ method: 'GET', url: '/api/dashboard?date=2026-05-19' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.date).toBe('2026-05-19')
    expect(body.nutrition.totalCalories).toBe(1800)
  })

  it('returns 400 when date query param is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dashboard' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when date format is invalid', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dashboard?date=19-05-2026' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 500 when service fails', async () => {
    mockGetDashboardSummary.mockResolvedValueOnce(err(new Error('DB unavailable')))
    const res = await app.inject({ method: 'GET', url: '/api/dashboard?date=2026-05-19' })
    expect(res.statusCode).toBe(500)
    expect(res.json().error).toBe('DB unavailable')
  })
})

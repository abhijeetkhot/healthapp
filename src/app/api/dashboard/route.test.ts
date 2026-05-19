import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '@/core/Result'
import type { DashboardSummary } from '@/core/services/DashboardService'

const mockGetDashboardSummary = vi.fn()

vi.mock('@/container', () => ({
  services: {
    dashboard: {
      getDashboardSummary: mockGetDashboardSummary,
    },
  },
}))

const { GET } = await import('./route')

const summary: DashboardSummary = {
  date: '2026-05-19',
  metrics: null,
  nutrition: { totalCalories: 1800, totalProteinG: 120, totalCarbsG: 200, totalFatG: 60 },
  supplements: { stack: [], logsToday: [] },
}

function makeRequest(date: string | null) {
  const url = date
    ? `http://localhost/api/dashboard?date=${date}`
    : 'http://localhost/api/dashboard'
  return new Request(url)
}

describe('GET /api/dashboard', () => {
  it('returns 200 with dashboard data', async () => {
    mockGetDashboardSummary.mockResolvedValueOnce(ok(summary))

    const response = await GET(makeRequest('2026-05-19'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.date).toBe('2026-05-19')
    expect(body.nutrition.totalCalories).toBe(1800)
  })

  it('returns 400 when date query param is missing', async () => {
    const response = await GET(makeRequest(null))
    expect(response.status).toBe(400)
  })

  it('returns 400 when date format is invalid', async () => {
    const response = await GET(makeRequest('19-05-2026'))
    expect(response.status).toBe(400)
  })

  it('returns 500 when service fails', async () => {
    mockGetDashboardSummary.mockResolvedValueOnce(err(new Error('DB unavailable')))

    const response = await GET(makeRequest('2026-05-19'))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('DB unavailable')
  })
})

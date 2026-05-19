import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '@/core/Result'

const mockUpsertAppleHealthDaily = vi.fn()
const mockSyncDate = vi.fn()
const mockGetMetrics = vi.fn()

vi.mock('@/container', () => ({
  services: {
    db: {
      upsertAppleHealthDaily: mockUpsertAppleHealthDaily,
    },
    health: {
      syncDate: mockSyncDate,
      getMetrics: mockGetMetrics,
    },
  },
}))

const { POST } = await import('./route')

const validRows = [
  { date: '2026-05-01', steps: 8000, activeCals: 400 },
  { date: '2026-05-02', steps: 10000, activeCals: 500, restingHr: 58 },
]

describe('POST /api/health/import', () => {
  it('returns 200 with import result on success', async () => {
    mockUpsertAppleHealthDaily.mockResolvedValueOnce(undefined)
    mockGetMetrics.mockResolvedValue(ok(null))
    mockSyncDate.mockResolvedValue(ok({ date: '2026-05-01', sources: [], syncedAt: '' }))

    const request = new Request('http://localhost/api/health/import', {
      method: 'POST',
      body: JSON.stringify({ rows: validRows }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.imported).toBe(2)
    expect(body.datesAffected).toEqual(['2026-05-01', '2026-05-02'])
  })

  it('returns 400 when body is not valid JSON', async () => {
    const request = new Request('http://localhost/api/health/import', {
      method: 'POST',
      body: 'not json',
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid request')
  })

  it('returns 400 when rows have invalid date format', async () => {
    const request = new Request('http://localhost/api/health/import', {
      method: 'POST',
      body: JSON.stringify({ rows: [{ date: '01-05-2026', steps: 100 }] }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 when rows array exceeds 5000 limit', async () => {
    const rows = Array.from({ length: 5001 }, (_, i) => ({
      date: `2020-01-${String((i % 28) + 1).padStart(2, '0')}`,
    }))
    const request = new Request('http://localhost/api/health/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 500 when import fails', async () => {
    mockUpsertAppleHealthDaily.mockRejectedValueOnce(new Error('DB error'))

    const request = new Request('http://localhost/api/health/import', {
      method: 'POST',
      body: JSON.stringify({ rows: validRows }),
    })
    const response = await POST(request)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('DB error')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '@/core/Result'
import type { DailyHealthMetrics } from '@/core/models/health'

const mockSyncDate = vi.fn()
const mockGetMetrics = vi.fn()

vi.mock('@/container', () => ({
  services: {
    health: {
      syncDate: mockSyncDate,
      getMetrics: mockGetMetrics,
    },
  },
}))

const { POST } = await import('./route')

const metrics: DailyHealthMetrics = {
  date: '2026-05-19',
  readinessScore: 85,
  sources: ['oura'],
  syncedAt: new Date().toISOString(),
}

describe('POST /api/sync', () => {
  it('returns 200 with synced metrics on success', async () => {
    // getMetrics returns null so syncDate is called
    mockGetMetrics.mockResolvedValueOnce(ok(null))
    mockSyncDate.mockResolvedValueOnce(ok(metrics))

    const response = await POST()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.date).toBe('2026-05-19')
    expect(body.readinessScore).toBe(85)
  })

  it('returns 500 with error message when sync fails', async () => {
    mockGetMetrics.mockResolvedValueOnce(ok(null))
    mockSyncDate.mockResolvedValueOnce(err(new Error('Oura API error')))

    const response = await POST()
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Oura API error')
  })
})

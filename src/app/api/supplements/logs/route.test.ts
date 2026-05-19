import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '@/core/Result'
import type { DoseLog } from '@/core/models/supplement'

const mockGetLogsForDate = vi.fn()
const mockLogDose = vi.fn()

vi.mock('@/container', () => ({
  services: {
    supplements: {
      getLogsForDate: mockGetLogsForDate,
      logDose: mockLogDose,
    },
  },
}))

const { GET, POST } = await import('./route')

const SUPPLEMENT_ID = '12345678-1234-4234-b234-123456789012'
const LOG_ID = '12345678-1234-4234-b234-123456789013'

const doseLog: DoseLog = {
  id: LOG_ID,
  supplementId: SUPPLEMENT_ID,
  date: '2026-05-19',
  time: '08:00:00',
  doseDescription: '400mg',
}

describe('GET /api/supplements/logs', () => {
  it('returns 200 with logs for date', async () => {
    mockGetLogsForDate.mockResolvedValueOnce(ok([doseLog]))
    const request = new Request('http://localhost/api/supplements/logs?date=2026-05-19')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe(doseLog.id)
  })

  it('returns 400 when date is missing', async () => {
    const request = new Request('http://localhost/api/supplements/logs')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 when date format is invalid', async () => {
    const request = new Request('http://localhost/api/supplements/logs?date=not-a-date')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('returns 500 when service fails', async () => {
    mockGetLogsForDate.mockResolvedValueOnce(err(new Error('query failed')))
    const request = new Request('http://localhost/api/supplements/logs?date=2026-05-19')
    const response = await GET(request)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('query failed')
  })
})

describe('POST /api/supplements/logs', () => {
  it('returns 201 with dose log on success', async () => {
    mockLogDose.mockResolvedValueOnce(ok(doseLog))
    const request = new Request('http://localhost/api/supplements/logs', {
      method: 'POST',
      body: JSON.stringify({ supplementId: SUPPLEMENT_ID }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.id).toBe(doseLog.id)
  })

  it('returns 201 with optional doseDescription', async () => {
    mockLogDose.mockResolvedValueOnce(ok(doseLog))
    const request = new Request('http://localhost/api/supplements/logs', {
      method: 'POST',
      body: JSON.stringify({
        supplementId: SUPPLEMENT_ID,
        doseDescription: '400mg',
      }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
  })

  it('returns 400 when body is invalid JSON', async () => {
    const request = new Request('http://localhost/api/supplements/logs', {
      method: 'POST',
      body: 'not-json',
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 when supplementId is not a valid UUID', async () => {
    const request = new Request('http://localhost/api/supplements/logs', {
      method: 'POST',
      body: JSON.stringify({ supplementId: 'not-a-valid-uuid-string' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 500 when service fails', async () => {
    mockLogDose.mockResolvedValueOnce(err(new Error('insert failed')))
    const request = new Request('http://localhost/api/supplements/logs', {
      method: 'POST',
      body: JSON.stringify({ supplementId: SUPPLEMENT_ID }),
    })
    const response = await POST(request)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('insert failed')
  })
})

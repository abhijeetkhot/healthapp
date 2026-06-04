import { describe, expect, it, vi, beforeAll } from 'vitest'
import { err, ok } from '@health/core'
import type { DoseLog } from '@health/core/models/supplement'
import { buildTestApp } from '../testApp'

const { mockGetLogsForDate, mockLogSupplement } = vi.hoisted(() => ({
  mockGetLogsForDate: vi.fn(),
  mockLogSupplement: vi.fn(),
}))

vi.mock('@health/core/container', () => ({
  services: {
    supplements: { getLogsForDate: mockGetLogsForDate, logDose: mockLogSupplement },
  },
}))

vi.mock('@health/core/usecases/LogSupplement', () => ({
  logSupplement: vi.fn(),
}))

import { logSupplement } from '@health/core/usecases/LogSupplement'

let app: Awaited<ReturnType<typeof buildTestApp>>

beforeAll(async () => {
  app = await buildTestApp()
})

const doseLog: DoseLog = {
  id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  supplementId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  date: '2026-05-19',
  time: '08:00',
  doseDescription: '2 capsules',
}

describe('GET /api/supplements/logs', () => {
  it('returns 200 with dose logs', async () => {
    mockGetLogsForDate.mockResolvedValueOnce(ok([doseLog]))
    const res = await app.inject({ method: 'GET', url: '/api/supplements/logs?date=2026-05-19' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(res.json()[0].supplementId).toBe(doseLog.supplementId)
  })

  it('returns 400 when date is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/supplements/logs' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when date format is invalid', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/supplements/logs?date=05/19/2026' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 500 when service fails', async () => {
    mockGetLogsForDate.mockResolvedValueOnce(err(new Error('DB error')))
    const res = await app.inject({ method: 'GET', url: '/api/supplements/logs?date=2026-05-19' })
    expect(res.statusCode).toBe(500)
  })
})

describe('POST /api/supplements/logs', () => {
  const validBody = {
    supplementId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    doseDescription: '2 capsules',
  }

  it('returns 201 with created log', async () => {
    vi.mocked(logSupplement).mockResolvedValueOnce(ok(doseLog))
    const res = await app.inject({
      method: 'POST',
      url: '/api/supplements/logs',
      payload: validBody,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().id).toBe(doseLog.id)
  })

  it('returns 400 when supplementId is not a uuid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/supplements/logs',
      payload: { supplementId: 'not-a-uuid' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when supplementId is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/supplements/logs',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 500 when use-case fails', async () => {
    vi.mocked(logSupplement).mockResolvedValueOnce(err(new Error('Insert failed')))
    const res = await app.inject({
      method: 'POST',
      url: '/api/supplements/logs',
      payload: validBody,
    })
    expect(res.statusCode).toBe(500)
  })
})

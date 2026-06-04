import { describe, expect, it, vi, beforeAll } from 'vitest'
import { err, ok } from '@health/core'
import { buildTestApp } from '../testApp'

vi.mock('@health/core/container', () => ({
  services: {
    db: {},
    health: {},
  },
}))

vi.mock('@health/core/usecases/ImportAppleHealthExport', () => ({
  importAppleHealthExport: vi.fn(),
}))

import { importAppleHealthExport } from '@health/core/usecases/ImportAppleHealthExport'

let app: Awaited<ReturnType<typeof buildTestApp>>

beforeAll(async () => {
  app = await buildTestApp()
})

const rows = [
  { date: '2026-05-18', steps: 8500, activeCals: 420, restingHr: 56 },
  { date: '2026-05-19', steps: 10200, activeCals: 510 },
]

describe('POST /api/health/import', () => {
  it('returns 200 with import result', async () => {
    vi.mocked(importAppleHealthExport).mockResolvedValueOnce(
      ok({ imported: 2, datesAffected: ['2026-05-18', '2026-05-19'] }),
    )
    const res = await app.inject({
      method: 'POST',
      url: '/api/health/import',
      payload: { rows },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().imported).toBe(2)
    expect(res.json().datesAffected).toHaveLength(2)
  })

  it('returns 400 when rows is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/health/import',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when a row has an invalid date format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/health/import',
      payload: { rows: [{ date: '19-05-2026', steps: 8000 }] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when rows exceeds 5000 limit', async () => {
    const tooManyRows = Array.from({ length: 5001 }, (_, i) => ({
      date: `2020-01-${String((i % 28) + 1).padStart(2, '0')}`,
    }))
    const res = await app.inject({
      method: 'POST',
      url: '/api/health/import',
      payload: { rows: tooManyRows },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 500 when use-case fails', async () => {
    vi.mocked(importAppleHealthExport).mockResolvedValueOnce(err(new Error('Upsert failed')))
    const res = await app.inject({
      method: 'POST',
      url: '/api/health/import',
      payload: { rows },
    })
    expect(res.statusCode).toBe(500)
    expect(res.json().error).toBe('Upsert failed')
  })
})

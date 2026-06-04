import { describe, expect, it, vi, beforeAll } from 'vitest'
import { err, ok } from '@health/core'
import type { Supplement } from '@health/core/models/supplement'
import { buildTestApp } from '../testApp'

const { mockGetStack, mockAddSupplement } = vi.hoisted(() => ({
  mockGetStack: vi.fn(),
  mockAddSupplement: vi.fn(),
}))

vi.mock('@health/core/container', () => ({
  services: {
    supplements: { getStack: mockGetStack, addSupplement: mockAddSupplement },
  },
}))

let app: Awaited<ReturnType<typeof buildTestApp>>

beforeAll(async () => {
  app = await buildTestApp()
})

const supplement: Supplement = {
  id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  name: 'Magnesium Glycinate',
  brand: 'Thorne',
  keyIngredients: [{ name: 'Magnesium', amount: 200, unit: 'mg' }],
  defaultDoseDescription: '2 capsules before bed',
  createdAt: '2026-01-01T00:00:00Z',
}

describe('GET /api/supplements', () => {
  it('returns 200 with supplement stack', async () => {
    mockGetStack.mockResolvedValueOnce(ok([supplement]))
    const res = await app.inject({ method: 'GET', url: '/api/supplements' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(res.json()[0].name).toBe('Magnesium Glycinate')
  })

  it('returns 500 when service fails', async () => {
    mockGetStack.mockResolvedValueOnce(err(new Error('DB error')))
    const res = await app.inject({ method: 'GET', url: '/api/supplements' })
    expect(res.statusCode).toBe(500)
    expect(res.json().error).toBe('DB error')
  })
})

describe('POST /api/supplements', () => {
  const body = {
    name: supplement.name,
    brand: supplement.brand,
    keyIngredients: supplement.keyIngredients,
    defaultDoseDescription: supplement.defaultDoseDescription,
  }

  it('returns 201 with created supplement', async () => {
    mockAddSupplement.mockResolvedValueOnce(ok(supplement))
    const res = await app.inject({
      method: 'POST',
      url: '/api/supplements',
      payload: body,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().id).toBe(supplement.id)
  })

  it('returns 400 when name is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/supplements',
      payload: { brand: 'Thorne', keyIngredients: [], defaultDoseDescription: '1 capsule' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 500 when service fails', async () => {
    mockAddSupplement.mockResolvedValueOnce(err(new Error('Insert failed')))
    const res = await app.inject({
      method: 'POST',
      url: '/api/supplements',
      payload: body,
    })
    expect(res.statusCode).toBe(500)
  })
})

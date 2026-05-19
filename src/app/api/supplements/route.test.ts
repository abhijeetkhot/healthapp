import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '@/core/Result'
import type { Supplement } from '@/core/models/supplement'

const mockGetStack = vi.fn()
const mockAddSupplement = vi.fn()

vi.mock('@/container', () => ({
  services: {
    supplements: {
      getStack: mockGetStack,
      addSupplement: mockAddSupplement,
    },
  },
}))

const { GET, POST } = await import('./route')

const supplement: Supplement = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Magnesium Glycinate',
  brand: 'Thorne',
  keyIngredients: [{ name: 'Magnesium', amount: 400, unit: 'mg' }],
  defaultDoseDescription: '400mg before bed',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const supplementInput = {
  name: 'Magnesium Glycinate',
  brand: 'Thorne',
  keyIngredients: [{ name: 'Magnesium', amount: 400, unit: 'mg' }],
  defaultDoseDescription: '400mg before bed',
}

describe('GET /api/supplements', () => {
  it('returns 200 with supplement stack', async () => {
    mockGetStack.mockResolvedValueOnce(ok([supplement]))
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('Magnesium Glycinate')
  })

  it('returns 500 when service fails', async () => {
    mockGetStack.mockResolvedValueOnce(err(new Error('DB error')))
    const response = await GET()
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('DB error')
  })
})

describe('POST /api/supplements', () => {
  it('returns 201 with saved supplement', async () => {
    mockAddSupplement.mockResolvedValueOnce(ok(supplement))
    const request = new Request('http://localhost/api/supplements', {
      method: 'POST',
      body: JSON.stringify(supplementInput),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.id).toBe(supplement.id)
  })

  it('returns 400 when body is invalid JSON', async () => {
    const request = new Request('http://localhost/api/supplements', {
      method: 'POST',
      body: 'not-json',
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 when required fields are missing', async () => {
    const request = new Request('http://localhost/api/supplements', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Thorne' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 500 when service fails', async () => {
    mockAddSupplement.mockResolvedValueOnce(err(new Error('insert failed')))
    const request = new Request('http://localhost/api/supplements', {
      method: 'POST',
      body: JSON.stringify(supplementInput),
    })
    const response = await POST(request)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('insert failed')
  })
})

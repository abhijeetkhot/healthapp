import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '@/core/Result'
import type { Meal } from '@/core/models/nutrition'

const mockGetMeals = vi.fn()
const mockSaveMeal = vi.fn()

vi.mock('@/container', () => ({
  services: {
    nutrition: {
      getMeals: mockGetMeals,
      saveMeal: mockSaveMeal,
    },
  },
}))

const { GET, POST } = await import('./route')

const meal: Meal = {
  id: '00000000-0000-0000-0000-000000000001',
  date: '2026-05-19',
  time: '12:00:00',
  items: [],
  totalCalories: 0,
  totalProteinG: 0,
  totalCarbsG: 0,
  totalFatG: 0,
}

const mealInput = {
  date: '2026-05-19',
  time: '12:00:00',
  items: [],
  totalCalories: 0,
  totalProteinG: 0,
  totalCarbsG: 0,
  totalFatG: 0,
}

describe('GET /api/meals', () => {
  it('returns 200 with meals array', async () => {
    mockGetMeals.mockResolvedValueOnce(ok([meal]))
    const request = new Request('http://localhost/api/meals?date=2026-05-19')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe(meal.id)
  })

  it('returns 400 when date is missing', async () => {
    const request = new Request('http://localhost/api/meals')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 when date format is invalid', async () => {
    const request = new Request('http://localhost/api/meals?date=bad-date')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('returns 500 when service fails', async () => {
    mockGetMeals.mockResolvedValueOnce(err(new Error('query failed')))
    const request = new Request('http://localhost/api/meals?date=2026-05-19')
    const response = await GET(request)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('query failed')
  })
})

describe('POST /api/meals', () => {
  it('returns 201 with saved meal on success', async () => {
    mockSaveMeal.mockResolvedValueOnce(ok(meal))
    const request = new Request('http://localhost/api/meals', {
      method: 'POST',
      body: JSON.stringify(mealInput),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.id).toBe(meal.id)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const request = new Request('http://localhost/api/meals', {
      method: 'POST',
      body: 'not-json',
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 when required fields are missing', async () => {
    const request = new Request('http://localhost/api/meals', {
      method: 'POST',
      body: JSON.stringify({ date: '2026-05-19' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 500 when service fails', async () => {
    mockSaveMeal.mockResolvedValueOnce(err(new Error('insert failed')))
    const request = new Request('http://localhost/api/meals', {
      method: 'POST',
      body: JSON.stringify(mealInput),
    })
    const response = await POST(request)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('insert failed')
  })
})

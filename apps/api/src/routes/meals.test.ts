import { describe, expect, it, vi, beforeAll } from 'vitest'
import { err, ok } from '@health/core'
import type { Meal } from '@health/core/models/nutrition'
import { buildTestApp } from '../testApp'

const { mockGetMeals, mockSaveMeal } = vi.hoisted(() => ({
  mockGetMeals: vi.fn(),
  mockSaveMeal: vi.fn(),
}))

vi.mock('@health/core/container', () => ({
  services: {
    nutrition: { getMeals: mockGetMeals, saveMeal: mockSaveMeal },
  },
}))

let app: Awaited<ReturnType<typeof buildTestApp>>

beforeAll(async () => {
  app = await buildTestApp()
})

const meal: Meal = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  date: '2026-05-19',
  time: '12:30',
  items: [
    {
      name: 'Chicken breast',
      portionGrams: 200,
      calories: 330,
      proteinG: 62,
      carbsG: 0,
      fatG: 7,
      source: 'ai',
    },
  ],
  totalCalories: 330,
  totalProteinG: 62,
  totalCarbsG: 0,
  totalFatG: 7,
}

describe('GET /api/meals', () => {
  it('returns 200 with meals array', async () => {
    mockGetMeals.mockResolvedValueOnce(ok([meal]))
    const res = await app.inject({ method: 'GET', url: '/api/meals?date=2026-05-19' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(res.json()[0].id).toBe(meal.id)
  })

  it('returns 400 when date is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/meals' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when date format is invalid', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/meals?date=19-05-2026' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 500 when service fails', async () => {
    mockGetMeals.mockResolvedValueOnce(err(new Error('DB error')))
    const res = await app.inject({ method: 'GET', url: '/api/meals?date=2026-05-19' })
    expect(res.statusCode).toBe(500)
    expect(res.json().error).toBe('DB error')
  })
})

describe('POST /api/meals', () => {
  const { id: _id, ...mealWithoutId } = meal

  it('returns 201 with created meal', async () => {
    mockSaveMeal.mockResolvedValueOnce(ok(meal))
    const res = await app.inject({
      method: 'POST',
      url: '/api/meals',
      payload: mealWithoutId,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().id).toBe(meal.id)
  })

  it('returns 400 when body is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/meals',
      payload: { date: '2026-05-19' }, // missing required fields
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 500 when service fails', async () => {
    mockSaveMeal.mockResolvedValueOnce(err(new Error('Insert failed')))
    const res = await app.inject({
      method: 'POST',
      url: '/api/meals',
      payload: mealWithoutId,
    })
    expect(res.statusCode).toBe(500)
  })
})

import { describe, expect, it, vi, beforeAll } from 'vitest'
import { err, ok } from '@health/core'
import type { Meal } from '@health/core/models/nutrition'
import { buildTestApp } from '../testApp'

const { mockUploadMealPhoto, mockIdentifyFoodsFromImage } = vi.hoisted(() => ({
  mockUploadMealPhoto: vi.fn(),
  mockIdentifyFoodsFromImage: vi.fn(),
}))

vi.mock('@health/core/container', () => ({
  services: {
    storage: { uploadMealPhoto: mockUploadMealPhoto },
    foodAI: { identifyFoodsFromImage: mockIdentifyFoodsFromImage },
  },
}))

// logMealFromPhoto uses storage + foodAI + USDA — mock the use-case directly
vi.mock('@health/core/usecases/LogMealFromPhoto', () => ({
  logMealFromPhoto: vi.fn(),
}))

import { logMealFromPhoto } from '@health/core/usecases/LogMealFromPhoto'

let app: Awaited<ReturnType<typeof buildTestApp>>

beforeAll(async () => {
  app = await buildTestApp()
})

const identifiedMeal: Meal = {
  id: '',
  date: '2026-05-19',
  time: '13:00',
  photoStoragePath: 'meals/test.jpg',
  items: [
    {
      name: 'Salad',
      portionGrams: 150,
      calories: 80,
      proteinG: 3,
      carbsG: 10,
      fatG: 2,
      confidence: 0.9,
      source: 'ai',
    },
  ],
  totalCalories: 80,
  totalProteinG: 3,
  totalCarbsG: 10,
  totalFatG: 2,
}

describe('POST /api/meals/identify', () => {
  it('returns 200 with identified meal', async () => {
    vi.mocked(logMealFromPhoto).mockResolvedValueOnce(ok(identifiedMeal))
    const res = await app.inject({
      method: 'POST',
      url: '/api/meals/identify',
      payload: { imageBase64: 'data:image/jpeg;base64,abc123' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().items).toHaveLength(1)
    expect(res.json().items[0].name).toBe('Salad')
  })

  it('returns 400 when imageBase64 is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/meals/identify',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when imageBase64 is empty string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/meals/identify',
      payload: { imageBase64: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 500 when use-case fails', async () => {
    vi.mocked(logMealFromPhoto).mockResolvedValueOnce(err(new Error('Claude API error')))
    const res = await app.inject({
      method: 'POST',
      url: '/api/meals/identify',
      payload: { imageBase64: 'data:image/jpeg;base64,abc123' },
    })
    expect(res.statusCode).toBe(500)
    expect(res.json().error).toBe('Claude API error')
  })
})

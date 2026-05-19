import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '@/core/Result'
import type { MealCandidate } from '@/core/usecases/LogMealFromPhoto'

const mockUploadMealPhoto = vi.fn()
const mockIdentifyFoodsFromImage = vi.fn()

vi.mock('@/container', () => ({
  services: {
    storage: { uploadMealPhoto: mockUploadMealPhoto },
    foodAI: { identifyFoodsFromImage: mockIdentifyFoodsFromImage },
  },
}))

// Stub fetch so USDA calls don't go to the network
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const { POST } = await import('./route')

const candidate: MealCandidate = {
  items: [
    {
      name: 'chicken breast',
      portionGrams: 200,
      calories: 330,
      proteinG: 62,
      carbsG: 0,
      fatG: 7.2,
      confidence: 0.9,
      source: 'ai',
    },
  ],
  photoStoragePath: 'meals/photo-1.jpg',
}

describe('POST /api/meals/identify', () => {
  it('returns 200 with MealCandidate on success', async () => {
    mockUploadMealPhoto.mockResolvedValueOnce(ok('meals/photo-1.jpg'))
    mockIdentifyFoodsFromImage.mockResolvedValueOnce([
      { name: 'chicken breast', portionGrams: 200, confidence: 0.9 },
    ])
    // USDA lookup returns macros for the enrichment
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        foods: [{
          description: 'Chicken breast',
          foodNutrients: [
            { nutrientName: 'Energy', value: 165 },
            { nutrientName: 'Protein', value: 31 },
            { nutrientName: 'Carbohydrate, by difference', value: 0 },
            { nutrientName: 'Total lipid (fat)', value: 3.6 },
          ],
        }],
      }),
    })

    const request = new Request('http://localhost/api/meals/identify', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: 'base64imagedata' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].name).toBe('chicken breast')
  })

  it('returns 400 when body is invalid JSON', async () => {
    const request = new Request('http://localhost/api/meals/identify', {
      method: 'POST',
      body: 'not-json',
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 when imageBase64 is missing', async () => {
    const request = new Request('http://localhost/api/meals/identify', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 500 when no foods are recognised', async () => {
    mockUploadMealPhoto.mockResolvedValueOnce(ok('meals/photo-2.jpg'))
    mockIdentifyFoodsFromImage.mockResolvedValueOnce([])

    const request = new Request('http://localhost/api/meals/identify', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: 'base64imagedata' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toContain('No foods recognised')
  })
})

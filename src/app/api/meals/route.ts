import { z } from 'zod'
import { services } from '@/container'
import { FoodItemSchema, MealSchema } from '@/core/models/nutrition'

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const PostBodySchema = MealSchema.omit({ id: true })

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse({ date: searchParams.get('date') })
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const result = await services.nutrition.getMeals(parsed.data.date)
  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }
  return Response.json(result.value)
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const parsed = PostBodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const result = await services.nutrition.saveMeal(parsed.data)
  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }
  return Response.json(result.value, { status: 201 })
}

import { z } from 'zod'
import { services } from '@/container'
import { IngredientDoseSchema } from '@/core/models/supplement'

const PostBodySchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  keyIngredients: z.array(IngredientDoseSchema),
  defaultDoseDescription: z.string(),
})

export async function GET() {
  const result = await services.supplements.getStack()
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

  const result = await services.supplements.addSupplement(parsed.data)
  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }
  return Response.json(result.value, { status: 201 })
}

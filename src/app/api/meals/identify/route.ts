import { z } from 'zod'
import { services } from '@/container'
import { logMealFromPhoto } from '@/core/usecases/LogMealFromPhoto'

const BodySchema = z.object({
  imageBase64: z.string().min(1),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const result = await logMealFromPhoto(
    services.storage,
    services.foodAI,
    parsed.data.imageBase64,
  )
  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }
  return Response.json(result.value)
}

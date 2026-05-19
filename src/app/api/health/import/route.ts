import { z } from 'zod'
import { services } from '@/container'
import { importAppleHealthExport } from '@/core/usecases/ImportAppleHealthExport'

const AppleHealthRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().int().nonnegative().optional(),
  activeCals: z.number().nonnegative().optional(),
  restingHr: z.number().int().positive().optional(),
  workouts: z.array(z.unknown()).optional(),
})

const BodySchema = z.object({
  rows: z.array(AppleHealthRowSchema).max(5000),
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

  const result = await importAppleHealthExport(
    services.db,
    services.health,
    parsed.data.rows,
  )
  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }
  return Response.json(result.value)
}

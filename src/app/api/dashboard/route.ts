import { z } from 'zod'
import { services } from '@/container'
import { getDashboardSummary } from '@/core/usecases/GetDashboardSummary'

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse({ date: searchParams.get('date') })
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const result = await getDashboardSummary(services.dashboard, parsed.data.date)
  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }
  return Response.json(result.value)
}

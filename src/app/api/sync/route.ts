import { format } from 'date-fns'
import { services } from '@/container'
import { syncWearableData } from '@/core/usecases/SyncWearableData'

export async function POST() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const result = await syncWearableData(services.health, today)
  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }
  return Response.json(result.value)
}

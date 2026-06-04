import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { format } from 'date-fns'
import { services } from '@health/core/container'
import { syncWearableData } from '@health/core/usecases/SyncWearableData'
import { respond } from '../lib/respond'

export const syncRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/', async (_req, reply) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return respond(reply, await syncWearableData(services.health, today))
  })
}

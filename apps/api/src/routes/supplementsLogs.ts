import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { services } from '@health/core/container'
import { logSupplement } from '@health/core/usecases/LogSupplement'
import { respond } from '../lib/respond'

export const supplementsLogsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    },
  }, async (req, reply) => {
    return respond(reply, await services.supplements.getLogsForDate(req.query.date))
  })

  app.post('/', {
    schema: {
      body: z.object({
        supplementId: z.string().uuid(),
        doseDescription: z.string().optional(),
      }),
    },
  }, async (req, reply) => {
    return respond(
      reply,
      await logSupplement(services.supplements, req.body.supplementId, req.body.doseDescription),
      201,
    )
  })
}

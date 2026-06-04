import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { services } from '@health/core/container'
import { getDashboardSummary } from '@health/core/usecases/GetDashboardSummary'
import { respond } from '../lib/respond'

export const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    },
  }, async (req, reply) => {
    return respond(reply, await getDashboardSummary(services.dashboard, req.query.date))
  })
}

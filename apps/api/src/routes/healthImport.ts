import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { services } from '@health/core/container'
import { importAppleHealthExport } from '@health/core/usecases/ImportAppleHealthExport'
import { respond } from '../lib/respond'

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

export const healthImportRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/', {
    schema: { body: BodySchema },
  }, async (req, reply) => {
    return respond(reply, await importAppleHealthExport(services.db, services.health, req.body.rows))
  })
}

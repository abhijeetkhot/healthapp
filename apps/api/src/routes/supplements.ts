import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { services } from '@health/core/container'
import { IngredientDoseSchema } from '@health/core/models/supplement'
import { respond } from '../lib/respond'

const PostBodySchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  keyIngredients: z.array(IngredientDoseSchema),
  defaultDoseDescription: z.string(),
})

export const supplementsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', async (_req, reply) => {
    return respond(reply, await services.supplements.getStack())
  })

  app.post('/', {
    schema: { body: PostBodySchema },
  }, async (req, reply) => {
    return respond(reply, await services.supplements.addSupplement(req.body), 201)
  })
}

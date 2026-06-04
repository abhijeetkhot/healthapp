import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { services } from '@health/core/container'
import { MealSchema } from '@health/core/models/nutrition'
import { respond } from '../lib/respond'

const PostBodySchema = MealSchema.omit({ id: true })

export const mealsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    },
  }, async (req, reply) => {
    return respond(reply, await services.nutrition.getMeals(req.query.date))
  })

  app.post('/', {
    schema: { body: PostBodySchema },
  }, async (req, reply) => {
    return respond(reply, await services.nutrition.saveMeal(req.body), 201)
  })
}

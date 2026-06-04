import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { services } from '@health/core/container'
import { logMealFromPhoto } from '@health/core/usecases/LogMealFromPhoto'
import { respond } from '../lib/respond'

export const mealsIdentifyRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/', {
    schema: {
      body: z.object({ imageBase64: z.string().min(1) }),
    },
  }, async (req, reply) => {
    return respond(reply, await logMealFromPhoto(services.storage, services.foodAI, req.body.imageBase64))
  })
}

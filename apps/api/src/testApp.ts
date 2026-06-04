import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { authRoutes } from './routes/auth'
import { dashboardRoutes } from './routes/dashboard'
import { mealsRoutes } from './routes/meals'
import { mealsIdentifyRoutes } from './routes/mealsIdentify'
import { supplementsRoutes } from './routes/supplements'
import { supplementsLogsRoutes } from './routes/supplementsLogs'
import { syncRoutes } from './routes/sync'
import { healthImportRoutes } from './routes/healthImport'
import { ouraRoutes } from './routes/oura'

export async function buildTestApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.setErrorHandler((error, _req, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({
        error: 'Validation error',
        issues: error.validation,
      })
    }
    return reply.send(error)
  })

  // Cookie plugin (no signing in tests)
  await app.register(cookie)

  // Register all routes without the auth plugin (tests mock container directly)
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' })
  await app.register(mealsRoutes, { prefix: '/api/meals' })
  await app.register(mealsIdentifyRoutes, { prefix: '/api/meals/identify' })
  await app.register(supplementsRoutes, { prefix: '/api/supplements' })
  await app.register(supplementsLogsRoutes, { prefix: '/api/supplements/logs' })
  await app.register(syncRoutes, { prefix: '/api/sync' })
  await app.register(healthImportRoutes, { prefix: '/api/health/import' })
  await app.register(ouraRoutes, { prefix: '/api/oura' })

  return app
}

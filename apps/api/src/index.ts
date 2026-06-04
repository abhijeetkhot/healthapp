import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { authPlugin } from './plugins/auth'
import { authRoutes } from './routes/auth'
import { dashboardRoutes } from './routes/dashboard'
import { mealsRoutes } from './routes/meals'
import { mealsIdentifyRoutes } from './routes/mealsIdentify'
import { supplementsRoutes } from './routes/supplements'
import { supplementsLogsRoutes } from './routes/supplementsLogs'
import { syncRoutes } from './routes/sync'
import { healthImportRoutes } from './routes/healthImport'
import { ouraRoutes } from './routes/oura'

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  trustProxy: true,
  bodyLimit: 50 * 1024 * 1024, // 50 MB — meal photos
}).withTypeProvider<ZodTypeProvider>()

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

await app.register(helmet)
await app.register(cors, {
  origin: process.env.WEB_ORIGIN!,
  credentials: true,
})
await app.register(cookie, { secret: process.env.COOKIE_SECRET! })
await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } })
await app.register(authPlugin)

await app.register(authRoutes, { prefix: '/api/auth' })
await app.register(dashboardRoutes, { prefix: '/api/dashboard' })
await app.register(mealsRoutes, { prefix: '/api/meals' })
await app.register(mealsIdentifyRoutes, { prefix: '/api/meals/identify' })
await app.register(supplementsRoutes, { prefix: '/api/supplements' })
await app.register(supplementsLogsRoutes, { prefix: '/api/supplements/logs' })
await app.register(syncRoutes, { prefix: '/api/sync' })
await app.register(healthImportRoutes, { prefix: '/api/health/import' })
await app.register(ouraRoutes, { prefix: '/api/oura' })

const port = Number(process.env.PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })

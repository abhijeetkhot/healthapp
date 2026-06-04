import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

const AUTH_BYPASS = ['/api/auth/login', '/api/auth/logout', '/api/oura/callback']

const authPluginFn: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    if (AUTH_BYPASS.some((path) => request.url === path || request.url.startsWith(path + '?'))) {
      return
    }
    const cookie = request.cookies['auth']
    if (cookie !== process.env.AUTH_SECRET) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })
}

export const authPlugin = fp(authPluginFn, { name: 'auth' })

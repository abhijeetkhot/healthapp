import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/login', {
    schema: {
      body: z.object({ password: z.string() }),
    },
  }, async (req, reply) => {
    if (req.body.password !== process.env.AUTH_SECRET) {
      return reply.code(401).send({ error: 'Invalid password' })
    }
    reply.setCookie('auth', process.env.AUTH_SECRET!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    return reply.code(200).send({ ok: true })
  })

  app.post('/logout', async (_req, reply) => {
    reply.clearCookie('auth', { path: '/' })
    return reply.code(200).send({ ok: true })
  })
}

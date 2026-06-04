import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { services } from '@health/core/container'

const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
})

export const ouraRoutes: FastifyPluginAsyncZod = async (app) => {
  // Redirect browser to Oura OAuth
  app.get('/auth', async (_req, reply) => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.OURA_CLIENT_ID!,
      redirect_uri: process.env.OURA_REDIRECT_URI!,
      scope: 'daily',
    })
    return reply.redirect(`https://cloud.ouraring.com/oauth/authorize?${params}`)
  })

  // Oura OAuth callback — exchange code for tokens
  app.get('/callback', async (req, reply) => {
    const code = (req.query as Record<string, string>)['code']

    if (!code) {
      return reply.redirect(`${process.env.WEB_ORIGIN ?? ''}/settings?error=no_code`)
    }

    try {
      const tokenRes = await fetch('https://api.ouraring.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: process.env.OURA_CLIENT_ID!,
          client_secret: process.env.OURA_CLIENT_SECRET!,
          redirect_uri: process.env.OURA_REDIRECT_URI!,
        }),
      })

      if (!tokenRes.ok) {
        return reply.redirect(`${process.env.WEB_ORIGIN ?? ''}/settings?error=token_exchange_failed`)
      }

      const parsed = TokenResponseSchema.safeParse(await tokenRes.json())
      if (!parsed.success) {
        return reply.redirect(`${process.env.WEB_ORIGIN ?? ''}/settings?error=invalid_token_response`)
      }

      const { access_token, refresh_token, expires_in } = parsed.data
      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

      await services.db.saveOuraTokens({
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
      })

      return reply.redirect(`${process.env.WEB_ORIGIN ?? ''}/settings?connected=true`)
    } catch {
      return reply.redirect(`${process.env.WEB_ORIGIN ?? ''}/settings?error=unexpected`)
    }
  })
}

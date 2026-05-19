import { z } from 'zod'
import { services } from '@/container'

const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return Response.redirect(new URL('/settings?error=no_code', request.url))
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
      return Response.redirect(new URL('/settings?error=token_exchange_failed', request.url))
    }

    const parsed = TokenResponseSchema.safeParse(await tokenRes.json())
    if (!parsed.success) {
      return Response.redirect(new URL('/settings?error=invalid_token_response', request.url))
    }

    const { access_token, refresh_token, expires_in } = parsed.data
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    await services.db.saveOuraTokens({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
    })

    return Response.redirect(new URL('/settings?connected=true', request.url))
  } catch {
    return Response.redirect(new URL('/settings?error=unexpected', request.url))
  }
}

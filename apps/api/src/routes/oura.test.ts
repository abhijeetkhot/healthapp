import { describe, expect, it, vi, beforeAll } from 'vitest'
import { buildTestApp } from '../testApp'

const { mockSaveOuraTokens } = vi.hoisted(() => ({
  mockSaveOuraTokens: vi.fn(),
}))

vi.mock('@health/core/container', () => ({
  services: {
    db: { saveOuraTokens: mockSaveOuraTokens },
  },
}))

let app: Awaited<ReturnType<typeof buildTestApp>>

beforeAll(async () => {
  process.env.OURA_CLIENT_ID = 'test-client-id'
  process.env.OURA_CLIENT_SECRET = 'test-client-secret'
  process.env.OURA_REDIRECT_URI = 'http://localhost:3001/api/oura/callback'
  process.env.WEB_ORIGIN = 'http://localhost:3000'
  app = await buildTestApp()
})

describe('GET /api/oura/auth', () => {
  it('redirects to Oura OAuth URL', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/oura/auth' })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toContain('https://cloud.ouraring.com/oauth/authorize')
    expect(res.headers.location).toContain('client_id=test-client-id')
    expect(res.headers.location).toContain('response_type=code')
  })
})

describe('GET /api/oura/callback', () => {
  it('redirects to /settings?error=no_code when code is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/oura/callback' })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toContain('error=no_code')
  })

  it('redirects to /settings?error=token_exchange_failed on bad token response', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response)

    const res = await app.inject({ method: 'GET', url: '/api/oura/callback?code=badcode' })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toContain('error=token_exchange_failed')
  })

  it('redirects to /settings?connected=true on successful token exchange', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'acc',
        refresh_token: 'ref',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    } as Response)
    mockSaveOuraTokens.mockResolvedValueOnce(undefined)

    const res = await app.inject({ method: 'GET', url: '/api/oura/callback?code=validcode' })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toContain('connected=true')
    expect(mockSaveOuraTokens).toHaveBeenCalledOnce()
  })

  it('redirects to /settings?error=invalid_token_response when token shape is wrong', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ wrong: 'shape' }),
    } as Response)

    const res = await app.inject({ method: 'GET', url: '/api/oura/callback?code=validcode' })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toContain('error=invalid_token_response')
  })
})

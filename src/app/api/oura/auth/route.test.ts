import { describe, expect, it, beforeEach } from 'vitest'
import { GET } from './route'

describe('GET /api/oura/auth', () => {
  beforeEach(() => {
    process.env.OURA_CLIENT_ID = 'test-client-id'
    process.env.OURA_REDIRECT_URI = 'http://localhost:3000/api/oura/callback'
  })

  it('redirects to Oura OAuth authorize URL', async () => {
    const response = await GET()
    expect(response.status).toBe(302)
    const location = response.headers.get('location') ?? ''
    expect(location).toContain('https://cloud.ouraring.com/oauth/authorize')
    expect(location).toContain('client_id=test-client-id')
    expect(location).toContain('response_type=code')
    expect(location).toContain('scope=daily')
    expect(location).toContain(encodeURIComponent('http://localhost:3000/api/oura/callback'))
  })
})

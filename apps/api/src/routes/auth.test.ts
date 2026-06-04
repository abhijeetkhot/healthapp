import { describe, expect, it, beforeAll } from 'vitest'
import { buildTestApp } from '../testApp'

let app: Awaited<ReturnType<typeof buildTestApp>>

beforeAll(async () => {
  process.env.AUTH_SECRET = 'test-secret-password'
  app = await buildTestApp()
})

describe('POST /api/auth/login', () => {
  it('returns 200 and sets auth cookie on correct password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'test-secret-password' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(res.headers['set-cookie']).toMatch(/auth=/)
  })

  it('returns 401 on wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'wrong-password' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('Invalid password')
  })

  it('returns 400 when body is missing password field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears auth cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    // Cookie should be cleared (max-age=0 or expires in the past)
    const setCookie = res.headers['set-cookie'] as string | undefined
    if (setCookie) {
      expect(setCookie).toMatch(/auth=;|Max-Age=0/i)
    }
  })
})

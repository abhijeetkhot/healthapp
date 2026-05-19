import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockSaveOuraTokens = vi.fn()

vi.mock('@/container', () => ({
  services: {
    db: {
      saveOuraTokens: mockSaveOuraTokens,
    },
  },
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const { GET } = await import('./route')

function makeRequest(code: string | null) {
  const url = code
    ? `http://localhost:3000/api/oura/callback?code=${code}`
    : 'http://localhost:3000/api/oura/callback'
  return new Request(url)
}

describe('GET /api/oura/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OURA_CLIENT_ID = 'test-client'
    process.env.OURA_CLIENT_SECRET = 'test-secret'
    process.env.OURA_REDIRECT_URI = 'http://localhost:3000/api/oura/callback'
  })

  it('redirects to /settings?connected=true on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'acc',
        refresh_token: 'ref',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    })
    const response = await GET(makeRequest('valid-code'))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('/settings?connected=true')
    expect(mockSaveOuraTokens).toHaveBeenCalledOnce()
  })

  it('redirects to /settings?error=no_code when code is missing', async () => {
    const response = await GET(makeRequest(null))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('error=no_code')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('redirects to /settings?error=token_exchange_failed when Oura returns non-ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const response = await GET(makeRequest('bad-code'))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('error=token_exchange_failed')
    expect(mockSaveOuraTokens).not.toHaveBeenCalled()
  })

  it('redirects to /settings?error=invalid_token_response when response shape is wrong', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unexpected: 'data' }),
    })
    const response = await GET(makeRequest('some-code'))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('error=invalid_token_response')
  })

  it('redirects to /settings?error=unexpected when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))
    const response = await GET(makeRequest('code'))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('error=unexpected')
  })
})

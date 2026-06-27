import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/handlers/inbox.js', () => ({
  handleInboxActivity: vi.fn().mockResolvedValue(true)
}))

describe('inbox function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle OPTIONS (CORS preflight)', async () => {
    const { default: handler } = await import('../../netlify/functions/inbox.mjs')

    const req = new Request('https://example.com/inbox', {
      method: 'OPTIONS'
    })
    const context = {}

    const response = await handler(req, context as any)

    expect(response.status).toBe(204)
  })

  it('should return 400 for invalid JSON', async () => {
    const { default: handler } = await import('../../netlify/functions/inbox.mjs')

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500
    } as Response)

    const req = new Request('https://example.com/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json'
    })
    const context = {} as any

    const response = await handler(req, context)

    expect(response.status).toBe(400)
  })
})

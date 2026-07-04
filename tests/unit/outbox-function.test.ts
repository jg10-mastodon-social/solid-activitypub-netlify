import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/auth.js', () => ({
  verifyDpopToken: vi.fn().mockResolvedValue({ success: true, payload: { webid: 'https://example.com/webid' } })
}))

vi.mock('../../src/signing.js', () => ({
  signActivityRequest: vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
}))

vi.mock('../../src/config.js', () => ({
  loadConfig: vi.fn().mockReturnValue({
    webId: 'https://example.com/webid',
    issuer: 'https://example.com',
    outboxUrl: 'http://pod.example.com/outbox/',
    baseUrl: 'http://public.example.com',
    whitelistedIssuers: ['https://example.com'],
    outboxConfigUrl: 'http://example.com/webhooks.ttl',
    handlerBaseUrl: 'https://example.com/handlers#',
    adminWebId: '',
    outboxEndpoint: '/outbox',
    sendToUrl: 'http://example.com/outbox'
  })
}))

vi.mock('../../src/solidFetch.js', () => ({
  createSolidFetch: vi.fn().mockResolvedValue(async (url: string) => {
    return new Response('proxy response', {
      status: 200,
      headers: { 'Content-Type': 'text/turtle' }
    })
  })
}))

describe('outbox function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle OPTIONS (CORS preflight)', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mjs')

    const req = new Request('https://example.com/outbox', {
      method: 'OPTIONS'
    })
    const context = {}

    const response = await handler(req, context as any)

    expect(response.status).toBe(204)
  })

  it('should return 200 for GET /outbox', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mjs')

    const req = new Request('https://example.com/outbox', {
      method: 'GET'
    })
    const context = {}

    const response = await handler(req, context as any)

    expect(response.status).toBe(200)
  })

  it('should return 200 for GET /outbox/pages/123', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mjs')

    const req = new Request('https://example.com/outbox/pages/123', {
      method: 'GET'
    })
    const context = {}

    const response = await handler(req, context as any)

    expect(response.status).toBe(200)
  })
})

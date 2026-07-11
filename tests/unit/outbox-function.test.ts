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

  it('forwards GET request to pod with auth', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mjs')
    const { createSolidFetch } = await import('../../src/solidFetch.js')
    const mockFetch = vi.fn().mockResolvedValue(new Response('turtle body', {
      status: 200,
      headers: { 'Content-Type': 'text/turtle' }
    }))
    ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)

    const req = new Request('https://example.com/outbox/', {
      method: 'GET',
      headers: { Accept: 'text/turtle' }
    })
    const context = {}

    await handler(req, context as any)

    expect(mockFetch).toHaveBeenCalled()
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toContain('/outbox/')
  })

  it('forwards Accept header to pod', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mjs')
    const { createSolidFetch } = await import('../../src/solidFetch.js')
    const mockFetch = vi.fn().mockResolvedValue(new Response('turtle body', {
      status: 200,
      headers: { 'Content-Type': 'text/turtle' }
    }))
    ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)

    const req = new Request('https://example.com/outbox/', {
      method: 'GET',
      headers: { Accept: 'text/turtle' }
    })
    const context = {}

    await handler(req, context as any)

    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1]?.headers?.accept).toBe('text/turtle')
  })

  it('passes Content-Type from pod to client', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mjs')
    const { createSolidFetch } = await import('../../src/solidFetch.js')
    const mockFetch = vi.fn().mockResolvedValue(new Response('turtle body', {
      status: 200,
      headers: { 'Content-Type': 'text/turtle' }
    }))
    ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)

    const req = new Request('https://example.com/outbox/', {
      method: 'GET',
      headers: { Accept: 'text/turtle' }
    })
    const context = {}

    const response = await handler(req, context as any)

    expect(response.headers.get('Content-Type')).toBe('text/turtle')
  })

  it('rewrites outbox base URLs in response body', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mjs')
    const { createSolidFetch } = await import('../../src/solidFetch.js')
    const podBody = `<http://pod.example.com/outbox/> a <http://www.w3.org/ns/activitystreams#OrderedCollection>.
  <http://pod.example.com/outbox/pages/123> a <http://www.w3.org/ns/activitystreams#OrderedCollectionPage>.`
    const mockFetch = vi.fn().mockResolvedValue(new Response(podBody, {
      status: 200,
      headers: { 'Content-Type': 'text/turtle' }
    }))
    ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)

    const req = new Request('https://example.com/outbox/', {
      method: 'GET',
      headers: { Accept: 'text/turtle' }
    })
    const context = {}

    const response = await handler(req, context as any)
    const body = await response.text()

    expect(body).toContain('http://public.example.com/outbox/')
    expect(body).toContain('http://public.example.com/outbox/pages/123')
    expect(body).not.toContain('http://pod.example.com/outbox/')
  })

  it('returns 502 when pod unreachable', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mjs')
    const { createSolidFetch } = await import('../../src/solidFetch.js')
    const mockFetch = vi.fn().mockRejectedValue(new Error('Pod unreachable'))
    ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)

    const req = new Request('https://example.com/outbox/', {
      method: 'GET',
      headers: { Accept: 'text/turtle' }
    })
    const context = {}

    const response = await handler(req, context as any)

    expect(response.status).toBe(502)
  })

  it('returns pod error status when pod returns error', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mjs')
    const { createSolidFetch } = await import('../../src/solidFetch.js')
    const mockFetch = vi.fn().mockResolvedValue(new Response('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    }))
    ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)

    const req = new Request('https://example.com/outbox/', {
      method: 'GET',
      headers: { Accept: 'text/turtle' }
    })
    const context = {}

    const response = await handler(req, context as any)

    expect(response.status).toBe(404)
  })

  it('includes CORS headers on GET response', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mjs')
    const { createSolidFetch } = await import('../../src/solidFetch.js')
    const mockFetch = vi.fn().mockResolvedValue(new Response('turtle body', {
      status: 200,
      headers: { 'Content-Type': 'text/turtle' }
    }))
    ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)

    const req = new Request('https://example.com/outbox/', {
      method: 'GET',
      headers: { Accept: 'text/turtle' }
    })
    const context = {}

    const response = await handler(req, context as any)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('echoes Origin header when present in request', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mjs')
    const { createSolidFetch } = await import('../../src/solidFetch.js')
    const mockFetch = vi.fn().mockResolvedValue(new Response('turtle body', {
      status: 200,
      headers: { 'Content-Type': 'text/turtle' }
    }))
    ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)

    const req = new Request('https://example.com/outbox/', {
      method: 'GET',
      headers: {
        Accept: 'text/turtle',
        Origin: 'https://solid.example.app'
      }
    })
    const context = {}

    const response = await handler(req, context as any)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://solid.example.app')
  })

  it('includes Vary: Origin header for cache awareness', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mjs')
    const { createSolidFetch } = await import('../../src/solidFetch.js')
    const mockFetch = vi.fn().mockResolvedValue(new Response('turtle body', {
      status: 200,
      headers: { 'Content-Type': 'text/turtle' }
    }))
    ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)

    const req = new Request('https://example.com/outbox/', {
      method: 'GET',
      headers: { Accept: 'text/turtle' }
    })
    const context = {}

    const response = await handler(req, context as any)

    expect(response.headers.get('Vary')).toContain('Origin')
  })
})

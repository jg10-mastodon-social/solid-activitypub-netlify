import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/verifyRequest.js', () => ({
  verifyIncomingActivity: vi.fn(),
  HttpSignatureError: class HttpSignatureError extends Error {
    constructor(message: string, public statusCode: number = 401) {
      super(message)
      this.name = 'HttpSignatureError'
    }
  }
}))

vi.mock('../../src/handlers/inbox.js', () => ({
  handleInboxActivity: vi.fn().mockResolvedValue(true)
}))

vi.mock('../../src/config.js', () => ({
  loadConfig: vi.fn().mockReturnValue({
    webId: 'https://example.com/webid',
    issuer: 'https://example.com',
    inboxUrl: 'http://pod.example.com/inbox/',
    baseUrl: 'http://public.example.com',
    whitelistedIssuers: ['https://example.com'],
    outboxConfigUrl: 'http://example.com/webhooks.ttl',
    handlerBaseUrl: 'https://example.com/handlers#',
    adminWebId: '',
    outboxEndpoint: '/outbox',
    sendToUrl: 'http://example.com/outbox',
    actorName: 'actor',
    actorPath: '/actor',
    solidStorageBaseUrl: 'http://pod.example.com/'
  })
}))

vi.mock('../../src/solidFetch.js', () => ({
  createSolidFetch: vi.fn().mockResolvedValue(async () => {
    return new Response('proxy response', {
      status: 200,
      headers: { 'Content-Type': 'text/turtle' }
    })
  })
}))

describe('inbox function POST with HTTP signature verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('HTTP Signature verification', () => {
    it('should call verifyIncomingActivity with request, activity, and fetch', async () => {
      const { default: handler } = await import('../../netlify/functions/inbox.mjs')
      const { verifyIncomingActivity } = await import('../../src/verifyRequest.js')
      const { createSolidFetch } = await import('../../src/solidFetch.js')

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'https://other.example/actor',
          publicKey: {
            id: 'https://other.example/actor#main-key',
            owner: 'https://other.example/actor',
            publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----'
          }
        })
      })
      ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)
      ;(verifyIncomingActivity as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ keyId: 'https://other.example/actor#main-key' })

      const activity = {
        type: 'Create',
        actor: 'https://other.example/actor',
        '@context': 'https://www.w3.org/ns/activitystreams'
      }
      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/activity+json',
          'Signature': 'keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="abc"',
          'Date': new Date().toUTCString(),
          'Digest': 'SHA-256=abc'
        },
        body: JSON.stringify(activity)
      })

      const response = await handler(req, {} as any)

      expect(verifyIncomingActivity).toHaveBeenCalledWith(req, activity, mockFetch)
      expect(response.status).toBe(200)
    })

    it('should return 401 when verifyIncomingActivity throws HttpSignatureError with 401', async () => {
      const { default: handler } = await import('../../netlify/functions/inbox.mjs')
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const { createSolidFetch } = await import('../../src/solidFetch.js')

      const mockFetch = vi.fn()
      ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)
      ;(verifyIncomingActivity as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new HttpSignatureError('Signature verification failed', 401)
      )

      const activity = {
        type: 'Create',
        actor: 'https://other.example/actor',
        '@context': 'https://www.w3.org/ns/activitystreams'
      }
      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/activity+json',
          'Signature': 'invalid',
          'Date': new Date().toUTCString(),
          'Digest': 'SHA-256=abc'
        },
        body: JSON.stringify(activity)
      })

      const response = await handler(req, {} as any)

      expect(response.status).toBe(401)
      expect(await response.text()).toBe('Signature verification failed')
    })

    it('should return 400 when verifyIncomingActivity throws HttpSignatureError with 400', async () => {
      const { default: handler } = await import('../../netlify/functions/inbox.mjs')
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const { createSolidFetch } = await import('../../src/solidFetch.js')

      const mockFetch = vi.fn()
      ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)
      ;(verifyIncomingActivity as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new HttpSignatureError('Missing Date header', 400)
      )

      const activity = {
        type: 'Create',
        actor: 'https://other.example/actor',
        '@context': 'https://www.w3.org/ns/activitystreams'
      }
      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/activity+json'
        },
        body: JSON.stringify(activity)
      })

      const response = await handler(req, {} as any)

      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Missing Date header')
    })

    it('should return 502 when verifyIncomingActivity throws HttpSignatureError with 502', async () => {
      const { default: handler } = await import('../../netlify/functions/inbox.mjs')
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const { createSolidFetch } = await import('../../src/solidFetch.js')

      const mockFetch = vi.fn()
      ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)
      ;(verifyIncomingActivity as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new HttpSignatureError('Actor URL blocked', 502)
      )

      const activity = {
        type: 'Create',
        actor: 'https://other.example/actor',
        '@context': 'https://www.w3.org/ns/activitystreams'
      }
      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/activity+json',
          'Signature': 'keyId="http://127.0.0.1/actor#main-key",algorithm="rsa-sha256",signature="abc"'
        },
        body: JSON.stringify(activity)
      })

      const response = await handler(req, {} as any)

      expect(response.status).toBe(502)
      expect(await response.text()).toBe('Actor URL blocked')
    })
  })

  describe('CORS headers for signature headers', () => {
    it('should include Signature, Date, Digest in CORS headers', async () => {
      const { default: handler } = await import('../../netlify/functions/inbox.mjs')
      const { verifyIncomingActivity } = await import('../../src/verifyRequest.js')
      const { createSolidFetch } = await import('../../src/solidFetch.js')

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'https://other.example/actor',
          publicKey: {
            id: 'https://other.example/actor#main-key',
            owner: 'https://other.example/actor',
            publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----'
          }
        })
      })
      ;(createSolidFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetch)
      ;(verifyIncomingActivity as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ keyId: 'https://other.example/actor#main-key' })

      const activity = {
        type: 'Create',
        actor: 'https://other.example/actor',
        '@context': 'https://www.w3.org/ns/activitystreams'
      }
      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/activity+json',
          'Signature': 'keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",signature="abc"',
          'Date': new Date().toUTCString(),
          'Digest': 'SHA-256=abc'
        },
        body: JSON.stringify(activity)
      })

      const response = await handler(req, {} as any)

      const allowHeaders = response.headers.get('Access-Control-Allow-Headers')
      expect(allowHeaders).toContain('Signature')
      expect(allowHeaders).toContain('Date')
      expect(allowHeaders).toContain('Digest')
    })
  })
})
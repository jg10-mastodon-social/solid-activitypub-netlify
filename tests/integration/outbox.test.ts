import { describe, it, expect, vi, beforeAll } from 'vitest'
import type { Context } from '@netlify/functions'

vi.mock('../../src/base-url.js', () => ({
  baseUrl: 'http://localhost:9999'
}))

const mockValidateActivityActor = vi.fn().mockReturnValue(true)

vi.mock('../../src/auth.js', () => ({
  verifyDpopToken: vi.fn().mockResolvedValue({
    success: true,
    payload: { webid: 'http://localhost:9999/webid#me', client_id: 'client1', iss: 'https://issuer.example', iat: 0, exp: 0 }
  })
}))

vi.mock('../../src/activity.js', () => ({
  extractRecipients: vi.fn().mockReturnValue(['https://recipient.example/actor']),
  fetchActorInbox: vi.fn().mockResolvedValue('https://recipient.example/inbox'),
  validateActivityActor: mockValidateActivityActor
}))

vi.mock('../../src/signing.js', () => ({
  signActivityRequest: vi.fn().mockResolvedValue({ ok: true, status: 200 })
}))

vi.mock('../../src/solidFetch.js', () => ({
  createSolidFetch: vi.fn().mockResolvedValue(vi.fn())
}))

beforeAll(() => {
  process.env.WHITELISTED_ISSUERS = 'https://issuer.example'
  process.env.OUTBOX_CONFIG_URL = 'https://pod.example.com/webhooks.ttl'
  process.env.WEBID = 'http://localhost:9999/webid'
  process.env.ISSUER = 'http://localhost:9999'
  process.env.HANDLER_BASE_URL = 'https://example.com/handlers#'
  process.env.SEND_TO_URL = 'http://localhost:9999/outbox'
})

vi.mock('@soid/core', () => ({
  getAuthenticatedFetch: vi.fn()
}))

function makeContext(overrides: Partial<Context> = {}): Context {
  return {
    requestId: 'test-request-id',
    server: { region: 'us-east-1' },
    waitUntil: vi.fn(),
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    geo: {},
    ip: '127.0.0.1',
    site: {},
    deploy: {},
    account: {},
    params: {},
    url: new URL('http://localhost/outbox'),
    next: vi.fn(),
    ...overrides
  } as Context
}

describe('outbox integration tests', () => {
  it('returns 401 without authorization header', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mts')
    const req = new Request('http://localhost/outbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' }
    })
    const res = await handler(req, makeContext())

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authorization required')
  })

  it('returns 401 without DPoP header', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mts')
    const req = new Request('http://localhost/outbox', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'DPoP some-token'
      }
    })
    const res = await handler(req, makeContext())

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('DPoP header required')
  })

  it('returns 401 with invalid token format', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mts')
    const req = new Request('http://localhost/outbox', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'DPoP invalid-token',
        'dpop': 'invalid-dpop'
      }
    })
    const res = await handler(req, makeContext())

    expect(res.status).toBe(401)
  })

  it('returns 204 for OPTIONS preflight', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mts')
    const req = new Request('http://localhost/outbox', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, DPoP'
      }
    })
    const res = await handler(req, makeContext())

    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('returns 200 with valid activity', async () => {
    const { default: handler } = await import('../../netlify/functions/outbox.mts')
    const activity = {
      type: 'Create',
      actor: 'http://localhost:9999/actor',
      to: ['https://recipient.example/actor']
    }
    const req = new Request('http://localhost/outbox', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'DPoP valid-token',
        'dpop': 'valid-dpop'
      },
      body: JSON.stringify(activity)
    })
    const res = await handler(req, makeContext())

    expect(res.status).toBe(200)
  })

  it('returns 403 when actor does not match', async () => {
    mockValidateActivityActor.mockImplementationOnce(() => {
      throw new Error('Actor mismatch')
    })
    const { default: handler } = await import('../../netlify/functions/outbox.mts')
    const activity = {
      type: 'Create',
      actor: 'https://wrong.example/actor',
      to: ['https://recipient.example/actor']
    }
    const req = new Request('http://localhost/outbox', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'DPoP valid-token',
        'dpop': 'valid-dpop'
      },
      body: JSON.stringify(activity)
    })
    const res = await handler(req, makeContext())

    expect(res.status).toBe(403)
  })
})
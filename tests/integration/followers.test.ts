import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import type { Context } from '@netlify/functions'

const mockSerializeCollection = vi.fn()
const mockSerializePage = vi.fn()

vi.mock('../../src/base-url.js', () => ({
  baseUrl: 'http://localhost:9999'
}))

vi.mock('../../src/solidFetch.js', () => ({
  createSolidFetch: vi.fn().mockResolvedValue(vi.fn())
}))

vi.mock('../../src/handlers/inbox.js', () => ({
  handleInboxActivity: vi.fn()
}))

vi.mock('../../src/handlers/outbox.js', () => ({
  handleOutboxActivity: vi.fn()
}))

vi.mock('../../src/auth.js', () => ({
  verifyDpopToken: vi.fn()
}))

vi.mock('../../src/services/serializeFollowersCollection.js', () => ({
  serializeFollowersCollection: mockSerializeCollection
}))

vi.mock('../../src/services/serializeFollowersPage.js', () => ({
  serializeFollowersPage: mockSerializePage
}))

beforeAll(() => {
  process.env.WHITELISTED_ISSUERS = 'https://issuer.example'
  process.env.SOLID_STORAGE_BASE_URL = 'http://localhost:9998/'
  process.env.WEBID = 'http://localhost:9999/webid'
  process.env.ISSUER = 'http://localhost:9999'
  process.env.SEND_TO_URL = 'http://localhost:9999/outbox'
  process.env.ACTOR_NAME = 'actor'
})

beforeEach(() => {
  vi.clearAllMocks()
})

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
    params: { actor: 'actor' },
    url: new URL('http://localhost/actor/followers'),
    next: vi.fn(),
    ...overrides
  } as Context
}

function asJson(res: Response): Promise<Record<string, unknown>> {
  return res.json() as Promise<Record<string, unknown>>
}

describe('actor-router followers GET AS2 JSON', () => {
  it('returns OrderedCollection JSON when Accept is application/activity+json (no auth required)', async () => {
    const jsonBody = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'http://localhost:9999/actor/followers',
      type: 'OrderedCollection',
      totalItems: 1,
      first: 'http://localhost:9999/actor/followers/pages/1'
    }
    mockSerializeCollection.mockResolvedValueOnce(
      new Response(JSON.stringify(jsonBody), {
        status: 200,
        headers: { 'Content-Type': 'application/activity+json' }
      })
    )

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/actor/followers', {
      method: 'GET',
      headers: { accept: 'application/activity+json' }
    })

    const res = await handler(req, makeContext())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/activity+json')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    const body = await asJson(res)
    expect(body.type).toBe('OrderedCollection')
    expect(body.id).toBe('http://localhost:9999/actor/followers')
    expect(body.totalItems).toBe(1)
    expect(mockSerializeCollection).toHaveBeenCalledTimes(1)
  })

  it('returns OrderedCollectionPage JSON for a page path with AS2 Accept', async () => {
    const jsonBody = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'http://localhost:9999/actor/followers/pages/1',
      type: 'OrderedCollectionPage',
      partOf: 'http://localhost:9999/actor/followers',
      orderedItems: ['https://bob.example/bob']
    }
    mockSerializePage.mockResolvedValueOnce(
      new Response(JSON.stringify(jsonBody), {
        status: 200,
        headers: { 'Content-Type': 'application/activity+json' }
      })
    )

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/actor/followers/pages/1', {
      method: 'GET',
      headers: { accept: 'application/activity+json' }
    })

    const ctx = makeContext({
      params: { actor: 'actor', page: 'pages/1' },
      url: new URL('http://localhost/actor/followers/pages/1')
    })

    const res = await handler(req, ctx)
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.type).toBe('OrderedCollectionPage')
    expect(mockSerializePage).toHaveBeenCalledTimes(1)
  })

  it('proxies Turtle when Accept is text/turtle (no auth required)', async () => {
    const fetchFn = (await import('../../src/solidFetch.js')).createSolidFetch as unknown as ReturnType<typeof vi.fn>
    const innerFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<http://localhost:9998/actor/followers/> a <https://www.w3.org/ns/activitystreams#OrderedCollection> .'),
      headers: new Headers({ 'content-type': 'text/turtle' })
    })
    fetchFn.mockResolvedValueOnce(innerFetch)

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/actor/followers', {
      method: 'GET',
      headers: { accept: 'text/turtle' }
    })

    const res = await handler(req, makeContext())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/turtle/)
    expect(mockSerializeCollection).not.toHaveBeenCalled()
  })

  it('rewrites relative URIs in proxied Turtle body to absolute public URLs', async () => {
    const fetchFn = (await import('../../src/solidFetch.js')).createSolidFetch as unknown as ReturnType<typeof vi.fn>
    const innerFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<> a <https://www.w3.org/ns/activitystreams#OrderedCollection> ; <https://www.w3.org/ns/activitystreams#first> <pages/1> .'),
      headers: new Headers({ 'content-type': 'text/turtle' })
    })
    fetchFn.mockResolvedValueOnce(innerFetch)

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/actor/followers', {
      method: 'GET',
      headers: { accept: 'text/turtle' }
    })

    const res = await handler(req, makeContext())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/turtle/)
    expect(mockSerializeCollection).not.toHaveBeenCalled()
    const body = await res.text()
    expect(body).toContain('<http://localhost:9999/actor/followers/pages/1>')
    expect(body).not.toMatch(/<pages\/1>/)
  })

  it('proxies Turtle when Accept is absent (back-compat, no auth required)', async () => {
    const fetchFn = (await import('../../src/solidFetch.js')).createSolidFetch as unknown as ReturnType<typeof vi.fn>
    const innerFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
      headers: new Headers({ 'content-type': 'text/turtle' })
    })
    fetchFn.mockResolvedValueOnce(innerFetch)

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/actor/followers', { method: 'GET' })

    const res = await handler(req, makeContext())
    expect(res.status).toBe(200)
    expect(mockSerializeCollection).not.toHaveBeenCalled()
  })

  it('OPTIONS preflight returns 204 with CORS headers', async () => {
    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/actor/followers', { method: 'OPTIONS' })

    const res = await handler(req, makeContext())
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toContain('GET')
  })
})
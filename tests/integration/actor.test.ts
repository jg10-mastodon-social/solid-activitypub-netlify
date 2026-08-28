import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { Context } from '@netlify/functions'

const __test_filename = fileURLToPath(import.meta.url)
const __test_dirname = path.dirname(__test_filename)
const __test_rootDir = path.resolve(__test_dirname, '..', '..')
const __test_publicDir = path.join(__test_rootDir, 'public')
const __test_templateSrc = path.join(__test_rootDir, 'static-ui', 'actor-page.template.html')
const __test_templateDst = path.join(__test_publicDir, 'actor-page.template.html')

const mockActorKeys = {
  actor: {
    kty: 'RSA',
    e: 'AQAB',
    n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    d: 'X4cTteJY_gn4FYPsXB8rdXix5vwsg1FLN5E3EaG6RJoVH-HLLKD9M7dx5oo7GURknchnrRweUkC7hT5fJLM0WbFAKNLWY2vv7B6NqXSzUvxT0_YSfqijwp3RTzlBaCxWp4doF5SXA5uL3NaK3DAZ-V5-K5XqAvLD5VYr7cVvP7xVcwD5JmcPWNfGVaJrKdl80G9CsKy8-kzIKyN6Ej2FD8Lg2xjvBuKiLQVcT2w9hV3CkBvxLJPc5Md4yJ2cS3C0M2D2t5vOgV9V6K5a7lJqT1s9Y-K5V-5pL0b9RrT9M0cD0T5P4x0Q',
    p: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    q: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    dp: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    dq: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    qi: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    alg: 'RS256',
    kid: 'test-key-id'
  }
}

vi.mock('../../src/actor-keys.js', () => ({
  actorKeys: mockActorKeys
}))

vi.mock('../../src/base-url.js', () => ({
  baseUrl: 'http://localhost:9999'
}))

const profileFixtures: Record<string, { status: number; body: string }> = {}

const mockFetch = vi.fn().mockImplementation((url: string | URL | Request) => {
  const u = typeof url === 'string' ? url : url.toString()
  for (const [path, fixture] of Object.entries(profileFixtures)) {
    if (u.includes(path)) {
      return Promise.resolve({
        ok: fixture.status >= 200 && fixture.status < 300,
        status: fixture.status,
        headers: { get: () => 'text/turtle' },
        text: () => Promise.resolve(fixture.body)
      })
    }
  }
  return Promise.resolve({
    ok: false,
    status: 404,
    headers: { get: () => 'text/turtle' },
    text: () => Promise.resolve('')
  })
})

vi.mock('../../src/solidFetch.js', () => ({
  createSolidFetch: vi.fn().mockResolvedValue(mockFetch)
}))

vi.mock('@soid/core', () => ({
  getAuthenticatedFetch: vi.fn()
}))

beforeAll(() => {
  process.env.WHITELISTED_ISSUERS = 'https://issuer.example'
  process.env.SOLID_STORAGE_BASE_URL = 'http://localhost:9998/'
  process.env.WEBID = 'http://localhost:9999/webid'
  process.env.ISSUER = 'http://localhost:9999'
  process.env.SEND_TO_URL = 'http://localhost:9999/outbox'
  process.env.ACTOR_NAME = 'actor'

  fs.mkdirSync(__test_publicDir, { recursive: true })
  fs.copyFileSync(__test_templateSrc, __test_templateDst)
})

afterAll(() => {
  if (fs.existsSync(__test_templateDst)) {
    fs.unlinkSync(__test_templateDst)
  }
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
    url: new URL('http://localhost/actor'),
    next: vi.fn(),
    ...overrides
  } as Context
}

const FULL_PROFILE = `@prefix as: <https://www.w3.org/ns/activitystreams#> .

<http://localhost:9998/actor/profile>
  a as:Person ;
  as:name "Alice Example" ;
  as:summary "<p>Bio.</p>" ;
  as:icon <http://localhost:9998/actor/profile#icon> ;
  as:image <http://localhost:9998/actor/profile#image> .

<http://localhost:9998/actor/profile#icon> a as:Image ; as:mediaType "image/png" ; as:url "https://cdn.example/avatar.png" .
<http://localhost:9998/actor/profile#image> a as:Image ; as:mediaType "image/jpeg" ; as:url "https://cdn.example/header.jpg" .
`

describe('actor-router GET /:actor integration', () => {
  it('returns 200 with the skeleton-only payload when the pod has no profile', async () => {
    Object.keys(profileFixtures).forEach(k => delete profileFixtures[k])
    vi.clearAllMocks()

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/actor', {
      method: 'GET',
      headers: { 'Accept': 'application/activity+json' }
    })
    const res = await handler(req, makeContext())

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/activity+json')

    const actor = await res.json()
    expect(actor.type).toBe('Service')
    expect(actor.id).toBe('http://localhost:9999/actor')
    expect(actor.preferredUsername).toBe('actor')
    expect(actor.inbox).toBe('http://localhost:9999/actor/inbox')
    expect(actor.outbox).toBe('http://localhost:9999/actor/outbox')
    expect(actor.followers).toBe('http://localhost:9999/actor/followers')
    expect(actor.following).toBe('http://localhost:9999/actor/following')
    expect(actor.liked).toBe('http://localhost:9999/actor/liked')
    expect(actor.manuallyApprovesFollowers).toBe(false)
    expect(actor.publicKey).toBeDefined()
    expect(actor.publicKey.id).toBe('http://localhost:9999/actor#main-key')
    expect(actor.publicKey.owner).toBe('http://localhost:9999/actor')
    expect(actor.publicKey.publicKeyPem).toMatch(/-----BEGIN PUBLIC KEY-----/)
    expect(actor.endpoints).toEqual({ sharedInbox: 'http://localhost:9999/inbox' })
    expect(actor.name).toBeUndefined()
    expect(actor.summary).toBeUndefined()
    expect(actor.icon).toBeUndefined()
    expect(actor.image).toBeUndefined()
  })

  it('overlays all profile fields when the pod serves a full profile', async () => {
    Object.keys(profileFixtures).forEach(k => delete profileFixtures[k])
    profileFixtures['/actor/profile'] = { status: 200, body: FULL_PROFILE }
    vi.clearAllMocks()

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/actor', {
      method: 'GET',
      headers: { 'Accept': 'application/activity+json' }
    })
    const res = await handler(req, makeContext())

    expect(res.status).toBe(200)
    const actor = await res.json()
    expect(actor.type).toBe('Person')
    expect(actor.name).toBe('Alice Example')
    expect(actor.summary).toBe('<p>Bio.</p>')
    expect(actor.endpoints).toEqual({ sharedInbox: 'http://localhost:9999/inbox' })
    expect(actor.icon).toEqual({
      type: 'Image',
      mediaType: 'image/png',
      url: 'https://cdn.example/avatar.png'
    })
    expect(actor.image).toEqual({
      type: 'Image',
      mediaType: 'image/jpeg',
      url: 'https://cdn.example/header.jpg'
    })
  })

  it('returns 404 for an unknown actor', async () => {
    Object.keys(profileFixtures).forEach(k => delete profileFixtures[k])
    vi.clearAllMocks()

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/unknown', { method: 'GET' })
    const ctx = makeContext({ params: { actor: 'unknown' } })
    const res = await handler(req, ctx)

    expect(res.status).toBe(404)
  })

  it('falls back to the skeleton when the pod errors on profile fetch', async () => {
    Object.keys(profileFixtures).forEach(k => delete profileFixtures[k])
    profileFixtures['/actor/profile'] = { status: 500, body: 'server error' }
    vi.clearAllMocks()

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/actor', {
      method: 'GET',
      headers: { 'Accept': 'application/activity+json' }
    })
    const res = await handler(req, makeContext())

    expect(res.status).toBe(200)
    const actor = await res.json()
    expect(actor.type).toBe('Service')
    expect(actor.name).toBeUndefined()
  })

  it('returns 405 for non-GET methods on /:actor', async () => {
    Object.keys(profileFixtures).forEach(k => delete profileFixtures[k])
    vi.clearAllMocks()

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/actor', { method: 'PUT' })
    const res = await handler(req, makeContext())

    expect(res.status).toBe(405)
  })

it('returns HTML for GET /:actor when Accept includes text/html', async () => {
      Object.keys(profileFixtures).forEach(k => delete profileFixtures[k])
      vi.clearAllMocks()

      const { default: handler } = await import('../../netlify/functions/actor-router.mts')
      const req = new Request('http://localhost/actor', {
        method: 'GET',
        headers: { 'Accept': 'text/html,application/xhtml+xml' }
      })
      const res = await handler(req, makeContext())

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('text/html')
      const body = await res.text()
      expect(body).toContain('@actor@localhost:9999')
      expect(body).toContain('uri="http://localhost:9999/actor"')
      expect(body).toContain('pos-value')
      expect(body).toContain('activitystreams#outbox')
      expect(body).toContain('<pos-app restore-previous-session>')
      expect(body).toContain('<import-html src="/templates/actor-controls.html">')
      expect(body).toContain('src="/templates/webid-resource.js"')
      expect(body).toContain('src="/templates/update-location.js"')
    })

  it('returns 404 for GET /unknown with Accept: text/html (HTML branch does not bypass actor resolution)', async () => {
    Object.keys(profileFixtures).forEach(k => delete profileFixtures[k])
    vi.clearAllMocks()

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/unknown', {
      method: 'GET',
      headers: { 'Accept': 'text/html' }
    })
    const ctx = makeContext({ params: { actor: 'unknown' } })
    const res = await handler(req, ctx)

    expect(res.status).toBe(404)
  })
})

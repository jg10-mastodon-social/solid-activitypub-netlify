import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import type { Context } from '@netlify/functions'

const mockVerifyIncomingActivity = vi.fn()
const mockHandleInboxActivity = vi.fn()
const mockHandleSharedInboxActivity = vi.fn()

const mockSerializeInboxCollection = vi.fn()
const mockSerializeInboxPage = vi.fn()

vi.mock('../../src/base-url.js', () => ({
  baseUrl: 'http://localhost:9999'
}))

vi.mock('../../src/solidFetch.js', () => ({
  createSolidFetch: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(''),
    json: () => Promise.resolve({})
  }))
}))

vi.mock('../../src/verifyRequest.js', () => ({
  verifyIncomingActivity: mockVerifyIncomingActivity,
  HttpSignatureError: class HttpSignatureError extends Error {
    constructor(message: string, public statusCode: number, public context: unknown) {
      super(message)
      this.name = 'HttpSignatureError'
    }
  },
  formatHttpSignatureError: vi.fn().mockReturnValue('formatted-error')
}))

vi.mock('../../src/handlers/inbox.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    handleInboxActivity: mockHandleInboxActivity,
    handleSharedInboxActivity: mockHandleSharedInboxActivity
  }
})

vi.mock('../../src/handlers/outbox.js', () => ({
  handleOutboxActivity: vi.fn()
}))

vi.mock('../../src/auth.js', () => ({
  verifyDpopToken: vi.fn().mockResolvedValue({
    success: true,
    payload: { webid: 'http://localhost:9999/webid#me', client_id: 'client1', iss: 'https://issuer.example', iat: 0, exp: 0 }
  })
}))

vi.mock('@soid/core', () => ({
  getAuthenticatedFetch: vi.fn()
}))

vi.mock('../../src/services/serializeInboxCollection.js', () => ({
  serializeInboxCollection: mockSerializeInboxCollection
}))

vi.mock('../../src/services/serializeInboxPage.js', () => ({
  serializeInboxPage: mockSerializeInboxPage
}))

beforeAll(() => {
  process.env.WHITELISTED_ISSUERS = 'https://issuer.example'
  process.env.SOLID_STORAGE_BASE_URL = 'http://localhost:9998/'
  process.env.WEBID = 'http://localhost:9999/webid'
  process.env.ISSUER = 'http://localhost:9999'
  process.env.SEND_TO_URL = 'http://localhost:9999/outbox'
  process.env.ACTOR_NAME = 'actor'
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
    url: new URL('http://localhost/actor/inbox'),
    next: vi.fn(),
    ...overrides
  } as Context
}

const TOMBSTONED_ACTOR = 'https://mastodon.social/ap/users/116878551484577684'

describe('actor-router inbox short-circuit for actor Delete activities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 for a Delete activity whose object is the actor (self-delete) without verifying the signature', async () => {
    const { default: handler } = await import('../../netlify/functions/actor-router.mts')

    const activity = {
      type: 'Delete',
      actor: TOMBSTONED_ACTOR,
      object: TOMBSTONED_ACTOR,
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const req = new Request('http://localhost/actor/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(activity)
    })

    const res = await handler(req, makeContext())

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
    expect(mockVerifyIncomingActivity).not.toHaveBeenCalled()
    expect(mockHandleInboxActivity).not.toHaveBeenCalled()
  })

  it('returns 200 for a Delete activity with an inline Tombstone object', async () => {
    const { default: handler } = await import('../../netlify/functions/actor-router.mts')

    const activity = {
      type: 'Delete',
      actor: TOMBSTONED_ACTOR,
      object: { id: TOMBSTONED_ACTOR, type: 'Tombstone' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const req = new Request('http://localhost/actor/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(activity)
    })

    const res = await handler(req, makeContext())

    expect(res.status).toBe(200)
    expect(mockVerifyIncomingActivity).not.toHaveBeenCalled()
  })

  it('returns 200 for an as:Delete activity (self-delete)', async () => {
    const { default: handler } = await import('../../netlify/functions/actor-router.mts')

    const activity = {
      type: 'as:Delete',
      actor: TOMBSTONED_ACTOR,
      object: TOMBSTONED_ACTOR,
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const req = new Request('http://localhost/actor/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(activity)
    })

    const res = await handler(req, makeContext())

    expect(res.status).toBe(200)
    expect(mockVerifyIncomingActivity).not.toHaveBeenCalled()
  })

  it('does NOT short-circuit a Delete whose object is a Note (different from actor)', async () => {
    const { HttpSignatureError } = await import('../../src/verifyRequest.js')
    mockVerifyIncomingActivity.mockRejectedValueOnce(
      new (HttpSignatureError as any)('signature invalid', 401, { code: 'signature_invalid' })
    )

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')

    const activity = {
      type: 'Delete',
      actor: TOMBSTONED_ACTOR,
      object: 'https://other.example/note/123',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const req = new Request('http://localhost/actor/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(activity)
    })

    const res = await handler(req, makeContext())

    expect(mockVerifyIncomingActivity).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(401)
  })

  it('does NOT short-circuit a Create activity', async () => {
    const { HttpSignatureError } = await import('../../src/verifyRequest.js')
    mockVerifyIncomingActivity.mockRejectedValueOnce(
      new (HttpSignatureError as any)('signature invalid', 401, { code: 'signature_invalid' })
    )

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')

    const activity = {
      type: 'Create',
      actor: TOMBSTONED_ACTOR,
      object: { type: 'Note', content: 'hi' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const req = new Request('http://localhost/actor/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(activity)
    })

    const res = await handler(req, makeContext())

    expect(mockVerifyIncomingActivity).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(401)
  })
})

describe('actor-router shared inbox POST /inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 for an actor Delete at /inbox without verifying the signature', async () => {
    const { default: handler } = await import('../../netlify/functions/actor-router.mts')

    const activity = {
      type: 'Delete',
      actor: TOMBSTONED_ACTOR,
      object: TOMBSTONED_ACTOR,
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const req = new Request('http://localhost/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(activity)
    })

    const ctx = makeContext({
      params: {},
      url: new URL('http://localhost/inbox')
    })

    const res = await handler(req, ctx)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
    expect(mockVerifyIncomingActivity).not.toHaveBeenCalled()
    expect(mockHandleInboxActivity).not.toHaveBeenCalled()
  })

  it('delegates a Follow at /inbox to handleSharedInboxActivity', async () => {
    const { default: handler } = await import('../../netlify/functions/actor-router.mts')

    mockVerifyIncomingActivity.mockResolvedValueOnce({ keyId: 'https://other.example/actor#main-key' })
    mockHandleSharedInboxActivity.mockResolvedValueOnce({ success: true, actorName: 'actor' })

    const activity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'http://localhost:9999/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const req = new Request('http://localhost/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(activity)
    })

    const ctx = makeContext({
      params: {},
      url: new URL('http://localhost/inbox')
    })

    const res = await handler(req, ctx)

    expect(res.status).toBe(200)
    expect(mockVerifyIncomingActivity).toHaveBeenCalledTimes(1)
    expect(mockHandleSharedInboxActivity).toHaveBeenCalledTimes(1)
    const callArgs = mockHandleSharedInboxActivity.mock.calls[0]
    expect(callArgs[0]).toMatchObject({ type: 'Follow', object: 'http://localhost:9999/actor' })
  })

  it('returns 422 for a Create at /inbox addressed only to Public', async () => {
    const { default: handler } = await import('../../netlify/functions/actor-router.mts')

    mockVerifyIncomingActivity.mockResolvedValueOnce({ keyId: 'https://other.example/actor#main-key' })
    mockHandleSharedInboxActivity.mockResolvedValueOnce({ success: false, reason: 'no_target_actor' })

    const activity = {
      type: 'Create',
      actor: 'https://other.example/actor',
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      object: { type: 'Note', content: 'hi' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const req = new Request('http://localhost/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(activity)
    })

    const ctx = makeContext({
      params: {},
      url: new URL('http://localhost/inbox')
    })

    const res = await handler(req, ctx)

    expect(res.status).toBe(422)
    expect(mockVerifyIncomingActivity).toHaveBeenCalledTimes(1)
    expect(mockHandleSharedInboxActivity).toHaveBeenCalledTimes(1)
  })

  it('returns 405 for GET /inbox', async () => {
    const { default: handler } = await import('../../netlify/functions/actor-router.mts')

    const req = new Request('http://localhost/inbox', {
      method: 'GET'
    })

    const ctx = makeContext({
      params: {},
      url: new URL('http://localhost/inbox')
    })

    const res = await handler(req, ctx)

    expect(res.status).toBe(405)
  })
})

describe('actor-router inbox GET AS2 JSON', () => {
  beforeEach(() => {
    mockSerializeInboxCollection.mockReset()
    mockSerializeInboxPage.mockReset()
  })

  it('returns AS2 JSON OrderedCollection when Accept is application/activity+json', async () => {
    mockSerializeInboxCollection.mockResolvedValueOnce(
      new Response(JSON.stringify({
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: 'http://localhost:9999/actor/inbox',
        type: 'OrderedCollection',
        totalItems: 0,
        first: 'http://localhost:9999/actor/inbox/pages/1'
      }), { status: 200, headers: { 'Content-Type': 'application/activity+json' } })
    )

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/actor/inbox', {
      method: 'GET',
      headers: { accept: 'application/activity+json' }
    })
    const res = await handler(req, makeContext())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/activity+json')
    const body = await res.json()
    expect(body.id).toBe('http://localhost:9999/actor/inbox')
    expect(body.type).toBe('OrderedCollection')
    expect(mockSerializeInboxCollection).toHaveBeenCalledTimes(1)
  })

  it('returns AS2 JSON OrderedCollectionPage for a page path', async () => {
    mockSerializeInboxPage.mockResolvedValueOnce(
      new Response(JSON.stringify({
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: 'http://localhost:9999/actor/inbox/pages/1',
        type: 'OrderedCollectionPage',
        partOf: 'http://localhost:9999/actor/inbox',
        orderedItems: ['https://other.example/activity/1']
      }), { status: 200, headers: { 'Content-Type': 'application/activity+json' } })
    )

    const { default: handler } = await import('../../netlify/functions/actor-router.mts')
    const req = new Request('http://localhost/actor/inbox/pages/1', {
      method: 'GET',
      headers: { accept: 'application/activity+json' }
    })
    const ctx = makeContext({
      params: { actor: 'actor', page: 'pages/1' },
      url: new URL('http://localhost/actor/inbox/pages/1')
    })
    const res = await handler(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe('OrderedCollectionPage')
    expect(body.partOf).toBe('http://localhost:9999/actor/inbox')
    expect(mockSerializeInboxPage).toHaveBeenCalledTimes(1)
  })
})
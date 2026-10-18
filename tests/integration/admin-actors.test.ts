import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { Context } from '@netlify/functions'
import type { ActorRecord } from '../../src/actors/registry.js'
import type { EncryptedSecret } from '../../src/actors/crypto.js'
import { decryptActorSecret } from '../../src/actors/crypto.js'

const TEST_ENCRYPTION_KEY = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc='
const ADMIN_WEBID = 'https://admin.example/webid'

const mockConfig = {
  adminWebId: ADMIN_WEBID,
  whitelistedIssuers: ['https://issuer.example']
}

const mockVerifyDpopToken = vi.fn()

const fakeActors = new Map<string, ActorRecord>()
const fakeSecrets = new Map<string, EncryptedSecret>()

async function registryErrors() {
  return import('../../src/actors/registry.js')
}

function makeRecord(name: string, publicKeyJwk: Record<string, unknown> = { kty: 'RSA', n: 'test' }): ActorRecord {
  const now = new Date().toISOString()
  return { name, publicKeyJwk, createdAt: now, updatedAt: now, disabled: false }
}

const mockRegistry = {
  getActor: vi.fn(async (name: string) => fakeActors.get(name) ?? null),
  listActors: vi.fn(async () => Array.from(fakeActors.values()).sort((a, b) => a.name.localeCompare(b.name))),
  createActor: vi.fn(async (input: {
    name: string
    publicKeyJwk: Record<string, unknown>
    encryptedPrivateKey: EncryptedSecret
  }) => {
    const { ActorAlreadyExistsError } = await registryErrors()
    if (fakeActors.has(input.name)) {
      throw new ActorAlreadyExistsError(`actor "${input.name}" already exists`)
    }
    const record = makeRecord(input.name, input.publicKeyJwk)
    fakeActors.set(input.name, record)
    fakeSecrets.set(input.name, input.encryptedPrivateKey)
    return record
  }),
  disableActor: vi.fn(async (name: string) => {
    const { ActorNotFoundError } = await registryErrors()
    const record = fakeActors.get(name)
    if (record === undefined) {
      throw new ActorNotFoundError(`actor "${name}" not found`)
    }
    const updated: ActorRecord = { ...record, disabled: true, updatedAt: new Date().toISOString() }
    fakeActors.set(name, updated)
    return updated
  }),
  rotateActorKey: vi.fn(async (input: {
    name: string
    publicKeyJwk: Record<string, unknown>
    encryptedPrivateKey: EncryptedSecret
  }) => {
    const { ActorNotFoundError } = await registryErrors()
    const record = fakeActors.get(input.name)
    if (record === undefined) {
      throw new ActorNotFoundError(`actor "${input.name}" not found`)
    }
    const updated: ActorRecord = {
      ...record,
      publicKeyJwk: input.publicKeyJwk,
      updatedAt: new Date().toISOString()
    }
    fakeActors.set(input.name, updated)
    fakeSecrets.set(input.name, input.encryptedPrivateKey)
    return updated
  }),
  getEncryptedSecret: vi.fn(async (name: string) => fakeSecrets.get(name) ?? null),
  listOrphanSecretNames: vi.fn(async () =>
    Array.from(fakeSecrets.keys()).filter((name) => !fakeActors.has(name)).sort()
  )
}

vi.mock('../../src/auth.js', () => ({
  verifyDpopToken: mockVerifyDpopToken
}))

vi.mock('../../src/config.js', () => ({
  loadConfig: () => mockConfig
}))

vi.mock('../../src/actors/registry.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/actors/registry.js')>(
    '../../src/actors/registry.js'
  )
  return {
    openActorRegistry: () => mockRegistry,
    ActorAlreadyExistsError: actual.ActorAlreadyExistsError,
    ActorNotFoundError: actual.ActorNotFoundError
  }
})

beforeAll(() => {
  process.env.ACTOR_KEY_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
})

afterAll(() => {
  delete process.env.ACTOR_KEY_ENCRYPTION_KEY
})

beforeEach(() => {
  fakeActors.clear()
  fakeSecrets.clear()
  mockConfig.adminWebId = ADMIN_WEBID
  mockVerifyDpopToken.mockReset()
  mockVerifyDpopToken.mockResolvedValue({
    success: true,
    payload: { webid: ADMIN_WEBID, client_id: 'client', iss: 'https://issuer.example', iat: 0, exp: 0 }
  })
  for (const fn of Object.values(mockRegistry)) {
    fn.mockClear()
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
    deploy: { context: 'production', id: 'test-deploy', published: true },
    account: {},
    params: {},
    url: new URL('http://localhost/admin/actors'),
    next: vi.fn(),
    ...overrides
  } as Context
}

async function callHandler(
  method: string,
  path: string,
  options: {
    origin?: string
    body?: unknown
    headers?: Record<string, string>
    context?: Partial<Context>
  } = {}
): Promise<Response> {
  const { default: handler } = await import('../../netlify/functions/admin-actors.mts')
  const headers: Record<string, string> = { ...(options.headers ?? {}) }
  if (options.origin) headers.Origin = options.origin
  const req = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  })
  return handler(req, makeContext({ url: new URL(`http://localhost${path}`), ...options.context }))
}

describe('admin-actors OPTIONS and CORS', () => {
  it('returns 204 with echoed CORS headers for OPTIONS', async () => {
    const res = await callHandler('OPTIONS', '/admin/actors', { origin: 'https://ui.example' })

    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://ui.example')
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS')
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, DPoP, Content-Type')
    expect(res.headers.get('Vary')).toBe('Origin')
    expect(mockVerifyDpopToken).not.toHaveBeenCalled()
  })

  it('falls back to * when no Origin header is present', async () => {
    const res = await callHandler('OPTIONS', '/admin/actors')
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

describe('admin-actors authorization', () => {
  it('returns the verifier status and message when auth fails', async () => {
    mockVerifyDpopToken.mockResolvedValueOnce({
      success: false,
      statusCode: 401,
      message: 'Authorization required'
    })

    const res = await callHandler('GET', '/admin/actors')

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authorization required')
  })

  it('passes the auth headers, url, method, and issuers to the verifier', async () => {
    await callHandler('GET', '/admin/actors', { headers: { authorization: 'DPoP token', dpop: 'proof' } })

    expect(mockVerifyDpopToken).toHaveBeenCalledWith(
      'DPoP token',
      'proof',
      'http://localhost/admin/actors',
      'GET',
      ['https://issuer.example']
    )
  })

  it('returns 403 when the webid is not the admin', async () => {
    mockVerifyDpopToken.mockResolvedValueOnce({
      success: true,
      payload: { webid: 'https://someone-else.example/webid', iss: 'https://issuer.example' }
    })

    const res = await callHandler('GET', '/admin/actors')

    expect(res.status).toBe(403)
    expect(await res.text()).toBe('Forbidden')
  })

  it('returns 403 when admin webid is not configured', async () => {
    mockConfig.adminWebId = ''

    const res = await callHandler('GET', '/admin/actors')

    expect(res.status).toBe(403)
    expect(await res.text()).toBe('Forbidden')
  })

  it('returns 403 in a deploy-preview context', async () => {
    const res = await callHandler('GET', '/admin/actors', {
      context: { deploy: { context: 'deploy-preview', id: 'test-deploy', published: false } }
    })

    expect(res.status).toBe(403)
    expect(await res.text()).toBe('Forbidden')
  })

  it('returns 403 in a branch-deploy context', async () => {
    const res = await callHandler('GET', '/admin/actors', {
      context: { deploy: { context: 'branch-deploy', id: 'test-deploy', published: false } }
    })

    expect(res.status).toBe(403)
    expect(await res.text()).toBe('Forbidden')
  })
})

describe('admin-actors GET /admin/actors', () => {
  it('returns a JSON array of public records without secrets', async () => {
    fakeActors.set('alice', makeRecord('alice'))
    fakeActors.set('bob', makeRecord('bob'))
    fakeSecrets.set('alice', { v: 1, iv: 'a', ciphertext: 'b', tag: 'c' })

    const res = await callHandler('GET', '/admin/actors')

    expect(res.status).toBe(200)
    const body = await res.json() as ActorRecord[]
    expect(body.map((r) => r.name)).toEqual(['alice', 'bob'])
    expect(body[0].publicKeyJwk).toBeDefined()
    expect(JSON.stringify(body)).not.toContain('encryptedPrivateKey')
    expect(JSON.stringify(body)).not.toContain('ciphertext')
  })
})

describe('admin-actors POST /admin/actors', () => {
  it('creates an actor with a public JWK and encrypted secret', async () => {
    const res = await callHandler('POST', '/admin/actors', { body: { name: 'alice' } })

    expect(res.status).toBe(200)
    const body = await res.json() as ActorRecord
    expect(body.name).toBe('alice')
    expect(body.disabled).toBe(false)

    expect(mockRegistry.createActor).toHaveBeenCalledTimes(1)
    const input = mockRegistry.createActor.mock.calls[0][0] as {
      name: string
      publicKeyJwk: Record<string, unknown>
      encryptedPrivateKey: EncryptedSecret
    }
    expect(input.name).toBe('alice')
    expect(input.publicKeyJwk.kty).toBe('RSA')
    expect(input.encryptedPrivateKey.v).toBe(1)

    const privateJwk = decryptActorSecret<Record<string, unknown>>(input.encryptedPrivateKey)
    expect(privateJwk.d).toBeDefined()
    expect(JSON.stringify(body)).not.toContain('encryptedPrivateKey')
  })

  it('returns 409 when the actor already exists', async () => {
    fakeActors.set('alice', makeRecord('alice'))

    const res = await callHandler('POST', '/admin/actors', { body: { name: 'alice' } })

    expect(res.status).toBe(409)
    expect(await res.text()).toContain('already exists')
  })

  it('returns 400 for an invalid actor name', async () => {
    const res = await callHandler('POST', '/admin/actors', { body: { name: 'inbox' } })

    expect(res.status).toBe(400)
    expect(mockRegistry.createActor).not.toHaveBeenCalled()
  })

  it('returns 400 for a malformed JSON body', async () => {
    const { default: handler } = await import('../../netlify/functions/admin-actors.mts')
    const req = new Request('http://localhost/admin/actors', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json'
    })
    const res = await handler(req, makeContext({ url: new URL('http://localhost/admin/actors') }))

    expect(res.status).toBe(400)
  })
})

describe('admin-actors POST /admin/actors/:name/disable', () => {
  it('disables an actor and returns the record', async () => {
    fakeActors.set('alice', makeRecord('alice'))

    const res = await callHandler('POST', '/admin/actors/alice/disable', {
      context: { params: { name: 'alice' } }
    })

    expect(res.status).toBe(200)
    const body = await res.json() as ActorRecord
    expect(body.name).toBe('alice')
    expect(body.disabled).toBe(true)
    expect(mockRegistry.disableActor).toHaveBeenCalledWith('alice')
  })

  it('returns 404 for an unknown actor', async () => {
    const res = await callHandler('POST', '/admin/actors/missing/disable', {
      context: { params: { name: 'missing' } }
    })

    expect(res.status).toBe(404)
  })
})

describe('admin-actors POST /admin/actors/:name/rotate', () => {
  it('rotates the key and returns the updated record', async () => {
    fakeActors.set('alice', makeRecord('alice', { kty: 'RSA', n: 'old' }))

    const res = await callHandler('POST', '/admin/actors/alice/rotate', {
      context: { params: { name: 'alice' } }
    })

    expect(res.status).toBe(200)
    const body = await res.json() as ActorRecord
    expect(body.name).toBe('alice')
    expect(body.publicKeyJwk).not.toEqual({ kty: 'RSA', n: 'old' })

    expect(mockRegistry.rotateActorKey).toHaveBeenCalledTimes(1)
    const input = mockRegistry.rotateActorKey.mock.calls[0][0] as {
      name: string
      publicKeyJwk: Record<string, unknown>
      encryptedPrivateKey: EncryptedSecret
    }
    expect(input.name).toBe('alice')
    expect(input.publicKeyJwk.kty).toBe('RSA')
    expect(input.encryptedPrivateKey.v).toBe(1)
  })

  it('returns 404 for an unknown actor', async () => {
    const res = await callHandler('POST', '/admin/actors/missing/rotate', {
      context: { params: { name: 'missing' } }
    })

    expect(res.status).toBe(404)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { devServerUrl, getMockSolidServer } from '../helpers/dev-server.js'

describe('outbox e2e tests', () => {
  beforeEach(() => {
    const mockServer = getMockSolidServer()
    if (mockServer) {
      mockServer.setError(false)
    }
  })
  it('returns 401 without authorization header', async () => {
    const res = await fetch(`${devServerUrl}/outbox`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' }
    })

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authorization required')
  })

  it('returns 401 without DPoP header', async () => {
    const res = await fetch(`${devServerUrl}/outbox`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'DPoP dummy-token'
      }
    })

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('DPoP header required')
  })

  it('returns 401 with invalid token', async () => {
    const res = await fetch(`${devServerUrl}/outbox`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'DPoP invalid-token',
        'dpop': 'invalid-dpop'
      }
    })

    expect(res.status).toBe(401)
  })

  it('returns 204 for OPTIONS preflight with CORS headers', async () => {
    const res = await fetch(`${devServerUrl}/outbox`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, DPoP'
      }
    })

    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
  })

  it('returns JWKS from public/jwks.json', async () => {
    const res = await fetch(`${devServerUrl}/jwks.json`)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')?.startsWith('application/json')).toBe(true)

    const jwks = await res.json()
    expect(jwks).toHaveProperty('keys')
    expect(Array.isArray(jwks.keys)).toBe(true)
    expect(jwks.keys.length).toBeGreaterThan(0)

    const key = jwks.keys[0]
    expect(key).toHaveProperty('kty', 'EC')
    expect(key).toHaveProperty('crv', 'P-256')
    expect(key).toHaveProperty('x')
    expect(key).toHaveProperty('y')
    expect(key).toHaveProperty('kid')
    expect(key).toHaveProperty('alg', 'ES256')
    expect(key).toHaveProperty('use', 'sig')

    expect(key).not.toHaveProperty('d')
    expect(key).not.toHaveProperty('dp')
    expect(key).not.toHaveProperty('dq')
    expect(key).not.toHaveProperty('p')
    expect(key).not.toHaveProperty('q')
  })

  it('returns 200 when activity received and persisted to Solid pod', async () => {
    const mockServer = getMockSolidServer()
    expect(mockServer).not.toBeNull()

    const { importJWK, SignJWT, calculateJwkThumbprint, generateKeyPair, exportJWK } = await import('jose')
    const { randomUUID, createHash } = await import('crypto')
    // @ts-ignore
    const { privateKey: identityKey } = await import('../../src/private-key.js')

    const identityPrivateKey = await importJWK(identityKey, 'ES256')
    const identityKid = identityKey.kid

    const dpopKeyPair = await generateKeyPair('ES256', { crv: 'P-256' })
    const dpopPublicJwk = await exportJWK(dpopKeyPair.publicKey)
    dpopPublicJwk.kid = createHash('sha256')
      .update(JSON.stringify(dpopPublicJwk))
      .digest('base64url')
    dpopPublicJwk.alg = 'ES256'
    const jkt = await calculateJwkThumbprint(dpopPublicJwk, 'sha256')

    const now = Math.floor(Date.now() / 1000)

    const token = await new SignJWT({
      webid: devServerUrl + '/webid',
      sub: devServerUrl + '/webid',
      cnf: { jkt },
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'at+jwt', kid: identityKid })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .setAudience('solid')
      .setIssuer(devServerUrl)
      .setJti(randomUUID())
      .sign(identityPrivateKey)

    const dpopHeader = await new SignJWT({
      htu: devServerUrl + '/outbox',
      htm: 'POST',
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk: dpopPublicJwk })
      .setIssuedAt(now)
      .sign(dpopKeyPair.privateKey)

    const activity = {
      type: 'Create',
      '@context': 'https://www.w3.org/ns/activitystreams',
      actor: `${devServerUrl}/actor`,
      to: ['https://recipient.example/actor'],
      object: { type: 'Note', content: 'Hello from outbox' }
    }

    const res = await fetch(`${devServerUrl}/outbox`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `DPoP ${token}`,
        'dpop': dpopHeader
      },
      body: JSON.stringify(activity)
    })

    expect(res.status).toBe(200)

    const patchedOutboxPages = mockServer!.getPatchedOutboxPages()
    expect(patchedOutboxPages.length).toBe(1)
    expect(patchedOutboxPages[0].body).toContain('Create')
    expect(patchedOutboxPages[0].body).toContain('Hello from outbox')
  })
})

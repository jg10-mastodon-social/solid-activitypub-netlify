import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()

describe('verifyIncomingActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('header validation', () => {
    it('should throw HttpSignatureError when Signature header is missing', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Date': new Date().toUTCString(),
          'Digest': 'SHA-256=abc',
          'Content-Type': 'application/activity+json'
        }
      })
      const activity = { type: 'Create', actor: 'https://other.example/actor' }

      await expect(verifyIncomingActivity(req, activity, new Uint8Array(), mockFetch)).rejects.toThrow(HttpSignatureError)
      await expect(verifyIncomingActivity(req, activity, new Uint8Array(), mockFetch)).rejects.toMatchObject({
        message: 'Missing Signature header',
        statusCode: 401
      })
    })

    it('should throw HttpSignatureError when Date header is missing', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': 'keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="abc"',
          'Digest': 'SHA-256=abc',
          'Content-Type': 'application/activity+json'
        }
      })
      const activity = { type: 'Create', actor: 'https://other.example/actor' }

      await expect(verifyIncomingActivity(req, activity, new Uint8Array(), mockFetch)).rejects.toMatchObject({
        message: 'Missing Date header',
        statusCode: 400
      })
    })

    it('should throw HttpSignatureError when Digest header is missing', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': 'keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="abc"',
          'Date': new Date().toUTCString(),
          'Content-Type': 'application/activity+json'
        }
      })
      const activity = { type: 'Create', actor: 'https://other.example/actor' }

      await expect(verifyIncomingActivity(req, activity, new Uint8Array(), mockFetch)).rejects.toMatchObject({
        message: 'Missing Digest header',
        statusCode: 400
      })
    })
  })

  describe('signature header parsing', () => {
    it('should throw HttpSignatureError when Signature header is malformed', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': 'invalid-header-format',
          'Date': new Date().toUTCString(),
          'Digest': 'SHA-256=abc',
          'Content-Type': 'application/activity+json'
        }
      })
      const activity = { type: 'Create', actor: 'https://other.example/actor' }

      await expect(verifyIncomingActivity(req, activity, new Uint8Array(), mockFetch)).rejects.toMatchObject({
        message: 'Invalid Signature header',
        statusCode: 400
      })
    })

    it('should throw HttpSignatureError when algorithm is not allowed', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': 'keyId="https://other.example/actor#main-key",algorithm="hmac-sha256",headers="(request-target) host date digest content-type",signature="abc"',
          'Date': new Date().toUTCString(),
          'Digest': 'SHA-256=abc',
          'Content-Type': 'application/activity+json'
        }
      })
      const activity = { type: 'Create', actor: 'https://other.example/actor' }

      await expect(verifyIncomingActivity(req, activity, new Uint8Array(), mockFetch)).rejects.toMatchObject({
        message: 'Unsupported algorithm: hmac-sha256',
        statusCode: 400
      })
    })
  })

  describe('timestamp validation', () => {
    it('should throw HttpSignatureError when timestamp is too old', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const oldDate = new Date(Date.now() - 10 * 60 * 1000).toUTCString()
      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': 'keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="abc"',
          'Date': oldDate,
          'Digest': 'SHA-256=abc',
          'Content-Type': 'application/activity+json'
        }
      })
      const activity = { type: 'Create', actor: 'https://other.example/actor' }

      await expect(verifyIncomingActivity(req, activity, new Uint8Array(), mockFetch)).rejects.toMatchObject({
        message: 'Request timestamp out of range',
        statusCode: 400
      })
    })

    it('should throw HttpSignatureError when timestamp is too far in future', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const futureDate = new Date(Date.now() + 3 * 60 * 1000).toUTCString()
      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': 'keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="abc"',
          'Date': futureDate,
          'Digest': 'SHA-256=abc',
          'Content-Type': 'application/activity+json'
        }
      })
      const activity = { type: 'Create', actor: 'https://other.example/actor' }

      await expect(verifyIncomingActivity(req, activity, new Uint8Array(), mockFetch)).rejects.toMatchObject({
        message: 'Request timestamp out of range',
        statusCode: 400
      })
    })
  })

  describe('digest validation', () => {
    it('should throw HttpSignatureError when digest does not match body', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const { createHash } = await import('node:crypto')
      const activity = { type: 'Create', actor: 'https://other.example/actor' }
      const body = JSON.stringify(activity)
      const wrongDigest = 'SHA-256=' + createHash('sha256').update('wrong body', 'utf8').digest('base64')

      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': 'keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="abc"',
          'Date': new Date().toUTCString(),
          'Digest': wrongDigest,
          'Content-Type': 'application/activity+json'
        },
        body
      })

      await expect(verifyIncomingActivity(req, activity, new Uint8Array(), mockFetch)).rejects.toMatchObject({
        message: 'Digest verification failed',
        statusCode: 400
      })
    })
  })

  describe('actor key fetching', () => {
    it('should throw HttpSignatureError when actor URL is blocked (SSRF)', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const activity = { type: 'Create', actor: 'https://attacker.com/actor' }
      const body = JSON.stringify(activity)
      const { createHash } = await import('node:crypto')
      const digest = 'SHA-256=' + createHash('sha256').update(body, 'utf8').digest('base64')

      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': 'keyId="http://127.0.0.1/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="abc"',
          'Date': new Date().toUTCString(),
          'Digest': digest,
          'Content-Type': 'application/activity+json'
        },
        body
      })

      await expect(verifyIncomingActivity(req, activity, new TextEncoder().encode(body), mockFetch)).rejects.toMatchObject({
        message: 'Actor URL blocked',
        statusCode: 502
      })
    })

    it('should throw HttpSignatureError when actor fetch fails', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const activity = { type: 'Create', actor: 'https://other.example/actor' }
      const body = JSON.stringify(activity)
      const { createHash } = await import('node:crypto')
      const digest = 'SHA-256=' + createHash('sha256').update(body, 'utf8').digest('base64')

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': 'keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="abc"',
          'Date': new Date().toUTCString(),
          'Digest': digest,
          'Content-Type': 'application/activity+json'
        },
        body
      })

      await expect(verifyIncomingActivity(req, activity, new TextEncoder().encode(body), mockFetch)).rejects.toMatchObject({
        message: 'Failed to fetch actor key',
        statusCode: 502
      })
    })

    it('should throw HttpSignatureError when keyId does not match actor publicKey.id', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const activity = { type: 'Create', actor: 'https://other.example/actor' }
      const body = JSON.stringify(activity)
      const { createHash } = await import('node:crypto')
      const digest = 'SHA-256=' + createHash('sha256').update(body, 'utf8').digest('base64')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'https://other.example/actor',
          publicKey: {
            id: 'https://different.example/actor#main-key',
            owner: 'https://other.example/actor',
            publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----'
          }
        })
      })

      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': 'keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="abc"',
          'Date': new Date().toUTCString(),
          'Digest': digest,
          'Content-Type': 'application/activity+json'
        },
        body
      })

      await expect(verifyIncomingActivity(req, activity, new TextEncoder().encode(body), mockFetch)).rejects.toMatchObject({
        message: 'keyId does not match actor publicKey',
        statusCode: 401
      })
    })
  })

  describe('signature verification', () => {
    it('should throw HttpSignatureError when signature is invalid', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const { generateKeyPairSync, createSign } = await import('node:crypto')

      const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
      const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string

      const activity = { type: 'Create', actor: 'https://other.example/actor' }
      const body = JSON.stringify(activity)
      const { createHash } = await import('node:crypto')
      const digest = 'SHA-256=' + createHash('sha256').update(body, 'utf8').digest('base64')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'https://other.example/actor',
          publicKey: {
            id: 'https://other.example/actor#main-key',
            owner: 'https://other.example/actor',
            publicKeyPem: publicKeyPem
          }
        })
      })

      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': 'keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="wrongsignature"',
          'Date': new Date().toUTCString(),
          'Digest': digest,
          'Content-Type': 'application/activity+json'
        },
        body
      })

      await expect(verifyIncomingActivity(req, activity, new TextEncoder().encode(body), mockFetch)).rejects.toMatchObject({
        message: 'Signature verification failed',
        statusCode: 401
      })
    })
  })

  describe('actor binding', () => {
    it('should throw HttpSignatureError when activity.actor does not match keyId', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const { generateKeyPairSync, createSign, createHash } = await import('node:crypto')

      const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
      const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string

      const activity = { type: 'Create', actor: 'https://attacker.com/actor' }
      const body = JSON.stringify(activity)
      const digest = 'SHA-256=' + createHash('sha256').update(body, 'utf8').digest('base64')

      const url = new URL('https://example.com/inbox')
      const signingString = [
        '(request-target): post /inbox',
        `host: ${url.host}`,
        `date: ${new Date().toUTCString()}`,
        `digest: ${digest}`,
        'content-type: application/activity+json'
      ].join('\n')

      const sign = createSign('RSA-SHA256')
      sign.update(signingString)
      sign.end()
      const signatureBase64 = sign.sign(privateKeyPem, 'base64')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'https://other.example/actor',
          publicKey: {
            id: 'https://other.example/actor#main-key',
            owner: 'https://other.example/actor',
            publicKeyPem: publicKeyPem
          }
        })
      })

      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': `keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="${signatureBase64}"`,
          'Date': new Date().toUTCString(),
          'Digest': digest,
          'Content-Type': 'application/activity+json'
        },
        body
      })

      await expect(verifyIncomingActivity(req, activity, new TextEncoder().encode(body), mockFetch)).rejects.toMatchObject({
        message: 'Actor does not match signature',
        statusCode: 400
      })
    })
  })

  describe('successful verification', () => {
    it('should return keyId when all verifications pass', async () => {
      const { verifyIncomingActivity } = await import('../../src/verifyRequest.js')
      const { generateKeyPairSync, createSign, createHash } = await import('node:crypto')

      const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
      const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string

      const activity = { type: 'Create', actor: 'https://other.example/actor' }
      const body = JSON.stringify(activity)
      const digest = 'SHA-256=' + createHash('sha256').update(body, 'utf8').digest('base64')

      const url = new URL('https://example.com/inbox')
      const dateHeader = new Date().toUTCString()
      const signingString = [
        '(request-target): post /inbox',
        `host: ${url.host}`,
        `date: ${dateHeader}`,
        `digest: ${digest}`,
        'content-type: application/activity+json'
      ].join('\n')

      const sign = createSign('RSA-SHA256')
      sign.update(signingString)
      sign.end()
      const signatureBase64 = sign.sign(privateKeyPem, 'base64')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'https://other.example/actor',
          publicKey: {
            id: 'https://other.example/actor#main-key',
            owner: 'https://other.example/actor',
            publicKeyPem: publicKeyPem
          }
        })
      })

      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': `keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="${signatureBase64}"`,
          'Date': dateHeader,
          'Digest': digest,
          'Content-Type': 'application/activity+json'
        },
        body
      })

      const result = await verifyIncomingActivity(req, activity, new TextEncoder().encode(body), mockFetch)
      expect(result.keyId).toBe('https://other.example/actor#main-key')
    })
  })

  describe('digest verification over raw bytes (regression: HTTP signature auth must use the raw body, not re-serialised JSON)', () => {
    it('should succeed when the sender signed non-compact JSON (e.g. Mastodon-style pretty body)', async () => {
      const { verifyIncomingActivity } = await import('../../src/verifyRequest.js')
      const { generateKeyPairSync, createSign, createHash } = await import('node:crypto')

      const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
      const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string

      const activity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Create',
        actor: 'https://other.example/actor',
        object: { type: 'Note', id: 'https://other.example/note/1', content: 'hello' }
      }

      const rawBodyText = JSON.stringify(activity, null, 2)
      const rawBodyBytes = new TextEncoder().encode(rawBodyText)
      const digest = 'SHA-256=' + createHash('sha256').update(rawBodyBytes).digest('base64')

      const url = new URL('https://example.com/inbox')
      const dateHeader = new Date().toUTCString()
      const signingString = [
        '(request-target): post /inbox',
        `host: ${url.host}`,
        `date: ${dateHeader}`,
        `digest: ${digest}`,
        'content-type: application/activity+json'
      ].join('\n')

      const sign = createSign('RSA-SHA256')
      sign.update(signingString)
      sign.end()
      const signatureBase64 = sign.sign(privateKeyPem, 'base64')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'https://other.example/actor',
          publicKey: {
            id: 'https://other.example/actor#main-key',
            owner: 'https://other.example/actor',
            publicKeyPem
          }
        })
      })

      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': `keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="${signatureBase64}"`,
          'Date': dateHeader,
          'Digest': digest,
          'Content-Type': 'application/activity+json'
        },
        body: rawBodyText
      })

      const result = await verifyIncomingActivity(req, activity, rawBodyBytes, mockFetch)
      expect(result.keyId).toBe('https://other.example/actor#main-key')
    })

    it('should succeed for a body whose key order differs from JSON.stringify(activity) would produce', async () => {
      const { verifyIncomingActivity } = await import('../../src/verifyRequest.js')
      const { generateKeyPairSync, createSign, createHash } = await import('node:crypto')

      const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
      const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string

      const activity = { type: 'Create', actor: 'https://other.example/actor' }

      const rawBodyText = '{"actor":"https://other.example/actor","type":"Create"}'
      const rawBodyBytes = new TextEncoder().encode(rawBodyText)
      const digest = 'SHA-256=' + createHash('sha256').update(rawBodyBytes).digest('base64')

      const url = new URL('https://example.com/inbox')
      const dateHeader = new Date().toUTCString()
      const signingString = [
        '(request-target): post /inbox',
        `host: ${url.host}`,
        `date: ${dateHeader}`,
        `digest: ${digest}`,
        'content-type: application/activity+json'
      ].join('\n')

      const sign = createSign('RSA-SHA256')
      sign.update(signingString)
      sign.end()
      const signatureBase64 = sign.sign(privateKeyPem, 'base64')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'https://other.example/actor',
          publicKey: {
            id: 'https://other.example/actor#main-key',
            owner: 'https://other.example/actor',
            publicKeyPem
          }
        })
      })

      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': `keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="${signatureBase64}"`,
          'Date': dateHeader,
          'Digest': digest,
          'Content-Type': 'application/activity+json'
        },
        body: rawBodyText
      })

      const result = await verifyIncomingActivity(req, activity, rawBodyBytes, mockFetch)
      expect(result.keyId).toBe('https://other.example/actor#main-key')
    })

    it('should reject when the rawBody bytes do not match the Digest header', async () => {
      const { verifyIncomingActivity, HttpSignatureError } = await import('../../src/verifyRequest.js')
      const { createHash } = await import('node:crypto')

      const activity = { type: 'Create', actor: 'https://other.example/actor' }

      const claimedBody = new TextEncoder().encode('{"type":"Create","actor":"https://other.example/actor"}')
      const claimedDigest = 'SHA-256=' + createHash('sha256').update(claimedBody).digest('base64')

      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': 'keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="abc"',
          'Date': new Date().toUTCString(),
          'Digest': claimedDigest,
          'Content-Type': 'application/activity+json'
        },
        body: new TextDecoder().decode(claimedBody)
      })

      const tamperedBytes = new TextEncoder().encode('{"type":"Create","actor":"https://attacker.example/actor"}')

      await expect(verifyIncomingActivity(req, activity, tamperedBytes, mockFetch))
        .rejects.toMatchObject({
          name: 'HttpSignatureError',
          message: 'Digest verification failed',
          statusCode: 400
        })
    })

    it('should accept an ArrayBuffer as rawBody', async () => {
      const { verifyIncomingActivity } = await import('../../src/verifyRequest.js')
      const { generateKeyPairSync, createSign, createHash } = await import('node:crypto')

      const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
      const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string

      const activity = { type: 'Create', actor: 'https://other.example/actor' }
      const rawBodyText = JSON.stringify(activity)
      const rawBodyBytes = new TextEncoder().encode(rawBodyText)
      const digest = 'SHA-256=' + createHash('sha256').update(rawBodyBytes).digest('base64')

      const url = new URL('https://example.com/inbox')
      const dateHeader = new Date().toUTCString()
      const signingString = [
        '(request-target): post /inbox',
        `host: ${url.host}`,
        `date: ${dateHeader}`,
        `digest: ${digest}`,
        'content-type: application/activity+json'
      ].join('\n')

      const sign = createSign('RSA-SHA256')
      sign.update(signingString)
      sign.end()
      const signatureBase64 = sign.sign(privateKeyPem, 'base64')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'https://other.example/actor',
          publicKey: {
            id: 'https://other.example/actor#main-key',
            owner: 'https://other.example/actor',
            publicKeyPem
          }
        })
      })

      const req = new Request('https://example.com/inbox', {
        method: 'POST',
        headers: {
          'Signature': `keyId="https://other.example/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="${signatureBase64}"`,
          'Date': dateHeader,
          'Digest': digest,
          'Content-Type': 'application/activity+json'
        },
        body: rawBodyText
      })

      const result = await verifyIncomingActivity(req, activity, rawBodyBytes.buffer, mockFetch)
      expect(result.keyId).toBe('https://other.example/actor#main-key')
    })
  })
})
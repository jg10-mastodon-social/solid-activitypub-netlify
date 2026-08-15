import { describe, it, expect, vi } from 'vitest'

describe('parseSignatureHeader', () => {
  it('should parse valid Signature header with all fields', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="Y2FiYWJjZGVmZw=="'
    const result = parseSignatureHeader(header)
    expect(result.keyId).toBe('https://example.com/actor#main-key')
    expect(result.algorithm).toBe('rsa-sha256')
    expect(result.headers).toBe('(request-target) host date digest content-type')
    expect(result.signature).toBe('Y2FiYWJjZGVmZw==')
  })

  it('should parse Signature header with minimal fields', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date",signature="abc123"'
    const result = parseSignatureHeader(header)
    expect(result.keyId).toBe('https://example.com/actor#main-key')
    expect(result.algorithm).toBe('rsa-sha256')
    expect(result.headers).toBe('(request-target) host date')
    expect(result.signature).toBe('abc123')
  })

  it('should throw when keyId is missing', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'algorithm="rsa-sha256",headers="(request-target)",signature="abc123"'
    expect(() => parseSignatureHeader(header)).toThrow('keyId')
  })

  it('should throw when signature is missing', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",algorithm="rsa-sha256",headers="(request-target)"'
    expect(() => parseSignatureHeader(header)).toThrow('signature')
  })

  it('should throw when headers is missing', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",algorithm="rsa-sha256",signature="abc123"'
    expect(() => parseSignatureHeader(header)).toThrow('headers')
  })

  it('should throw when algorithm is missing', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",headers="(request-target)",signature="abc123"'
    expect(() => parseSignatureHeader(header)).toThrow('algorithm')
  })

  it('should handle signature with special characters', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",algorithm="rsa-sha256",headers="(request-target)",signature="Y2Fi/Y2Fi==Z2V0"'
    const result = parseSignatureHeader(header)
    expect(result.signature).toBe('Y2Fi/Y2Fi==Z2V0')
  })

  it('should handle algorithm value with hyphens', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",algorithm="ecdsa-p256-sha256",headers="(request-target)",signature="abc123"'
    const result = parseSignatureHeader(header)
    expect(result.algorithm).toBe('ecdsa-p256-sha256')
  })
})

describe('isAllowedAlgorithm', () => {
  it('should accept rsa-sha256', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('rsa-sha256')).toBe(true)
  })

  it('should accept rsa-v1_5-sha256', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('rsa-v1_5-sha256')).toBe(true)
  })

  it('should accept hs2019', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('hs2019')).toBe(true)
  })

  it('should accept rsa-pss-sha512', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('rsa-pss-sha512')).toBe(true)
  })

  it('should accept ecdsa-p256-sha256', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('ecdsa-p256-sha256')).toBe(true)
  })

  it('should accept ed25519', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('ed25519')).toBe(true)
  })

  it('should reject unknown algorithms', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('hmac-sha256')).toBe(false)
    expect(isAllowedAlgorithm('sha256')).toBe(false)
    expect(isAllowedAlgorithm('md5')).toBe(false)
  })

  it('should reject algorithm with different case', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('RSA-SHA256')).toBe(false)
    expect(isAllowedAlgorithm('Ed25519')).toBe(false)
  })
})

describe('validateTimestamp', () => {
  it('should accept Date within 5 minutes', async () => {
    const { validateTimestamp } = await import('../../src/verifyHttpSignature.js')
    const now = new Date()
    const dateHeader = now.toUTCString()
    expect(validateTimestamp(dateHeader)).toBe(true)
  })

  it('should accept Date within 1 minute past', async () => {
    const { validateTimestamp } = await import('../../src/verifyHttpSignature.js')
    const past = new Date(Date.now() - 30 * 1000)
    const dateHeader = past.toUTCString()
    expect(validateTimestamp(dateHeader)).toBe(true)
  })

  it('should reject Date older than 5 minutes', async () => {
    const { validateTimestamp } = await import('../../src/verifyHttpSignature.js')
    const old = new Date(Date.now() - 6 * 60 * 1000)
    const dateHeader = old.toUTCString()
    expect(validateTimestamp(dateHeader)).toBe(false)
  })

  it('should reject Date more than 1 minute in future', async () => {
    const { validateTimestamp } = await import('../../src/verifyHttpSignature.js')
    const future = new Date(Date.now() + 2 * 60 * 1000)
    const dateHeader = future.toUTCString()
    expect(validateTimestamp(dateHeader)).toBe(false)
  })

  it('should reject invalid Date format', async () => {
    const { validateTimestamp } = await import('../../src/verifyHttpSignature.js')
    expect(validateTimestamp('invalid-date')).toBe(false)
    expect(validateTimestamp('')).toBe(false)
  })
})

describe('verifyDigest', () => {
  it('should accept matching digest', async () => {
    const { verifyDigest } = await import('../../src/verifyHttpSignature.js')
    const { createHash } = await import('node:crypto')
    const body = '{"type":"Create"}'
    const expectedHash = createHash('sha256').update(new TextEncoder().encode(body)).digest('base64')
    const hash = 'SHA-256=' + expectedHash
    expect(verifyDigest(new TextEncoder().encode(body), hash).match).toBe(true)
  })

  it('should reject mismatched digest', async () => {
    const { verifyDigest } = await import('../../src/verifyHttpSignature.js')
    const body = '{"type":"Create"}'
    const hash = 'SHA-256=WrongHashBase64=='
    expect(verifyDigest(new TextEncoder().encode(body), hash).match).toBe(false)
  })

  it('should reject missing Digest header', async () => {
    const { verifyDigest } = await import('../../src/verifyHttpSignature.js')
    const body = '{"type":"Create"}'
    const rawBody = new TextEncoder().encode(body)
    expect(verifyDigest(rawBody, '').match).toBe(false)
    expect(verifyDigest(rawBody, undefined as unknown as string).match).toBe(false)
  })

  it('should return { match: true } when digest matches', async () => {
    const { verifyDigest } = await import('../../src/verifyHttpSignature.js')
    const { createHash } = await import('node:crypto')
    const body = '{"type":"Create"}'
    const expectedHash = createHash('sha256').update(new TextEncoder().encode(body)).digest('base64')
    const hash = 'SHA-256=' + expectedHash
    const result = verifyDigest(new TextEncoder().encode(body), hash)
    expect(result).toEqual({ match: true })
  })

  it('should return { match: false, expected, actual, bodyLength } when digest mismatches', async () => {
    const { verifyDigest } = await import('../../src/verifyHttpSignature.js')
    const { createHash } = await import('node:crypto')
    const rawBody = new TextEncoder().encode('{"type":"Create"}')
    const claimedHeader = 'SHA-256=' + createHash('sha256').update(new TextEncoder().encode('{"type":"Announce"}')).digest('base64')
    const result = verifyDigest(rawBody, claimedHeader)
    expect(result.match).toBe(false)
    if (result.match === false) {
      expect(result.expected).toBe(claimedHeader.slice('SHA-256='.length))
      expect(result.actual).toBe(createHash('sha256').update(rawBody).digest('base64'))
      expect(result.bodyLength).toBe(rawBody.byteLength)
    }
  })
})

describe('fetchActorPublicKey', () => {
  it('should fetch actor public key from valid actor URL', async () => {
    const pem = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----'
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'https://example.com/actor',
        publicKey: {
          id: 'https://example.com/actor#main-key',
          owner: 'https://example.com/actor',
          publicKeyPem: pem
        }
      })
    })
    const { fetchActorPublicKey } = await import('../../src/verifyHttpSignature.js')
    const result = await fetchActorPublicKey('https://example.com/actor', mockFetch)
    expect(result.actorUrl).toBe('https://example.com/actor')
    expect(result.keyId).toBe('https://example.com/actor#main-key')
    expect(result.publicKeyPem).toBe(pem)
  })

  it('should reject actor URL pointing to private network', async () => {
    const mockFetch = vi.fn()
    const { fetchActorPublicKey } = await import('../../src/verifyHttpSignature.js')
    await expect(fetchActorPublicKey('http://127.0.0.1/actor', mockFetch)).rejects.toThrow('SSRF')
    await expect(fetchActorPublicKey('http://localhost/actor', mockFetch)).rejects.toThrow('SSRF')
    await expect(fetchActorPublicKey('http://10.0.0.1/actor', mockFetch)).rejects.toThrow('SSRF')
  })

  it('should throw when actor fetch fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    const { fetchActorPublicKey } = await import('../../src/verifyHttpSignature.js')
    await expect(fetchActorPublicKey('https://example.com/actor', mockFetch)).rejects.toThrow('Failed to fetch actor')
  })

  it('should throw when actor has no publicKey', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'https://example.com/actor' })
    })
    const { fetchActorPublicKey } = await import('../../src/verifyHttpSignature.js')
    await expect(fetchActorPublicKey('https://example.com/actor', mockFetch)).rejects.toThrow('publicKey')
  })
})

describe('buildSignatureBase', () => {
  it('should build correct signature base string', async () => {
    const { buildSignatureBase } = await import('../../src/verifyHttpSignature.js')
    const headers = {
      '(request-target)': 'post /inbox',
      host: 'example.com',
      date: 'Sat, 25 Oct 2014 07:24:34 GMT',
      digest: 'SHA-256=X48E9Y9D4tnIzrmI04jXjNnk4N=',
      'content-type': 'application/activity+json'
    }
    const result = buildSignatureBase(headers)
    expect(result).toBe('(request-target): post /inbox\nhost: example.com\ndate: Sat, 25 Oct 2014 07:24:34 GMT\ndigest: SHA-256=X48E9Y9D4tnIzrmI04jXjNnk4N=\ncontent-type: application/activity+json')
  })

  it('should build signature base with minimal headers', async () => {
    const { buildSignatureBase } = await import('../../src/verifyHttpSignature.js')
    const headers = {
      '(request-target)': 'get /outbox',
      host: 'example.com',
      date: 'Sat, 25 Oct 2014 07:24:34 GMT'
    }
    const result = buildSignatureBase(headers)
    expect(result).toBe('(request-target): get /outbox\nhost: example.com\ndate: Sat, 25 Oct 2014 07:24:34 GMT')
  })
})

describe('verifySignature', () => {
  it('should verify valid RSA-SHA256 signature', async () => {
    const { createSign, generateKeyPairSync } = await import('node:crypto')
    const { verifySignature } = await import('../../src/verifyHttpSignature.js')

    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048
    })

    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string

    const signingString = '(request-target): post /inbox\nhost: example.com\ndate: Sat, 25 Oct 2014 07:24:34 GMT\ndigest: SHA-256=X48E9Y9D4tnIzrmI04jXjNnk4N=\ncontent-type: application/activity+json'

    const sign = createSign('RSA-SHA256')
    sign.update(signingString)
    sign.end()
    const signatureBase64 = sign.sign(privateKeyPem, 'base64')

    const result = await verifySignature(publicKeyPem, 'rsa-sha256', signingString, signatureBase64)
    expect(result).toBe(true)
  })

  it('should reject invalid signature', async () => {
    const { generateKeyPairSync } = await import('node:crypto')
    const { verifySignature } = await import('../../src/verifyHttpSignature.js')

    const { publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048
    })
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string

    const signingString = '(request-target): post /inbox\nhost: example.com'
    const wrongSignature = 'Y2FiYWJjZGVmZw=='
    const result = await verifySignature(publicKeyPem, 'rsa-sha256', signingString, wrongSignature)
    expect(result).toBe(false)
  })
})

describe('verifyDigest (raw-bytes contract)', () => {
  it('should verify when given a Uint8Array of the raw body', async () => {
    const { verifyDigest } = await import('../../src/verifyHttpSignature.js')
    const { createHash } = await import('node:crypto')

    const bodyText = '{"type":"Create","actor":"https://example.com/actor"}'
    const expectedHash = createHash('sha256')
      .update(new TextEncoder().encode(bodyText))
      .digest('base64')

    const rawBytes = new TextEncoder().encode(bodyText)
    expect(verifyDigest(rawBytes, `SHA-256=${expectedHash}`).match).toBe(true)
  })

  it('should verify when given an ArrayBuffer of the raw body', async () => {
    const { verifyDigest } = await import('../../src/verifyHttpSignature.js')
    const { createHash } = await import('node:crypto')

    const bodyText = '{"type":"Create"}'
    const expectedHash = createHash('sha256')
      .update(new TextEncoder().encode(bodyText))
      .digest('base64')

    const buf = new TextEncoder().encode(bodyText).buffer
    expect(verifyDigest(buf, `SHA-256=${expectedHash}`).match).toBe(true)
  })

  it('should reject when raw bytes do not match the declared digest', async () => {
    const { verifyDigest } = await import('../../src/verifyHttpSignature.js')
    const wrong = new TextEncoder().encode('{"type":"Create"}')
    const claimed = 'SHA-256=' + (await import('node:crypto')).createHash('sha256')
      .update('{"type":"Announce"}', 'utf8').digest('base64')
    expect(verifyDigest(wrong, claimed).match).toBe(false)
  })

  it('should produce a different hash for whitespace-variant bytes that parse to the same object', async () => {
    const { verifyDigest } = await import('../../src/verifyHttpSignature.js')
    const { createHash } = await import('node:crypto')

    const compact = '{"type":"Create","actor":"x"}'
    const pretty = '{\n  "type": "Create",\n  "actor": "x"\n}'

    const digestCompact = 'SHA-256=' + createHash('sha256').update(new TextEncoder().encode(compact)).digest('base64')
    const digestPretty = 'SHA-256=' + createHash('sha256').update(new TextEncoder().encode(pretty)).digest('base64')

    expect(digestCompact).not.toBe(digestPretty)
    expect(verifyDigest(new TextEncoder().encode(compact), digestCompact).match).toBe(true)
    expect(verifyDigest(new TextEncoder().encode(pretty), digestPretty).match).toBe(true)
    expect(verifyDigest(new TextEncoder().encode(pretty), digestCompact).match).toBe(false)
  })
})

describe('verifyActorBinding', () => {
  it('should accept when activity.actor matches keyId actor', async () => {
    const { verifyActorBinding } = await import('../../src/verifyHttpSignature.js')
    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor'
    }
    const keyId = 'https://example.com/actor#main-key'
    expect(verifyActorBinding(activity, keyId)).toBe(true)
  })

  it('should reject when activity.actor does not match keyId actor', async () => {
    const { verifyActorBinding } = await import('../../src/verifyHttpSignature.js')
    const activity = {
      type: 'Create',
      actor: 'https://attacker.com/actor'
    }
    const keyId = 'https://example.com/actor#main-key'
    expect(verifyActorBinding(activity, keyId)).toBe(false)
  })
})
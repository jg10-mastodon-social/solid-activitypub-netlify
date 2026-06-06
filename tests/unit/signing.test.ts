import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockActorPrivateKey = {
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

vi.mock('../../src/actor-private-key.js', () => ({
  actorPrivateKey: mockActorPrivateKey
}))

describe('signActivityRequest', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
  })

  it('should add signature header to request', async () => {
    const { signActivityRequest } = await import('../../src/signing.js')

    const activityBody = JSON.stringify({ type: 'Create', actor: 'https://example.com/actor' })
    const mockSignedFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    })

    await signActivityRequest(
      'https://recipient.example/inbox',
      activityBody,
      'https://example.com/actor#main-key',
      mockSignedFetch
    )

    expect(mockSignedFetch).toHaveBeenCalledWith(
      'https://recipient.example/inbox',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Signature': expect.stringMatching(/keyId="https:\/\/example\.com\/actor#main-key"/)
        })
      })
    )
  })

  it('should include correct content-type header', async () => {
    const { signActivityRequest } = await import('../../src/signing.js')

    const activityBody = JSON.stringify({ type: 'Create' })
    const mockSignedFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    })

    await signActivityRequest(
      'https://recipient.example/inbox',
      activityBody,
      'https://example.com/actor#main-key',
      mockSignedFetch
    )

    expect(mockSignedFetch).toHaveBeenCalledWith(
      'https://recipient.example/inbox',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/activity+json'
        })
      })
    )
  })

  it('should include digest header with sha-256 hash', async () => {
    const { signActivityRequest } = await import('../../src/signing.js')

    const activityBody = JSON.stringify({ type: 'Create' })
    const mockSignedFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    })

    await signActivityRequest(
      'https://recipient.example/inbox',
      activityBody,
      'https://example.com/actor#main-key',
      mockSignedFetch
    )

    expect(mockSignedFetch).toHaveBeenCalledWith(
      'https://recipient.example/inbox',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Digest': expect.stringMatching(/^SHA-256=/)
        })
      })
    )
  })

  it('should return response from fetch', async () => {
    const { signActivityRequest } = await import('../../src/signing.js')

    const activityBody = JSON.stringify({ type: 'Create' })
    const mockResponse = { ok: true, status: 201 }
    const mockSignedFetch = vi.fn().mockResolvedValue(mockResponse)

    const result = await signActivityRequest(
      'https://recipient.example/inbox',
      activityBody,
      'https://example.com/actor#main-key',
      mockSignedFetch
    )

    expect(result).toEqual(mockResponse)
  })
})

describe('buildSigningString', () => {
  it('should build correct signing string format', async () => {
    const { buildSigningString } = await import('../../src/signing.js')

    const signingString = buildSigningString(
      'post',
      '/inbox',
      'recipient.example',
      'Sat, 25 Oct 2014 07:24:34 GMT',
      'SHA-256=example',
      'application/activity+json'
    )

    expect(signingString).toBe(
      '(request-target): post /inbox\n' +
      'host: recipient.example\n' +
      'date: Sat, 25 Oct 2014 07:24:34 GMT\n' +
      'digest: SHA-256=example\n' +
      'content-type: application/activity+json'
    )
  })
})

describe('createSignatureHeader', () => {
  it('should create correctly formatted signature header', async () => {
    const { createSignatureHeader } = await import('../../src/signing.js')

    const header = createSignatureHeader(
      'https://example.com/actor#main-key',
      'base64signature'
    )

    expect(header).toBe(
      'keyId="https://example.com/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="base64signature"'
    )
  })
})
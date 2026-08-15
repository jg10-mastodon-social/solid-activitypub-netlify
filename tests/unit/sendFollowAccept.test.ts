import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockActorKeys = {
  actor: {
    kty: 'RSA',
    e: 'AQAB',
    n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    d: 'X4cTteJY_gn4FYPsXB8rdXix5vwsg1FLN5E3EaG6RJoVH-HLLKD9M7dx5oo7GURknchnrRweUkC7hT5fJLM0WbFAKNLWY2vv7B6NqXSzUvxT0_YSfqijwp3RTzlBaCxWp4doF5SXA5uL3NaK3DAZ-V5-K5XqAvLD5VYr7cVvP7xVcwD5JmcPWNfGVaJrKdl80G9CsKy8-kzIKyN6Ej2FD8Lg2xjvBuKiLQVcT2w9hV3CkBvxLJPc5Md4yJ2cS3C0M2D2t5vOgV9V6K5a7lJqT1s9Y-K5V-5pL0b9RrT9M0cD0T5P4x0Q',
    p: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    q: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    dp: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN3kqkCq1n5h9XWqgsJuClpHxTyPMW_UUYYwMoeyPUxmznW1wDcwwqM5W3XEf65YGhiwnkjWaflX5OtomuCpP0N25Tp473ZHedtwnChY5xmwUl0',
    dq: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    qi: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8NJnqDKgw',
    alg: 'RS256',
    kid: 'test-key-id'
  }
}

vi.mock('../../src/actor-keys.js', () => ({
  actorKeys: mockActorKeys
}))

vi.mock('../../src/base-url.js', () => ({
  baseUrl: 'https://example.com'
}))

const mockFetch = vi.fn()

describe('sendFollowAccept', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch follower inbox', async () => {
    const { sendFollowAccept } = await import('../../src/services/sendFollowAccept.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ inbox: 'https://other.example/inbox' })
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200
    })

    const followActivity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      id: 'https://other.example/activities/1'
    }

    await sendFollowAccept(
      followActivity,
      mockFetch as SolidFetch,
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://other.example/actor',
      expect.objectContaining({ headers: expect.objectContaining({ accept: expect.stringContaining('application/activity+json') }) })
    )
  })

  it('should POST Accept activity to follower inbox', async () => {
    const { sendFollowAccept } = await import('../../src/services/sendFollowAccept.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ inbox: 'https://other.example/inbox' })
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200
    })

    const followActivity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      id: 'https://other.example/activities/1'
    }

    await sendFollowAccept(
      followActivity,
      mockFetch as SolidFetch,
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    const acceptCall = mockFetch.mock.calls[1]
    expect(acceptCall[0]).toBe('https://other.example/inbox')
    expect(acceptCall[1].method).toBe('POST')
    const body = JSON.parse(acceptCall[1].body)
    expect(body.type).toBe('Accept')
    expect(body.object).toEqual(followActivity)
  })

  it('should include correct signatures in Accept', async () => {
    const { sendFollowAccept } = await import('../../src/services/sendFollowAccept.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ inbox: 'https://other.example/inbox' })
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200
    })

    const followActivity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      id: 'https://other.example/activities/1'
    }

    await sendFollowAccept(
      followActivity,
      mockFetch as SolidFetch,
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    const acceptCall = mockFetch.mock.calls[1]
    const headers = acceptCall[1].headers
    expect(headers['Signature']).toBeDefined()
    expect(headers['Digest']).toBeDefined()
    expect(headers['Content-Type']).toBe('application/activity+json')
  })

  it('should throw if follower inbox not found', async () => {
    const { sendFollowAccept } = await import('../../src/services/sendFollowAccept.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({})
    })

    const followActivity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      id: 'https://other.example/activities/1'
    }

    await expect(sendFollowAccept(
      followActivity,
      mockFetch as SolidFetch,
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )).rejects.toThrow('Actor inbox not found')
  })
})
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
    qi: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    alg: 'RS256',
    kid: 'test-key-id'
  }
}

const mockAddToFollowing = vi.fn()
const mockFetch = vi.fn()

vi.mock('../../src/actor-keys.js', () => ({
  actorKeys: mockActorKeys
}))

vi.mock('../../src/base-url.js', () => ({
  baseUrl: 'https://example.com'
}))

vi.mock('../../src/services/addToFollowing.js', () => ({
  addToFollowing: mockAddToFollowing
}))

const actorUrl = 'https://example.com/actor'

describe('inbox: Accept of Follow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isAcceptActivity detects Accept type', async () => {
    const { isAcceptActivity } = await import('../../src/handlers/inbox.js')
    expect(isAcceptActivity({ type: 'Accept' })).toBe(true)
    expect(isAcceptActivity({ type: 'as:Accept' })).toBe(true)
    expect(isAcceptActivity({ type: ['Accept'] })).toBe(true)
    expect(isAcceptActivity({ type: 'Follow' })).toBe(false)
    expect(isAcceptActivity({})).toBe(false)
  })

  it('should add the followed actor when Accept wraps a Follow for this actor', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockAddToFollowing.mockResolvedValueOnce(undefined)
    mockFetch.mockResolvedValue({ ok: true, status: 200 })

    const accept = {
      type: 'Accept',
      actor: 'https://remote.example/bob',
      object: {
        type: 'Follow',
        actor: actorUrl,
        object: 'https://remote.example/bob'
      },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      accept,
      mockFetch as SolidFetch,
      `${actorUrl}/inbox/`,
      'actor',
      actorUrl,
      `${actorUrl}#main-key`,
      'https://storage.example/'
    )

    expect(result).toBe(true)
    expect(mockAddToFollowing).toHaveBeenCalledTimes(1)
    expect(mockAddToFollowing).toHaveBeenCalledWith(
      'https://remote.example/bob',
      mockFetch,
      'https://storage.example/',
      'actor'
    )
  })

  it('should not call addToFollowing when Accept wraps a Follow for a different actor', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockResolvedValue({ ok: true, status: 200 })

    const accept = {
      type: 'Accept',
      actor: 'https://remote.example/bob',
      object: {
        type: 'Follow',
        actor: 'https://other.example/charlie',
        object: 'https://remote.example/bob'
      },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      accept,
      mockFetch as SolidFetch,
      `${actorUrl}/inbox/`,
      'actor',
      actorUrl,
      `${actorUrl}#main-key`,
      'https://storage.example/'
    )

    expect(result).toBe(true)
    expect(mockAddToFollowing).not.toHaveBeenCalled()
  })

  it('should not call addToFollowing when Accept wraps a non-Follow object', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockResolvedValue({ ok: true, status: 200 })

    const accept = {
      type: 'Accept',
      actor: 'https://remote.example/bob',
      object: {
        type: 'Like',
        actor: actorUrl,
        object: 'https://remote.example/bob/notes/1'
      },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      accept,
      mockFetch as SolidFetch,
      `${actorUrl}/inbox/`,
      'actor',
      actorUrl,
      `${actorUrl}#main-key`,
      'https://storage.example/'
    )

    expect(result).toBe(true)
    expect(mockAddToFollowing).not.toHaveBeenCalled()
  })

  it('should not call addToFollowing when Accept.object is a bare URI string', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockResolvedValue({ ok: true, status: 200 })

    const accept = {
      type: 'Accept',
      actor: 'https://remote.example/bob',
      object: 'https://example.com/activities/some-follow-id',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      accept,
      mockFetch as SolidFetch,
      `${actorUrl}/inbox/`,
      'actor',
      actorUrl,
      `${actorUrl}#main-key`,
      'https://storage.example/'
    )

    expect(result).toBe(true)
    expect(mockAddToFollowing).not.toHaveBeenCalled()
  })

  it('should not call addToFollowing when solidStorageBaseUrl is not provided', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockResolvedValue({ ok: true, status: 200 })

    const accept = {
      type: 'Accept',
      actor: 'https://remote.example/bob',
      object: {
        type: 'Follow',
        actor: actorUrl,
        object: 'https://remote.example/bob'
      },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      accept,
      mockFetch as SolidFetch,
      `${actorUrl}/inbox/`,
      'actor',
      actorUrl,
      `${actorUrl}#main-key`
    )

    expect(result).toBe(true)
    expect(mockAddToFollowing).not.toHaveBeenCalled()
  })

  it('should propagate addToFollowing failures (return false)', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockAddToFollowing.mockRejectedValueOnce(new Error('pod error'))

    const accept = {
      type: 'Accept',
      actor: 'https://remote.example/bob',
      object: {
        type: 'Follow',
        actor: actorUrl,
        object: 'https://remote.example/bob'
      },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      accept,
      mockFetch as SolidFetch,
      `${actorUrl}/inbox/`,
      'actor',
      actorUrl,
      `${actorUrl}#main-key`,
      'https://storage.example/'
    )

    expect(result).toBe(false)
  })
})

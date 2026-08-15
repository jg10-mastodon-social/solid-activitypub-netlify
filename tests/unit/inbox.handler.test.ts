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

vi.mock('../../src/actor-keys.js', () => ({
  actorKeys: mockActorKeys
}))

vi.mock('../../src/base-url.js', () => ({
  baseUrl: 'https://example.com'
}))

const mockFetch = vi.fn()

describe('inbox handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should persist activity to derived page URL', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      type: 'Create',
      actor: 'https://other.example/actor',
      object: { type: 'Note', content: 'Hello' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    await handleInboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/actor/inbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    expect(mockFetch).toHaveBeenCalled()
  })

  it('should skip persistence for Delete activities', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      type: 'Delete',
      actor: 'https://other.example/actor',
      object: 'https://example.com/activities/1',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/actor/inbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    expect(result).toBe(true)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should return true on success', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200
    })

    const activity = {
      type: 'Create',
      actor: 'https://other.example/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/actor/inbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    expect(result).toBe(true)
  })

  it('should return false when derivePageUrl fails', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockRejectedValue(new Error('Network error'))

    const activity = {
      type: 'Create',
      actor: 'https://other.example/actor',
      id: 'https://other.example/activities/1',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/actor/inbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    expect(result).toBe(false)
  })

  it('should skip persistence for Follow activities and send Accept', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://other.example/actor') {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ inbox: 'https://other.example/inbox' })
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({})
      }
    })

    const activity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/actor/inbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key',
      'https://example.com/'
    )

    expect(result).toBe(true)
  })

  it('should reject Follow with object not matching the actor URL', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/someoneelse',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/actor/inbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key',
      'https://example.com/'
    )

    expect(result).toBe(false)
  })

  it('should detect Follow with as: prefix', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://other.example/actor') {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ inbox: 'https://other.example/inbox' })
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({})
      }
    })

    const activity = {
      type: 'as:Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/actor/inbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key',
      'https://example.com/'
    )

    expect(result).toBe(true)
  })

  it('should detect Follow in array type', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://other.example/actor') {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ inbox: 'https://other.example/inbox' })
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({})
      }
    })

    const activity = {
      type: ['as:Follow', 'Activity'],
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/actor/inbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key',
      'https://example.com/'
    )

    expect(result).toBe(true)
  })

  it('should detect Undo activity', async () => {
    const { isUndoActivity } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: 'Undo',
      actor: 'https://other.example/actor',
      object: { type: 'Follow', actor: 'https://other.example/actor', object: 'https://example.com/actor' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }
    expect(isUndoActivity(activity)).toBe(true)
  })

  it('should detect Undo with as: prefix', async () => {
    const { isUndoActivity } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: 'as:Undo',
      actor: 'https://other.example/actor',
      object: { type: 'Follow', actor: 'https://other.example/actor', object: 'https://example.com/actor' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }
    expect(isUndoActivity(activity)).toBe(true)
  })

  it('should detect Undo with array type', async () => {
    const { isUndoActivity } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: ['as:Undo', 'Activity'],
      actor: 'https://other.example/actor',
      object: { type: 'Follow', actor: 'https://other.example/actor', object: 'https://example.com/actor' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }
    expect(isUndoActivity(activity)).toBe(true)
  })

  it('should detect Undo/Follow activity', async () => {
    const { isUndoFollow } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: 'Undo',
      actor: 'https://other.example/actor',
      object: { type: 'Follow', actor: 'https://other.example/actor', object: 'https://example.com/actor' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }
    expect(isUndoFollow(activity)).toBe(true)
  })

  it('should detect Undo/Follow with as: prefix', async () => {
    const { isUndoFollow } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: 'as:Undo',
      actor: 'https://other.example/actor',
      object: { type: 'as:Follow', actor: 'https://other.example/actor', object: 'https://example.com/actor' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }
    expect(isUndoFollow(activity)).toBe(true)
  })

  it('should not detect Undo/Follow when object is not a Follow', async () => {
    const { isUndoFollow } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: 'Undo',
      actor: 'https://other.example/actor',
      object: { type: 'Like', actor: 'https://other.example/actor', object: 'https://example.com/note/1' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }
    expect(isUndoFollow(activity)).toBe(false)
  })

  it('should reject Undo Follow with inner object not matching the actor URL', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      type: 'Undo',
      actor: 'https://other.example/actor',
      object: { type: 'Follow', actor: 'https://other.example/actor', object: 'https://example.com/someoneelse' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/actor/inbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key',
      'https://example.com/'
    )

    expect(result).toBe(false)
  })

  it('should handle Undo/Follow by removing from followers without persisting', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/followers/> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/followers/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/followers/pages/123> <https://www.w3.org/ns/activitystreams#items> <https://other.example/actor>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    const activity = {
      type: 'Undo',
      actor: 'https://other.example/actor',
      object: { type: 'Follow', actor: 'https://other.example/actor', object: 'https://example.com/actor' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/actor/inbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key',
      'https://example.com/'
    )

    expect(result).toBe(true)

    const removeCall = mockFetch.mock.calls.find(call =>
      (call[0] as string).includes('followers') && call[1]?.method === 'PATCH'
    )
    expect(removeCall).toBeDefined()

    const inboxPatchCall = mockFetch.mock.calls.find(call =>
      (call[0] as string).includes('/inbox') && call[1]?.method === 'PATCH'
    )
    expect(inboxPatchCall).toBeUndefined()
  })
})
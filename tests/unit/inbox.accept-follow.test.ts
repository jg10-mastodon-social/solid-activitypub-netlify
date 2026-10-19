import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockAddToFollowing = vi.fn()
const mockFetch = vi.fn()

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

    expect(result.success).toBe(true)
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

    expect(result.success).toBe(true)
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

    expect(result.success).toBe(true)
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

    expect(result.success).toBe(true)
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

    expect(result.success).toBe(true)
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

    expect(result.success).toBe(false)
  })
})

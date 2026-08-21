import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

vi.mock('../../src/signing.js', () => ({
  signActivityRequest: vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
}))

const mockRemoveFromFollowing = vi.fn()

vi.mock('../../src/services/removeFromFollowing.js', () => ({
  removeFromFollowing: mockRemoveFromFollowing
}))

const mockFetch = vi.fn()

const actorUrl = 'https://example.com/actor'
const followedActorUrl = 'https://remote.example/bob'

describe('outbox Undo Follow removes from following', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRemoveFromFollowing.mockResolvedValue(undefined)
  })

  it('calls removeFromFollowing with the inner Follow.object when activity is Undo Follow', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      type: 'Undo',
      actor: actorUrl,
      object: {
        type: 'Follow',
        actor: actorUrl,
        object: followedActorUrl
      },
      to: [followedActorUrl],
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    await handleOutboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/storage/actor/outbox/',
      'actor',
      actorUrl,
      `${actorUrl}#main-key`,
      'https://example.com/storage/'
    )

    expect(mockRemoveFromFollowing).toHaveBeenCalledTimes(1)
    expect(mockRemoveFromFollowing).toHaveBeenCalledWith(
      followedActorUrl,
      mockFetch,
      'https://example.com/storage/',
      'actor'
    )
  })

  it('does not call removeFromFollowing when activity is not Undo Follow', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      type: 'Create',
      actor: actorUrl,
      to: [followedActorUrl],
      object: { type: 'Note', content: 'Hello' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    await handleOutboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/storage/actor/outbox/',
      'actor',
      actorUrl,
      `${actorUrl}#main-key`,
      'https://example.com/storage/'
    )

    expect(mockRemoveFromFollowing).not.toHaveBeenCalled()
  })

  it('still returns 200 when removeFromFollowing throws', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })
    mockRemoveFromFollowing.mockRejectedValueOnce(new Error('pod error'))

    const activity = {
      type: 'Undo',
      actor: actorUrl,
      object: {
        type: 'Follow',
        actor: actorUrl,
        object: followedActorUrl
      },
      to: [followedActorUrl],
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleOutboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/storage/actor/outbox/',
      'actor',
      actorUrl,
      `${actorUrl}#main-key`,
      'https://example.com/storage/'
    )

    expect(result.delivered).toBeGreaterThanOrEqual(0)
  })

  it('does not call removeFromFollowing when solidStorageBaseUrl is not provided', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      type: 'Undo',
      actor: actorUrl,
      object: {
        type: 'Follow',
        actor: actorUrl,
        object: followedActorUrl
      },
      to: [followedActorUrl],
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    await handleOutboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/storage/actor/outbox/',
      'actor',
      actorUrl,
      `${actorUrl}#main-key`
    )

    expect(mockRemoveFromFollowing).not.toHaveBeenCalled()
  })
})

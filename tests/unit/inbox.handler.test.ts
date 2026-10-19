import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

vi.mock('../../src/actors/keys.js', async () => {
  const { generateKeyPairSync } = await import('node:crypto')
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const privateKeyJwk = privateKey.export({ format: 'jwk' }) as Record<string, unknown>
  return {
    openActorKeys: () => ({
      getPrivateKeyJwk: async () => privateKeyJwk
    })
  }
})

vi.mock('../../src/actors/registry.js', () => ({
  openActorRegistry: () => ({})
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

    expect(result.success).toBe(true)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns reason=missing_context when @context is absent', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      type: 'Create',
      actor: 'https://other.example/actor',
      object: { type: 'Note', content: 'hi' }
    } as Record<string, unknown>

    const result = await handleInboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/actor/inbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    expect(result).toEqual({ success: false, reason: 'missing_context' })
  })

  it('returns reason=missing_type when type is absent', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      actor: 'https://other.example/actor'
    } as Record<string, unknown>

    const result = await handleInboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/actor/inbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    expect(result).toEqual({ success: false, reason: 'missing_type' })
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

    expect(result.success).toBe(true)
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

    expect(result.success).toBe(false)
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

    expect(result.success).toBe(true)
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

    expect(result.success).toBe(false)
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

    expect(result.success).toBe(true)
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

    expect(result.success).toBe(true)
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

    expect(result.success).toBe(false)
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

    expect(result.success).toBe(true)

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

describe('shared inbox handler', () => {
  const actorAlice: ActorConfig = {
    name: 'alice',
    path: '/alice',
    url: 'https://example.com/alice',
    keyId: 'https://example.com/alice#main-key',
    inboxUrl: 'https://example.com/alice/inbox',
    outboxUrl: 'https://example.com/alice/outbox',
    followersUrl: 'https://example.com/alice/followers',
    followingUrl: 'https://example.com/alice/following',
    sharedInboxUrl: 'https://example.com/inbox',
    webfingerResource: 'acct:alice@example.com'
  }
  const actorByPath = { '/alice': actorAlice }

  it('returns no_target_actor when addressing does not match any local actor', async () => {
    const { handleSharedInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') })

    const activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Delete',
      actor: 'https://other.example/actor',
      object: 'https://other.example/status/1',
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: ['https://other.example/followers']
    } as Record<string, unknown>

    const result = await handleSharedInboxActivity(
      activity,
      mockFetch as SolidFetch,
      { actorByPath, solidStorageBaseUrl: 'https://storage.example/' }
    )

    expect(result.success).toBe(false)
    expect(result.reason).toBe('no_target_actor')
  })

  it('logs the addressing envelope when no target actor can be resolved', async () => {
    const { handleSharedInboxActivity } = await import('../../src/handlers/inbox.js')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    mockFetch.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') })

    const activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Delete',
      actor: 'https://other.example/actor',
      object: 'https://other.example/status/1',
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: ['https://other.example/followers']
    } as Record<string, unknown>

    await handleSharedInboxActivity(
      activity,
      mockFetch as SolidFetch,
      { actorByPath, solidStorageBaseUrl: 'https://storage.example/' }
    )

    const addressLog = logSpy.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('shared inbox no target actor')
    )
    expect(addressLog).toBeDefined()
    const message = addressLog![0] as string
    expect(message).toContain('addressed=')
    expect(message).toContain('https://www.w3.org/ns/activitystreams#Public')
    expect(message).toContain('https://other.example/followers')

    logSpy.mockRestore()
  })
})

import type { ActorConfig } from '../../src/types.js'

describe('resolveTargetActorFromActivity', () => {
  const actorAlice: ActorConfig = {
    name: 'alice',
    path: '/alice',
    url: 'https://example.com/alice',
    keyId: 'https://example.com/alice#main-key',
    inboxUrl: 'https://example.com/alice/inbox',
    outboxUrl: 'https://example.com/alice/outbox',
    followersUrl: 'https://example.com/alice/followers',
    followingUrl: 'https://example.com/alice/following',
    sharedInboxUrl: 'https://example.com/inbox',
    webfingerResource: 'acct:alice@example.com'
  }
  const actorBob: ActorConfig = {
    name: 'bob',
    path: '/bob',
    url: 'https://example.com/bob',
    keyId: 'https://example.com/bob#main-key',
    inboxUrl: 'https://example.com/bob/inbox',
    outboxUrl: 'https://example.com/bob/outbox',
    followersUrl: 'https://example.com/bob/followers',
    followingUrl: 'https://example.com/bob/following',
    sharedInboxUrl: 'https://example.com/inbox',
    webfingerResource: 'acct:bob@example.com'
  }
  const actorByPath = { '/alice': actorAlice, '/bob': actorBob }

  it('resolves Follow by matching activity.object to an actor URL', async () => {
    const { resolveTargetActorFromActivity } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/alice'
    }
    expect(resolveTargetActorFromActivity(activity, actorByPath)).toBe(actorAlice)
  })

  it('resolves Undo Follow by matching inner object.object to an actor URL', async () => {
    const { resolveTargetActorFromActivity } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: 'Undo',
      actor: 'https://other.example/actor',
      object: {
        type: 'Follow',
        actor: 'https://other.example/actor',
        object: 'https://example.com/bob'
      }
    }
    expect(resolveTargetActorFromActivity(activity, actorByPath)).toBe(actorBob)
  })

  it('resolves other activities by scanning cc for a matching followers URL', async () => {
    const { resolveTargetActorFromActivity } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: 'Create',
      actor: 'https://other.example/actor',
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: ['https://example.com/alice/followers'],
      object: { type: 'Note', content: 'hi' }
    }
    expect(resolveTargetActorFromActivity(activity, actorByPath)).toBe(actorAlice)
  })

  it('resolves other activities by scanning to for a matching actor URL', async () => {
    const { resolveTargetActorFromActivity } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: 'Create',
      actor: 'https://other.example/actor',
      to: ['https://example.com/bob'],
      object: { type: 'Note', content: 'hi' }
    }
    expect(resolveTargetActorFromActivity(activity, actorByPath)).toBe(actorBob)
  })

  it('returns null when only Public is in the addressing fields', async () => {
    const { resolveTargetActorFromActivity } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: 'Create',
      actor: 'https://other.example/actor',
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      object: { type: 'Note', content: 'hi' }
    }
    expect(resolveTargetActorFromActivity(activity, actorByPath)).toBeNull()
  })

  it('returns null when the addressing field contains a foreign URL', async () => {
    const { resolveTargetActorFromActivity } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: 'Create',
      actor: 'https://other.example/actor',
      cc: ['https://other.example/followers'],
      object: { type: 'Note', content: 'hi' }
    }
    expect(resolveTargetActorFromActivity(activity, actorByPath)).toBeNull()
  })

  it('returns null when the addressing fields are missing entirely', async () => {
    const { resolveTargetActorFromActivity } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: 'Create',
      actor: 'https://other.example/actor',
      object: { type: 'Note', content: 'hi' }
    }
    expect(resolveTargetActorFromActivity(activity, actorByPath)).toBeNull()
  })

  it('returns null when Follow.object does not match any configured actor', async () => {
    const { resolveTargetActorFromActivity } = await import('../../src/handlers/inbox.js')
    const activity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'https://other.example/actor'
    }
    expect(resolveTargetActorFromActivity(activity, actorByPath)).toBeNull()
  })
})
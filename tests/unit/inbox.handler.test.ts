import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

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

    await handleInboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/inbox/', 'https://example.com/actor', 'https://example.com/actor#main-key')

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

    const result = await handleInboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/inbox/', 'https://example.com/actor', 'https://example.com/actor#main-key')

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

    const result = await handleInboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/inbox/', 'https://example.com/actor', 'https://example.com/actor#main-key')

    expect(result).toBe(true)
  })

  it('should return true even if derivePageUrl fails', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch.mockRejectedValue(new Error('Network error'))

    const activity = {
      type: 'Create',
      actor: 'https://other.example/actor',
      id: 'https://other.example/activities/1',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/inbox/', 'https://example.com/actor', 'https://example.com/actor#main-key')

    expect(result).toBe(false)
  })

  it('should skip persistence for Follow activities and send Accept', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ inbox: 'https://other.example/inbox' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    const activity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/inbox/', 'https://example.com/actor', 'https://example.com/actor#main-key', 'https://example.com/')

    expect(result).toBe(true)
  })

  it('should detect Follow with as: prefix', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ inbox: 'https://other.example/inbox' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    const activity = {
      type: 'as:Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/inbox/', 'https://example.com/actor', 'https://example.com/actor#main-key', 'https://example.com/')

    expect(result).toBe(true)
  })

  it('should detect Follow in array type', async () => {
    const { handleInboxActivity } = await import('../../src/handlers/inbox.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ inbox: 'https://other.example/inbox' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    const activity = {
      type: ['as:Follow', 'Activity'],
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleInboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/inbox/', 'https://example.com/actor', 'https://example.com/actor#main-key', 'https://example.com/')

    expect(result).toBe(true)
  })
})

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

    await handleInboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/inbox/')

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

    const result = await handleInboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/inbox/')

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

    const result = await handleInboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/inbox/')

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

    const result = await handleInboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/inbox/')

    expect(result).toBe(false)
  })
})

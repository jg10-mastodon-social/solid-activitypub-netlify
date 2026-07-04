import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()

describe('outbox handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should persist activity to derived page URL', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      object: { type: 'Note', content: 'Hello' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    await handleOutboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/outbox/')

    expect(mockFetch).toHaveBeenCalled()
  })

  it('should return true on success', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200
    })

    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleOutboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/outbox/')

    expect(result).toBe(true)
  })

  it('should return false when derivePageUrl fails', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')
    mockFetch.mockRejectedValue(new Error('Network error'))

    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      id: 'https://example.com/activities/1',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleOutboxActivity(activity, mockFetch as SolidFetch, 'https://example.com/outbox/')

    expect(result).toBe(false)
  })
})

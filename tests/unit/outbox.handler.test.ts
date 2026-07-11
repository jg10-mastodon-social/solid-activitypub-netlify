import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

vi.mock('../../src/signing.js', () => ({
  signActivityRequest: vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
}))

const mockFetch = vi.fn()

describe('outbox handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return object with delivered, failed, and results on success', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['https://recipient.example/actor'],
      object: { type: 'Note', content: 'Hello' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleOutboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/outbox/',
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    expect(result).toHaveProperty('delivered')
    expect(result).toHaveProperty('failed')
    expect(result).toHaveProperty('results')
    expect(typeof result.delivered).toBe('number')
    expect(typeof result.failed).toBe('number')
    expect(Array.isArray(result.results)).toBe(true)
  })

  it('should throw error when context is missing', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor'
    }

    await expect(handleOutboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/outbox/',
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )).rejects.toThrow('Activity must include @context')
  })

  it('should throw error when actor does not match expected', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      type: 'Create',
      actor: 'https://other.example/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    await expect(handleOutboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/outbox/',
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )).rejects.toThrow('Actor mismatch')
  })

  it('should distribute activity to recipients', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['https://recipient.example/actor'],
      object: { type: 'Note', content: 'Hello' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleOutboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/outbox/',
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    expect(result.results.length).toBe(1)
    expect(result.results[0].recipient).toBe('https://recipient.example/actor')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

vi.mock('../../src/signing.js', () => ({
  signActivityRequest: vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
}))

const mockFetch = vi.fn()

describe('outbox broadcast to followers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does NOT broadcast to followers when activity is not public', async () => {
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
      'https://example.com/storage/actor/outbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key',
      'https://example.com/storage/'
    )

    expect(result.results.length).toBe(1)
    expect(result.results[0].recipient).toBe('https://recipient.example/actor')
  })

  it('broadcasts to followers when activity has Public in to', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')

    let callCount = 0
    mockFetch.mockImplementation(async (url: string) => {
      callCount++
      if (url === 'https://example.com/storage/actor/followers/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/followers/>
  a as:OrderedCollection ;
  as:first <https://example.com/storage/actor/followers/pages/1> .
`)
        }
      }
      if (url === 'https://example.com/storage/actor/followers/pages/1') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/followers/pages/1>
  a as:OrderedCollectionPage ;
  as:items [
    a as:Follow ;
    as:actor <https://follower.example/actor> ;
    as:object <https://example.com/actor>
  ] .
`)
        }
      }
      if (url === 'https://example.com/actor') {
        return {
          ok: true,
          json: () => Promise.resolve({
            id: 'https://example.com/actor',
            inbox: 'https://example.com/inbox'
          })
        }
      }
      if (url === 'https://follower.example/actor') {
        return {
          ok: true,
          json: () => Promise.resolve({
            id: 'https://follower.example/actor',
            inbox: 'https://follower.example/inbox'
          })
        }
      }
      return { ok: true, status: 200 }
    })

    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['Public'],
      object: { type: 'Note', content: 'Hello followers!' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleOutboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/storage/actor/outbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key',
      'https://example.com/storage/'
    )

    const followerDelivery = result.results.find(r => r.recipient === 'https://follower.example/actor')
    expect(followerDelivery).toBeDefined()
    expect(followerDelivery?.ok).toBe(true)
  })

  it('does not duplicate followers who are explicit recipients', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')

    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/storage/actor/followers/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/followers/>
  a as:OrderedCollection ;
  as:first <https://example.com/storage/actor/followers/pages/1> .
`)
        }
      }
      if (url === 'https://example.com/storage/actor/followers/pages/1') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/followers/pages/1>
  a as:OrderedCollectionPage ;
  as:items [
    a as:Follow ;
    as:actor <https://recipient.example/actor> ;
    as:object <https://example.com/actor>
  ] .
`)
        }
      }
      if (url === 'https://example.com/actor') {
        return {
          ok: true,
          json: () => Promise.resolve({
            id: 'https://example.com/actor',
            inbox: 'https://example.com/inbox'
          })
        }
      }
      return { ok: true, status: 200 }
    })

    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['Public', 'https://recipient.example/actor'],
      object: { type: 'Note', content: 'Hello' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleOutboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/storage/actor/outbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key',
      'https://example.com/storage/'
    )

    const recipientResults = result.results.filter(r => r.recipient === 'https://recipient.example/actor')
    expect(recipientResults.length).toBe(1)
  })

  it('still delivers to explicit recipients when broadcasting', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')

    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/storage/actor/followers/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/followers/>
  a as:OrderedCollection ;
  as:first <https://example.com/storage/actor/followers/pages/1> .
`)
        }
      }
      if (url === 'https://example.com/storage/actor/followers/pages/1') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/followers/pages/1>
  a as:OrderedCollectionPage ;
  as:items [
    a as:Follow ;
    as:actor <https://follower.example/actor> ;
    as:object <https://example.com/actor>
  ] .
`)
        }
      }
      if (url === 'https://example.com/actor') {
        return {
          ok: true,
          json: () => Promise.resolve({
            id: 'https://example.com/actor',
            inbox: 'https://example.com/inbox'
          })
        }
      }
      if (url === 'https://other.example/actor') {
        return {
          ok: true,
          json: () => Promise.resolve({
            id: 'https://other.example/actor',
            inbox: 'https://other.example/inbox'
          })
        }
      }
      return { ok: true, status: 200 }
    })

    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['Public'],
      cc: ['https://other.example/actor'],
      object: { type: 'Note', content: 'Hello' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleOutboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/storage/actor/outbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key',
      'https://example.com/storage/'
    )

    const otherRecipient = result.results.find(r => r.recipient === 'https://other.example/actor')
    expect(otherRecipient).toBeDefined()
    const followerRecipient = result.results.find(r => r.recipient === 'https://follower.example/actor')
    expect(followerRecipient).toBeDefined()
  })

  it('handles getFollowers failure gracefully', async () => {
    const { handleOutboxActivity } = await import('../../src/handlers/outbox.js')

    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/storage/actor/followers/') {
        return {
          ok: false,
          status: 500
        }
      }
      if (url === 'https://example.com/actor') {
        return {
          ok: true,
          json: () => Promise.resolve({
            id: 'https://example.com/actor',
            inbox: 'https://example.com/inbox'
          })
        }
      }
      return { ok: true, status: 200 }
    })

    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['Public'],
      object: { type: 'Note', content: 'Hello' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    const result = await handleOutboxActivity(
      activity,
      mockFetch as SolidFetch,
      'https://example.com/storage/actor/outbox/',
      'actor',
      'https://example.com/actor',
      'https://example.com/actor#main-key',
      'https://example.com/storage/'
    )

    expect(result.results.length).toBe(0)
    expect(result.delivered).toBe(0)
  })
})
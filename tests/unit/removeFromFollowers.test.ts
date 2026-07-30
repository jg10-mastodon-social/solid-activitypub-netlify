import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

describe('removeFromFollowers', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should patch followers page to remove actor', async () => {
    const { removeFromFollowers } = await import('../../src/services/removeFromFollowers.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/followers/> <https://www.w3.org/ns/activitystreams#first> <https://example.com/followers/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/followers/pages/123> <https://www.w3.org/ns/activitystreams#items> <https://other.example/actor/follow/123>.
<https://other.example/actor/follow/123> a <https://www.w3.org/ns/activitystreams#Follow>.
<https://other.example/actor/follow/123> <https://www.w3.org/ns/activitystreams#actor> <https://other.example/actor>.`)
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

    await removeFromFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'https://example.com/actor'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    const patchBody = patchCall![1].body as string
    expect(patchBody).toContain('solid:deletes')
    expect(patchBody).not.toContain('solid:inserts')
  })

  it('should use correct followers URL', async () => {
    const { removeFromFollowers } = await import('../../src/services/removeFromFollowers.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/followers/> <https://www.w3.org/ns/activitystreams#first> <https://example.com/followers/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/followers/pages/123> <https://www.w3.org/ns/activitystreams#items> <https://other.example/actor/follow/123>.
<https://other.example/actor/follow/123> a <https://www.w3.org/ns/activitystreams#Follow>.
<https://other.example/actor/follow/123> <https://www.w3.org/ns/activitystreams#actor> <https://other.example/actor>.`)
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

    await removeFromFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'https://example.com/actor'
    )

    const followersCall = mockFetch.mock.calls.find(call =>
      (call[0] as string).includes('followers')
    )
    expect(followersCall).toBeDefined()
    expect((followersCall![0] as string)).toBe('https://example.com/followers/')
  })

  it('should resolve relative URL in first page link', async () => {
    const { removeFromFollowers } = await import('../../src/services/removeFromFollowers.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<> <https://www.w3.org/ns/activitystreams#first> <pages/1785063320555>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/followers/pages/1785063320555> <https://www.w3.org/ns/activitystreams#items> <https://other.example/actor/follow/123>.
<https://other.example/actor/follow/123> a <https://www.w3.org/ns/activitystreams#Follow>.
<https://other.example/actor/follow/123> <https://www.w3.org/ns/activitystreams#actor> <https://other.example/actor>.`)
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

    await removeFromFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'https://example.com/actor'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    expect(patchCall![0] as string).toBe('https://example.com/followers/pages/1785063320555')
  })

  it('should handle multi-line Turtle format with semicolons', async () => {
    const { removeFromFollowers } = await import('../../src/services/removeFromFollowers.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<> <https://www.w3.org/ns/activitystreams#first> <https://example.com/followers/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#>.

<> a as:OrderedCollectionPage;
    as:partOf <../>;
    as:items <https://activitypub.academy/users/albilus_puhuss/follow/1785410321943>.
<https://activitypub.academy/users/albilus_puhuss/follow/1785410321943> a as:Follow;
    as:actor <https://activitypub.academy/users/albilus_puhuss>;
    as:object <https://6a6b3224e294e60f3fd8c2da--willowy-kleicha-1afcb6.netlify.app/actor>.`)
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
        status: 200,
        text: () => Promise.resolve('')
      })

    await removeFromFollowers(
      'https://activitypub.academy/users/albilus_puhuss',
      mockFetch as SolidFetch,
      'https://example.com/',
      'https://6a6b3224e294e60f3fd8c2da--willowy-kleicha-1afcb6.netlify.app/actor'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    const patchBody = patchCall![1].body as string
    expect(patchBody).toContain('solid:deletes')
    expect(patchBody).toContain('https://activitypub.academy/users/albilus_puhuss/follow/1785410321943')
  })
})

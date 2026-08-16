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

  it('should patch followers page to remove the actor items triple', async () => {
    const { removeFromFollowers } = await import('../../src/services/removeFromFollowers.js')
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

    await removeFromFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    const patchBody = patchCall![1].body as string
    expect(patchBody).toContain('solid:deletes')
    expect(patchBody).not.toContain('solid:inserts')
    expect(patchBody).toMatch(/as:items\s+<https:\/\/other\.example\/actor>/)
  })

  it('should use correct followers URL', async () => {
    const { removeFromFollowers } = await import('../../src/services/removeFromFollowers.js')
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

    await removeFromFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const followersCall = mockFetch.mock.calls.find(call =>
      (call[0] as string).includes('followers')
    )
    expect(followersCall).toBeDefined()
    expect((followersCall![0] as string)).toBe('https://example.com/actor/followers/')
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
        text: () => Promise.resolve(`<https://example.com/actor/followers/pages/1785063320555> <https://www.w3.org/ns/activitystreams#items> <https://other.example/actor>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    expect(patchCall![0] as string).toBe('https://example.com/actor/followers/pages/1785063320555')
  })

  it('should handle multi-line Turtle format', async () => {
    const { removeFromFollowers } = await import('../../src/services/removeFromFollowers.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<> <https://www.w3.org/ns/activitystreams#first> <https://example.com/alice/followers/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#>.

<> a as:OrderedCollectionPage;
    as:partOf <../>;
    as:items <https://activitypub.academy/users/albilus_puhuss>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromFollowers(
      'https://activitypub.academy/users/albilus_puhuss',
      mockFetch as SolidFetch,
      'https://example.com/',
      'alice'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    const patchBody = patchCall![1].body as string
    expect(patchBody).toContain('solid:deletes')
    expect(patchBody).toMatch(/as:items\s+<https:\/\/activitypub\.academy\/users\/albilus_puhuss>/)
  })

  it('should find actor on second page when not on first page', async () => {
    const { removeFromFollowers } = await import('../../src/services/removeFromFollowers.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/followers/pages/1>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#>.

<> a as:OrderedCollectionPage;
    as:partOf <../>;
    as:next <https://example.com/actor/followers/pages/2>;
    as:items <https://other.example/actor>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#>.

<> a as:OrderedCollectionPage;
    as:partOf <../>;
    as:next <https://example.com/actor/followers/pages/2>;
    as:items <https://other.example/actor>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#>.

<> a as:OrderedCollectionPage;
    as:partOf <../>;
    as:items <https://activitypub.academy/users/albilus_puhuss>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromFollowers(
      'https://activitypub.academy/users/albilus_puhuss',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    expect(patchCall![0] as string).toBe('https://example.com/actor/followers/pages/2')
  })

  it('should patch the followers root to decrement totalItems after a successful remove', async () => {
    const { removeFromFollowers } = await import('../../src/services/removeFromFollowers.js')
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
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
<https://example.com/actor/followers/> as:totalItems "2" .
`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const patches = mockFetch.mock.calls.filter(call => call[1]?.method === 'PATCH')
    const rootPatch = patches.find(p => (p[0] as string) === 'https://example.com/actor/followers/')
    expect(rootPatch).toBeDefined()
    const body = rootPatch![1].body as string
    expect(body).toContain('totalItems')
    expect(body).toContain('"2"')
    expect(body).toContain('"1"')
  })

  it('should not decrement below 0', async () => {
    const { removeFromFollowers } = await import('../../src/services/removeFromFollowers.js')
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
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
<https://example.com/actor/followers/> as:totalItems "1" .
`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const patches = mockFetch.mock.calls.filter(call => call[1]?.method === 'PATCH')
    const rootPatch = patches.find(p => (p[0] as string) === 'https://example.com/actor/followers/')
    expect(rootPatch).toBeDefined()
    const body = rootPatch![1].body as string
    expect(body).toContain('"1"')
    expect(body).toContain('"0"')
  })

  it('should still remove successfully when the root GET fails', async () => {
    const { removeFromFollowers } = await import('../../src/services/removeFromFollowers.js')
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
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('server error')
      })

    await expect(removeFromFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )).resolves.toBeUndefined()

    const patches = mockFetch.mock.calls.filter(call => call[1]?.method === 'PATCH')
    const rootPatch = patches.find(p => (p[0] as string) === 'https://example.com/actor/followers/')
    expect(rootPatch).toBeUndefined()
  })
})

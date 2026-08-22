import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const cases = [
  {
    name: 'followers' as const,
    collection: 'followers' as const,
    item: 'https://other.example/actor',
    differentItem: 'https://different.example/actor'
  },
  {
    name: 'following' as const,
    collection: 'following' as const,
    item: 'https://other.example/actor',
    differentItem: 'https://different.example/actor'
  }
]

describe.each(cases)('removeFromCollection ($name)', ({ collection, item, differentItem }) => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function rootUrl(): string {
    return `https://example.com/actor/${collection}/`
  }

  function metaUrl(): string {
    return `https://example.com/actor/${collection}/.meta`
  }

  it(`patches the ${collection} page to remove the actor items triple`, async () => {
    const { removeFromCollection } = await import('../../src/services/collection.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<${rootUrl()}> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/${collection}/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/${collection}/pages/123> <https://www.w3.org/ns/activitystreams#items> <${item}>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromCollection(
      collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    const patchBody = patchCall![1].body as string
    expect(patchBody).toContain('solid:deletes')
    expect(patchBody).not.toContain('solid:inserts')
    expect(patchBody).toMatch(new RegExp(`as:items\\s+<${item.replace(/\//g, '\\/')}>`))
  })

  it(`uses the ${collection} URL for the per-actor container`, async () => {
    const { removeFromCollection } = await import('../../src/services/collection.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<${rootUrl()}> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/${collection}/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/${collection}/pages/123> <https://www.w3.org/ns/activitystreams#items> <${item}>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromCollection(
      collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor'
    )

    const collectionCall = mockFetch.mock.calls.find(call =>
      (call[0] as string).includes(collection) &&
      !(call[0] as string).includes('pages')
    )
    expect(collectionCall).toBeDefined()
    expect((collectionCall![0] as string)).toBe(rootUrl())
  })

  it(`throws when the entry is not found in any page`, async () => {
    const { removeFromCollection } = await import('../../src/services/collection.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<${rootUrl()}> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/${collection}/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/${collection}/pages/123> <https://www.w3.org/ns/activitystreams#items> <${differentItem}>.`)
      })

    await expect(removeFromCollection(
      collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor'
    )).rejects.toThrow()
  })

  it(`finds and removes the entry on the second page`, async () => {
    const { removeFromCollection } = await import('../../src/services/collection.js')
    const page1Turtle = `@prefix as: <https://www.w3.org/ns/activitystreams#>.

<> a as:OrderedCollectionPage;
    as:partOf <../>;
    as:next <https://example.com/actor/${collection}/pages/2>;
    as:items <${differentItem}>.`
    const page2Turtle = `@prefix as: <https://www.w3.org/ns/activitystreams#>.

<> a as:OrderedCollectionPage;
    as:partOf <../>;
    as:items <${item}>.`
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/${collection}/pages/1>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(page1Turtle)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(page1Turtle)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(page2Turtle)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromCollection(
      collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    expect(patchCall![0] as string).toBe(`https://example.com/actor/${collection}/pages/2`)
  })

  it(`patches the ${collection} meta resource to decrement totalItems after a successful remove`, async () => {
    const { removeFromCollection } = await import('../../src/services/collection.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<${rootUrl()}> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/${collection}/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/${collection}/pages/123> <https://www.w3.org/ns/activitystreams#items> <${item}>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
<${rootUrl()}> as:totalItems "2" .
`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ link: `<${metaUrl()}>; rel="describedby"` })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromCollection(
      collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor'
    )

    const patches = mockFetch.mock.calls.filter(call => call[1]?.method === 'PATCH')
    const rootPatch = patches.find(p => (p[0] as string) === metaUrl())
    expect(rootPatch).toBeDefined()
    const body = rootPatch![1].body as string
    expect(body).toContain('totalItems')
    expect(body).toContain('"2"')
    expect(body).toContain('"1"')
  })

  it(`does not PATCH the ${collection} container URL directly`, async () => {
    const { removeFromCollection } = await import('../../src/services/collection.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<${rootUrl()}> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/${collection}/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/${collection}/pages/123> <https://www.w3.org/ns/activitystreams#items> <${item}>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
<${rootUrl()}> as:totalItems "2" .
`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ link: `<${metaUrl()}>; rel="describedby"` })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromCollection(
      collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor'
    )

    const patches = mockFetch.mock.calls.filter(call => call[1]?.method === 'PATCH')
    const directPatch = patches.find(p => (p[0] as string) === rootUrl())
    expect(directPatch).toBeUndefined()
  })

  it(`does not decrement below 0`, async () => {
    const { removeFromCollection } = await import('../../src/services/collection.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<${rootUrl()}> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/${collection}/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/${collection}/pages/123> <https://www.w3.org/ns/activitystreams#items> <${item}>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
<${rootUrl()}> as:totalItems "1" .
`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ link: `<${metaUrl()}>; rel="describedby"` })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromCollection(
      collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor'
    )

    const patches = mockFetch.mock.calls.filter(call => call[1]?.method === 'PATCH')
    const rootPatch = patches.find(p => (p[0] as string) === metaUrl())
    expect(rootPatch).toBeDefined()
    const body = rootPatch![1].body as string
    expect(body).toContain('"1"')
    expect(body).toContain('"0"')
  })

  it('handles relative URLs in the first page link', async () => {
    const { removeFromCollection } = await import('../../src/services/collection.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<> <https://www.w3.org/ns/activitystreams#first> <pages/1785063320555>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/${collection}/pages/1785063320555> <https://www.w3.org/ns/activitystreams#items> <${item}>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromCollection(
      collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    expect(patchCall![0] as string).toBe(`https://example.com/actor/${collection}/pages/1785063320555`)
  })

  it('handles multi-line Turtle format with as:partOf', async () => {
    const { removeFromCollection } = await import('../../src/services/collection.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<> <https://www.w3.org/ns/activitystreams#first> <https://example.com/alice/${collection}/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .

<> a as:OrderedCollectionPage;
    as:partOf <../>;
    as:items <${item}>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromCollection(
      collection, item, mockFetch as SolidFetch, 'https://example.com/', 'alice'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    const patchBody = patchCall![1].body as string
    expect(patchBody).toContain('solid:deletes')
    expect(patchBody).toMatch(new RegExp(`as:items\\s+<${item.replace(/\//g, '\\/')}>`))
  })

  it('still removes successfully when the root GET fails', async () => {
    const { removeFromCollection } = await import('../../src/services/collection.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<${rootUrl()}> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/${collection}/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/${collection}/pages/123> <https://www.w3.org/ns/activitystreams#items> <${item}>.`)
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

    await expect(removeFromCollection(
      collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor'
    )).resolves.toBeUndefined()

    const patches = mockFetch.mock.calls.filter(call => call[1]?.method === 'PATCH')
    const directPatch = patches.find(p => (p[0] as string) === rootUrl())
    expect(directPatch).toBeUndefined()
  })
})
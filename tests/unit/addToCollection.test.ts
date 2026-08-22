import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const cases = [
  {
    name: 'followers' as const,
    collection: 'followers' as const,
    item: 'https://other.example/actor'
  },
  {
    name: 'following' as const,
    collection: 'following' as const,
    item: 'https://other.example/actor'
  }
]

describe.each(cases)('addToCollection ($name)', ({ collection, item }) => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.fn()
  })

  function collectionRoot(): string {
    return `https://example.com/actor/${collection}/`
  }

  function metaUrl(): string {
    return `https://example.com/actor/${collection}/.meta`
  }

  it(`derives page URL for the ${collection} collection`, async () => {
    const { addToCollection } = await import('../../src/services/collection.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: `<${metaUrl()}>; rel="describedby"` })
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToCollection(collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor')

    expect(mockFetch).toHaveBeenCalled()
  })

  it(`patches the ${collection} page to add actor as an as:items triple`, async () => {
    const { addToCollection } = await import('../../src/services/collection.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: `<${metaUrl()}>; rel="describedby"` })
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToCollection(collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor')

    const pagePatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      !(call[0] as string).endsWith('.meta')
    )
    expect(pagePatch).toBeDefined()
    const patchBody = pagePatch![1].body as string
    expect(patchBody).toContain(item)
    expect(patchBody).toMatch(new RegExp(`as:items\\s+<${item.replace(/\//g, '\\/')}>`))
  })

  it(`uses the correct ${collection} URL for the per-actor container`, async () => {
    const { addToCollection } = await import('../../src/services/collection.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: `<${metaUrl()}>; rel="describedby"` })
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToCollection(collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor')

    const derivePageUrlCall = mockFetch.mock.calls.find(call =>
      (call[0] as string).includes(collection) &&
      call[1]?.method !== 'HEAD'
    )
    expect(derivePageUrlCall).toBeDefined()
    expect((derivePageUrlCall![0] as string)).toBe(collectionRoot())
  })

  it(`patches the ${collection} meta resource to set totalItems=1 on first add`, async () => {
    const { addToCollection } = await import('../../src/services/collection.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === collectionRoot() && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: `<${metaUrl()}>; rel="describedby"` })
        }
      }
      if (url === collectionRoot()) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(``)
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToCollection(collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor')

    const rootPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === metaUrl() &&
      (call[1]?.headers as Record<string, string> | undefined)?.['content-type'] === 'text/n3'
    )
    expect(rootPatch).toBeDefined()
    const body = rootPatch![1].body as string
    expect(body).toContain('totalItems')
    expect(body).toContain('"1"')
  })

  it(`does not PATCH the ${collection} container URL directly`, async () => {
    const { addToCollection } = await import('../../src/services/collection.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === collectionRoot() && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: `<${metaUrl()}>; rel="describedby"` })
        }
      }
      if (url === collectionRoot()) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(``)
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToCollection(collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor')

    const directPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === collectionRoot()
    )
    expect(directPatch).toBeUndefined()
  })

  it(`HEADs the ${collection} root to discover the meta resource before PATCHing`, async () => {
    const { addToCollection } = await import('../../src/services/collection.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === collectionRoot() && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: `<${metaUrl()}>; rel="describedby"` })
        }
      }
      if (url === collectionRoot()) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(``)
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToCollection(collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor')

    const headCall = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'HEAD' &&
      (call[0] as string) === collectionRoot()
    )
    expect(headCall).toBeDefined()
  })

  it(`falls back to <container>.meta when the Link header is absent`, async () => {
    const { addToCollection } = await import('../../src/services/collection.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === collectionRoot() && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers()
        }
      }
      if (url === collectionRoot()) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(``)
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToCollection(collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor')

    const rootPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === metaUrl()
    )
    expect(rootPatch).toBeDefined()
  })

  it(`increments totalItems when root already has totalItems=5`, async () => {
    const { addToCollection } = await import('../../src/services/collection.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === collectionRoot() && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: `<${metaUrl()}>; rel="describedby"` })
        }
      }
      if (url === collectionRoot()) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
<${collectionRoot()}> as:totalItems "5" .
`)
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToCollection(collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor')

    const rootPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === metaUrl() &&
      (call[1]?.headers as Record<string, string> | undefined)?.['content-type'] === 'text/n3'
    )
    expect(rootPatch).toBeDefined()
    const body = rootPatch![1].body as string
    expect(body).toContain('"5"')
    expect(body).toContain('"6"')
  })

  it(`does not patch the root if the page PATCH fails`, async () => {
    const { addToCollection } = await import('../../src/services/collection.js')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('server error')
    })

    await expect(addToCollection(
      collection, item, mockFetch as SolidFetch, 'https://example.com/', 'actor'
    )).rejects.toThrow()

    const rootPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === collectionRoot()
    )
    expect(rootPatch).toBeUndefined()
  })
})
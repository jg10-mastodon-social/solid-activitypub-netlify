import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const cases = [
  {
    name: 'followers' as const,
    collection: 'followers' as const,
    firstActor: 'follower1',
    secondActor: 'follower2'
  },
  {
    name: 'following' as const,
    collection: 'following' as const,
    firstActor: 'followed1',
    secondActor: 'followed2'
  }
]

describe.each(cases)('getCollection ($name)', ({ collection, firstActor, secondActor }) => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`fetches ${collection} from collection first page`, async () => {
    const { getCollection } = await import('../../src/services/collection.js')

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      const rootUrl = `https://example.com/storage/actor/${collection}/`
      const page1Url = `https://example.com/storage/actor/${collection}/pages/1`
      if (url === rootUrl) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<${rootUrl}>
  a as:OrderedCollection ;
  as:first <${page1Url}> .
`)
        }
      }
      if (url === page1Url) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<${page1Url}>
  a as:OrderedCollectionPage ;
  as:items <https://${firstActor}.example/actor> .
`)
        }
      }
      throw new Error('Unexpected URL: ' + url)
    })

    const items = await getCollection(collection, 'https://example.com/storage/', 'actor', mockFetch)
    expect(items).toEqual([`https://${firstActor}.example/actor`])
  })

  it(`iterates through multiple ${collection} pages via next links`, async () => {
    const { getCollection } = await import('../../src/services/collection.js')

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      const rootUrl = `https://example.com/storage/actor/${collection}/`
      const page1Url = `https://example.com/storage/actor/${collection}/pages/1`
      const page2Url = `https://example.com/storage/actor/${collection}/pages/2`
      if (url === rootUrl) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<${rootUrl}>
  a as:OrderedCollection ;
  as:first <${page1Url}> .
`)
        }
      }
      if (url === page1Url) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<${page1Url}>
  a as:OrderedCollectionPage ;
  as:next <${page2Url}> ;
  as:items <https://${firstActor}.example/actor> .
`)
        }
      }
      if (url === page2Url) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<${page2Url}>
  a as:OrderedCollectionPage ;
  as:items <https://${secondActor}.example/actor> .
`)
        }
      }
      throw new Error('Unexpected URL')
    })

    const items = await getCollection(collection, 'https://example.com/storage/', 'actor', mockFetch)
    expect(items).toContain(`https://${firstActor}.example/actor`)
    expect(items).toContain(`https://${secondActor}.example/actor`)
    expect(items.length).toBe(2)
  })

  it(`returns empty array when ${collection} page has no items`, async () => {
    const { getCollection } = await import('../../src/services/collection.js')

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      const rootUrl = `https://example.com/storage/actor/${collection}/`
      const page1Url = `https://example.com/storage/actor/${collection}/pages/1`
      if (url === rootUrl) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<${rootUrl}>
  a as:OrderedCollection ;
  as:first <${page1Url}> .
`)
        }
      }
      if (url === page1Url) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<${page1Url}>
  a as:OrderedCollectionPage .
`)
        }
      }
      throw new Error('Unexpected URL: ' + url)
    })

    const items = await getCollection(collection, 'https://example.com/storage/', 'actor', mockFetch)
    expect(items).toEqual([])
  })

  it(`extracts multiple actor URIs from a single ${collection} page`, async () => {
    const { getCollection } = await import('../../src/services/collection.js')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/${collection}/>
  a as:OrderedCollection ;
  as:first <https://example.com/storage/actor/${collection}/pages/1> .

<https://example.com/storage/actor/${collection}/pages/1>
  a as:OrderedCollectionPage ;
  as:items <https://${firstActor}.example/actor> ,
           <https://${secondActor}.example/actor> .
`)
    })

    const items = await getCollection(collection, 'https://example.com/storage/', 'actor', mockFetch)
    expect(items.length).toBe(2)
    expect(items).toContain(`https://${firstActor}.example/actor`)
    expect(items).toContain(`https://${secondActor}.example/actor`)
  })

  it(`returns empty array when ${collection} collection fetch fails`, async () => {
    const { getCollection } = await import('../../src/services/collection.js')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    })

    const items = await getCollection(collection, 'https://example.com/storage/', 'actor', mockFetch)
    expect(items).toEqual([])
  })
})
import { describe, it, expect, vi } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const cases = [
  {
    name: 'followers' as const,
    collection: 'followers' as const,
    podPageUrl: 'https://pod.example/alice/followers/pages/1',
    podRootUrl: 'https://pod.example/alice/followers/',
    publicRootUrl: 'https://app.example/alice/followers'
  },
  {
    name: 'following' as const,
    collection: 'following' as const,
    podPageUrl: 'https://pod.example/alice/following/pages/1',
    podRootUrl: 'https://pod.example/alice/following/',
    publicRootUrl: 'https://app.example/alice/following'
  }
]

describe.each(cases)('serializePage ($name)', ({ collection, podPageUrl, podRootUrl, publicRootUrl }) => {
  it('returns an OrderedCollectionPage AS2 JSON document', async () => {
    const { serializePage } = await import('../../src/services/collection.js')
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .

<${podPageUrl}>
  a as:OrderedCollectionPage ;
  as:partOf <${podRootUrl}> ;
  as:items <https://bob.example/bob> ,
           <https://carol.example/carol> ;
  as:next <${podPageUrl.replace('1', '2')}> .
`),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializePage(collection, fetchFn, podPageUrl, podRootUrl, publicRootUrl)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/activity+json')
    const body = await res.json() as Record<string, unknown>
    expect(body['@context']).toBe('https://www.w3.org/ns/activitystreams')
    expect(body.id).toBe(`${publicRootUrl}/pages/1`)
    expect(body.type).toBe('OrderedCollectionPage')
    expect(body.partOf).toBe(publicRootUrl)
    expect(body.orderedItems).toEqual(['https://bob.example/bob', 'https://carol.example/carol'])
    expect(body.next).toBe(`${publicRootUrl}/pages/2`)
  })

  it('omits next when the page has no as:next', async () => {
    const { serializePage } = await import('../../src/services/collection.js')
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .

<${podPageUrl}>
  a as:OrderedCollectionPage ;
  as:partOf <${podRootUrl}> ;
  as:items <https://bob.example/bob> .
`),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializePage(collection, fetchFn, podPageUrl, podRootUrl, publicRootUrl)

    const body = await res.json() as Record<string, unknown>
    expect('next' in body).toBe(false)
  })

  it('returns empty orderedItems when page has no as:items', async () => {
    const { serializePage } = await import('../../src/services/collection.js')
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .

<${podPageUrl}>
  a as:OrderedCollectionPage ;
  as:partOf <${podRootUrl}> .
`),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializePage(collection, fetchFn, podPageUrl, podRootUrl, publicRootUrl)

    const body = await res.json() as Record<string, unknown>
    expect(body.orderedItems).toEqual([])
  })
})
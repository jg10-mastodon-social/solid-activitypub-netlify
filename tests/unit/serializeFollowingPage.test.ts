import { describe, it, expect, vi } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

describe('serializeFollowingPage', () => {
  it('returns an OrderedCollectionPage AS2 JSON document', async () => {
    const { serializeFollowingPage } = await import('../../src/services/serializeFollowingPage.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://pod.example/alice/following/pages/1>
  a as:OrderedCollectionPage ;
  as:partOf <https://pod.example/alice/following/> ;
  as:items <https://bob.example/bob> ,
           <https://carol.example/carol> ;
  as:next <https://pod.example/alice/following/pages/2> .
`),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializeFollowingPage(
      fetchFn,
      'https://pod.example/alice/following/pages/1',
      'https://pod.example/alice/following/',
      'https://app.example/alice/following'
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/activity+json')
    const body = await res.json() as Record<string, unknown>
    expect(body['@context']).toBe('https://www.w3.org/ns/activitystreams')
    expect(body.id).toBe('https://app.example/alice/following/pages/1')
    expect(body.type).toBe('OrderedCollectionPage')
    expect(body.partOf).toBe('https://app.example/alice/following')
    expect(body.orderedItems).toEqual(['https://bob.example/bob', 'https://carol.example/carol'])
    expect(body.next).toBe('https://app.example/alice/following/pages/2')
  })

  it('omits next when the page has no as:next', async () => {
    const { serializeFollowingPage } = await import('../../src/services/serializeFollowingPage.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://pod.example/alice/following/pages/1>
  a as:OrderedCollectionPage ;
  as:partOf <https://pod.example/alice/following/> ;
  as:items <https://bob.example/bob> .
`),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializeFollowingPage(
      fetchFn,
      'https://pod.example/alice/following/pages/1',
      'https://pod.example/alice/following/',
      'https://app.example/alice/following'
    )

    const body = await res.json() as Record<string, unknown>
    expect('next' in body).toBe(false)
  })

  it('returns empty orderedItems when page has no as:items', async () => {
    const { serializeFollowingPage } = await import('../../src/services/serializeFollowingPage.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://pod.example/alice/following/pages/1>
  a as:OrderedCollectionPage ;
  as:partOf <https://pod.example/alice/following/> .
`),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializeFollowingPage(
      fetchFn,
      'https://pod.example/alice/following/pages/1',
      'https://pod.example/alice/following/',
      'https://app.example/alice/following'
    )

    const body = await res.json() as Record<string, unknown>
    expect(body.orderedItems).toEqual([])
  })
})

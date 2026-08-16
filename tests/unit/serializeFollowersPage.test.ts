import { describe, it, expect, vi } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

describe('serializeFollowersPage', () => {
  it('returns an OrderedCollectionPage AS2 JSON document', async () => {
    const { serializeFollowersPage } = await import('../../src/services/serializeFollowersPage.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://pod.example/alice/followers/pages/1>
  a as:OrderedCollectionPage ;
  as:partOf <https://pod.example/alice/followers/> ;
  as:items <https://bob.example/bob> ,
           <https://carol.example/carol> ;
  as:next <https://pod.example/alice/followers/pages/2> .
`),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializeFollowersPage(
      fetchFn,
      'https://pod.example/alice/followers/pages/1',
      'https://pod.example/alice/followers/',
      'https://app.example/alice/followers'
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/activity+json')
    const body = await res.json() as Record<string, unknown>
    expect(body['@context']).toBe('https://www.w3.org/ns/activitystreams')
    expect(body.id).toBe('https://app.example/alice/followers/pages/1')
    expect(body.type).toBe('OrderedCollectionPage')
    expect(body.partOf).toBe('https://app.example/alice/followers')
    expect(body.orderedItems).toEqual(['https://bob.example/bob', 'https://carol.example/carol'])
    expect(body.next).toBe('https://app.example/alice/followers/pages/2')
  })

  it('omits next when the page has no as:next', async () => {
    const { serializeFollowersPage } = await import('../../src/services/serializeFollowersPage.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://pod.example/alice/followers/pages/1>
  a as:OrderedCollectionPage ;
  as:partOf <https://pod.example/alice/followers/> ;
  as:items <https://bob.example/bob> .
`),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializeFollowersPage(
      fetchFn,
      'https://pod.example/alice/followers/pages/1',
      'https://pod.example/alice/followers/',
      'https://app.example/alice/followers'
    )

    const body = await res.json() as Record<string, unknown>
    expect('next' in body).toBe(false)
  })

  it('returns empty orderedItems when page has no as:items', async () => {
    const { serializeFollowersPage } = await import('../../src/services/serializeFollowersPage.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://pod.example/alice/followers/pages/1>
  a as:OrderedCollectionPage ;
  as:partOf <https://pod.example/alice/followers/> .
`),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializeFollowersPage(
      fetchFn,
      'https://pod.example/alice/followers/pages/1',
      'https://pod.example/alice/followers/',
      'https://app.example/alice/followers'
    )

    const body = await res.json() as Record<string, unknown>
    expect(body.orderedItems).toEqual([])
  })
})
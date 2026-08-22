import { describe, it, expect, vi } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const cases = [
  {
    name: 'followers' as const,
    collection: 'followers' as const,
    podRootUrl: 'https://pod.example/alice/followers/',
    publicRootUrl: 'https://app.example/alice/followers'
  },
  {
    name: 'following' as const,
    collection: 'following' as const,
    podRootUrl: 'https://pod.example/alice/following/',
    publicRootUrl: 'https://app.example/alice/following'
  }
]

describe.each(cases)('serializeCollection ($name)', ({ collection, podRootUrl, publicRootUrl }) => {
  it('returns an OrderedCollection AS2 JSON document', async () => {
    const { serializeCollection } = await import('../../src/services/collection.js')
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${podRootUrl}>
  a as:OrderedCollection ;
  as:first <${podRootUrl}pages/1> ;
  as:totalItems "3"^^xsd:nonNegativeInteger .
`),
      headers: new Headers({ 'content-type': 'text/turtle' })
    } as unknown as Response)

    const res = await serializeCollection(collection, fetchFn, podRootUrl, publicRootUrl)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/activity+json')
    const body = await res.json() as Record<string, unknown>
    expect(body['@context']).toBe('https://www.w3.org/ns/activitystreams')
    expect(body.id).toBe(publicRootUrl)
    expect(body.type).toBe('OrderedCollection')
    expect(body.totalItems).toBe(3)
    expect(body.first).toBe(`${publicRootUrl}/pages/1`)
  })

  it('fetches the pod root with text/turtle Accept', async () => {
    const { serializeCollection } = await import('../../src/services/collection.js')
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
      headers: new Headers()
    } as unknown as Response)

    await serializeCollection(collection, fetchFn, podRootUrl, publicRootUrl)

    expect(fetchFn).toHaveBeenCalledTimes(1)
    const call = fetchFn.mock.calls[0]
    expect(call[0]).toBe(podRootUrl)
    const init = call[1]
    expect(init?.headers).toEqual(expect.objectContaining({ accept: 'text/turtle' }))
  })

  it('returns totalItems: 0 when root has no totalItems triple', async () => {
    const { serializeCollection } = await import('../../src/services/collection.js')
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .

<${podRootUrl}>
  a as:OrderedCollection ;
  as:first <${podRootUrl}pages/1> .
`),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializeCollection(collection, fetchFn, podRootUrl, publicRootUrl)

    const body = await res.json() as Record<string, unknown>
    expect(body.totalItems).toBe(0)
  })

  it('omits first when root has no first triple', async () => {
    const { serializeCollection } = await import('../../src/services/collection.js')
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializeCollection(collection, fetchFn, podRootUrl, publicRootUrl)

    const body = await res.json() as Record<string, unknown>
    expect('first' in body).toBe(false)
  })
})
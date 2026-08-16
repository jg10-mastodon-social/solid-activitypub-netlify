import { describe, it, expect } from 'vitest'

describe('parseFollowersRoot', () => {
  it('parses as:first and as:totalItems from a followers collection root', async () => {
    const { parseFollowersRoot } = await import('../../src/services/rdfUtils.js')
    const turtle = `@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<https://example.com/alice/followers/>
  a as:OrderedCollection ;
  as:first <https://example.com/alice/followers/pages/1> ;
  as:totalItems "3"^^xsd:nonNegativeInteger .
`
    const result = await parseFollowersRoot(turtle, 'https://example.com/alice/followers/')
    expect(result).not.toBeNull()
    expect(result!.first).toBe('https://example.com/alice/followers/pages/1')
    expect(result!.totalItems).toBe(3)
  })

  it('returns totalItems: undefined when the root has no totalItems triple', async () => {
    const { parseFollowersRoot } = await import('../../src/services/rdfUtils.js')
    const turtle = `@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/alice/followers/>
  a as:OrderedCollection ;
  as:first <https://example.com/alice/followers/pages/1> .
`
    const result = await parseFollowersRoot(turtle, 'https://example.com/alice/followers/')
    expect(result).not.toBeNull()
    expect(result!.first).toBe('https://example.com/alice/followers/pages/1')
    expect(result!.totalItems).toBeUndefined()
  })

  it('returns first: undefined when the root has no first triple', async () => {
    const { parseFollowersRoot } = await import('../../src/services/rdfUtils.js')
    const turtle = `@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/alice/followers/>
  a as:OrderedCollection .
`
    const result = await parseFollowersRoot(turtle, 'https://example.com/alice/followers/')
    expect(result).not.toBeNull()
    expect(result!.first).toBeUndefined()
    expect(result!.totalItems).toBeUndefined()
  })
})
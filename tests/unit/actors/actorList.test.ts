import { describe, it, expect } from 'vitest'
import type { ActorRecord } from '../../../src/actors/registry.js'
import { serializeActorList } from '../../../src/actors/actorList.js'

function actor(name: string, disabled = false): ActorRecord {
  return {
    name,
    publicKeyJwk: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    disabled
  }
}

const baseUrl = 'https://example.com'

describe('serializeActorList', () => {
  it('serializes enabled actors as a sorted ActivityStreams collection', () => {
    const turtle = serializeActorList(
      [actor('carol'), actor('alice'), actor('bob', true), actor('dave')],
      baseUrl
    )

    expect(turtle).toContain('@prefix as: <https://www.w3.org/ns/activitystreams>')
    expect(turtle).toContain(`<${baseUrl}/actors> a as:Collection`)
    expect(turtle).toContain('as:totalItems 3')
    expect(turtle).toContain(
      `as:items <${baseUrl}/alice>, <${baseUrl}/carol>, <${baseUrl}/dave>`
    )
    expect(turtle).not.toContain(`${baseUrl}/bob`)
    expect(turtle.endsWith('\n')).toBe(true)
  })

  it('omits as:items when there are no enabled actors', () => {
    const turtle = serializeActorList([actor('bob', true)], baseUrl)

    expect(turtle).toContain('as:totalItems 0')
    expect(turtle).not.toContain('as:items')
  })

  it('omits as:items for an empty registry', () => {
    const turtle = serializeActorList([], baseUrl)

    expect(turtle).toContain('as:totalItems 0')
    expect(turtle).not.toContain('as:items')
  })
})

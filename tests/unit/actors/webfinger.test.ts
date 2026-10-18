import { describe, it, expect } from 'vitest'
import type { ActorRecord, ActorRegistry } from '../../../src/actors/registry.js'
import { resolveWebFinger } from '../../../src/actors/webfinger.js'

const BASE_URL = 'https://example.netlify.app'

function makeActor(name: string, disabled = false): ActorRecord {
  return {
    name,
    publicKeyJwk: { kty: 'EC', crv: 'P-256' },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    disabled
  }
}

function makeRegistry(records: ActorRecord[]): ActorRegistry {
  return {
    getActor: async (name: string) => records.find((record) => record.name === name) ?? null
  } as unknown as ActorRegistry
}

describe('resolveWebFinger', () => {
  it('resolves an acct resource for a known actor', async () => {
    const registry = makeRegistry([makeActor('alice')])

    const entry = await resolveWebFinger('acct:alice@example.netlify.app', BASE_URL, registry)

    expect(entry).toEqual({
      subject: 'acct:alice@example.netlify.app',
      aliases: [`${BASE_URL}/alice`],
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: `${BASE_URL}/alice`
        }
      ]
    })
  })

  it('returns null for an unknown actor', async () => {
    const registry = makeRegistry([makeActor('alice')])

    expect(await resolveWebFinger('acct:bob@example.netlify.app', BASE_URL, registry)).toBeNull()
  })

  it('returns null for a disabled actor', async () => {
    const registry = makeRegistry([makeActor('alice', true)])

    expect(await resolveWebFinger('acct:alice@example.netlify.app', BASE_URL, registry)).toBeNull()
  })

  it('returns null when the domain does not match the base url', async () => {
    const registry = makeRegistry([makeActor('alice')])

    expect(await resolveWebFinger('acct:alice@other.example.com', BASE_URL, registry)).toBeNull()
  })

  it('returns null for malformed resources', async () => {
    const registry = makeRegistry([makeActor('alice')])

    expect(await resolveWebFinger('', BASE_URL, registry)).toBeNull()
    expect(await resolveWebFinger('alice@example.netlify.app', BASE_URL, registry)).toBeNull()
    expect(await resolveWebFinger('acct:', BASE_URL, registry)).toBeNull()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity, ActivityRecipient } from '../../src/activity.js'

vi.mock('../../src/base-url.js', () => ({
  baseUrl: 'https://example.com'
}))

const mockActorKeys = {
  actor: {
    kty: 'RSA',
    e: 'AQAB',
    n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    d: 'X4cTteJY_gn4FYPsXB8rdXix5vwsg1FLN5E3EaG6RJoVH-HLLKD9M7dx5oo7GURknchnrRweUkC7hT5fJLM0WbFAKNLWY2vv7B6NqXSzUvxT0_YSfqijwp3RTzlBaCxWp4doF5SXA5uL3NaK3DAZ-V5-K5XqAvLD5VYr7cVvP7xVcwD5JmcPWNfGVaJrKdl80G9CsKy8-kzIKyN6Ej2FD8Lg2xjvBuKiLQVcT2w9hV3CkBvxLJPc5Md4yJ2cS3C0M2D2t5vOgV9V6K5a7lJqT1s9Y-K5V-5pL0b9RrT9M0cD0T5P4x0Q',
    p: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    q: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    dp: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    dq: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    qi: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    alg: 'RS256',
    kid: 'test-key-id'
  }
}

vi.mock('../../src/actor-keys.js', () => ({
  actorKeys: mockActorKeys
}))

const mockFetch = vi.fn()

describe('activity types', () => {
  it('should define Activity interface', () => {
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['https://example.com/recipient1'],
      object: { type: 'Note', content: 'Hello' }
    }
    expect(activity.type).toBe('Create')
    expect(activity.actor).toBe('https://example.com/actor')
  })
})

describe('extractRecipients', () => {
  it('should extract recipients from to field', async () => {
    const { extractRecipients } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['https://example.com/recipient1', 'https://example.com/recipient2']
    }
    const recipients = extractRecipients(activity)
    expect(recipients).toContain('https://example.com/recipient1')
    expect(recipients).toContain('https://example.com/recipient2')
    expect(recipients.length).toBe(2)
  })

  it('should extract recipients from cc field', async () => {
    const { extractRecipients } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      cc: ['https://example.com/cc-recipient']
    }
    const recipients = extractRecipients(activity)
    expect(recipients).toContain('https://example.com/cc-recipient')
  })

  it('should extract recipients from bto field', async () => {
    const { extractRecipients } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      bto: ['https://example.com/bto-recipient']
    }
    const recipients = extractRecipients(activity)
    expect(recipients).toContain('https://example.com/bto-recipient')
  })

  it('should extract recipients from bcc field', async () => {
    const { extractRecipients } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      bcc: ['https://example.com/bcc-recipient']
    }
    const recipients = extractRecipients(activity)
    expect(recipients).toContain('https://example.com/bcc-recipient')
  })

  it('should extract recipients from audience field', async () => {
    const { extractRecipients } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      audience: ['https://example.com/audience-member']
    }
    const recipients = extractRecipients(activity)
    expect(recipients).toContain('https://example.com/audience-member')
  })

  it('should exclude Public recipient', async () => {
    const { extractRecipients } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: [
        'https://www.w3.org/ns/activitystreams#Public',
        'https://example.com/recipient1'
      ]
    }
    const recipients = extractRecipients(activity)
    expect(recipients).not.toContain('https://www.w3.org/ns/activitystreams#Public')
    expect(recipients).toContain('https://example.com/recipient1')
    expect(recipients.length).toBe(1)
  })

  it('should exclude as:Public shorthand', async () => {
    const { extractRecipients } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['Public', 'https://example.com/recipient1']
    }
    const recipients = extractRecipients(activity)
    expect(recipients).not.toContain('Public')
    expect(recipients).toContain('https://example.com/recipient1')
  })

  it('should handle single string to field', async () => {
    const { extractRecipients } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: 'https://example.com/recipient1'
    }
    const recipients = extractRecipients(activity)
    expect(recipients).toContain('https://example.com/recipient1')
  })

  it('should deduplicate recipients', async () => {
    const { extractRecipients } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['https://example.com/recipient1'],
      cc: ['https://example.com/recipient1']
    }
    const recipients = extractRecipients(activity)
    expect(recipients.length).toBe(1)
  })

  it('should return empty array when no recipients', async () => {
    const { extractRecipients } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor'
    }
    const recipients = extractRecipients(activity)
    expect(recipients).toEqual([])
  })
})

describe('fetchActorInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch actor inbox from actor document', async () => {
    const { fetchActorInbox } = await import('../../src/activity.js')
    const mockFetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'https://other.example/actor',
        inbox: 'https://other.example/inbox'
      })
    })

    const inbox = await fetchActorInbox('https://other.example/actor', mockFetchFn)
    expect(inbox).toBe('https://other.example/inbox')
  })

  it('should throw error when actor fetch fails', async () => {
    const { fetchActorInbox } = await import('../../src/activity.js')
    const mockFetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 404
    })

    await expect(fetchActorInbox('https://other.example/actor', mockFetchFn))
      .rejects.toThrow('Failed to fetch actor document')
  })

  it('should throw error when inbox not found in actor document', async () => {
    const { fetchActorInbox } = await import('../../src/activity.js')
    const mockFetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'https://other.example/actor'
      })
    })

    await expect(fetchActorInbox('https://other.example/actor', mockFetchFn))
      .rejects.toThrow('Actor inbox not found')
  })

  it('should send a signed GET when a signer is provided', async () => {
    const { fetchActorInbox } = await import('../../src/activity.js')
    const mockFetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'https://other.example/actor',
        inbox: 'https://other.example/inbox'
      })
    })

    const inbox = await fetchActorInbox('https://other.example/actor', mockFetchFn, {
      keyId: 'https://example.com/actor#main-key',
      actorUrl: 'https://example.com/actor',
      baseUrl: 'https://example.com'
    })
    expect(inbox).toBe('https://other.example/inbox')
    expect(mockFetchFn).toHaveBeenCalledWith(
      'https://other.example/actor',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Signature': expect.stringMatching(/keyId="https:\/\/example\.com\/actor#main-key"/),
          'Date': expect.any(String),
          'Accept': expect.stringContaining('application/activity+json')
        })
      })
    )
    expect(mockFetchFn.mock.calls[0][1].headers['Digest']).toBeUndefined()
  })

  it('should report 401 via actorFetchStatus when the signed fetch is rejected', async () => {
    const { fetchActorInbox } = await import('../../src/activity.js')
    const mockFetchFn = vi.fn().mockResolvedValue({ ok: false, status: 401 })

    try {
      await fetchActorInbox('https://other.example/actor', mockFetchFn, {
        keyId: 'https://example.com/actor#main-key',
        actorUrl: 'https://example.com/actor',
        baseUrl: 'https://example.com'
      })
      throw new Error('expected throw')
    } catch (e) {
      expect((e as Error).message).toContain('Failed to fetch actor document')
      expect((e as Error & { actorFetchStatus?: number }).actorFetchStatus).toBe(401)
    }
  })

  it('should fall back to unsigned fetch when no signer is provided', async () => {
    const { fetchActorInbox } = await import('../../src/activity.js')
    const mockFetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'https://other.example/actor',
        inbox: 'https://other.example/inbox'
      })
    })

    await fetchActorInbox('https://other.example/actor', mockFetchFn)
    const headers = mockFetchFn.mock.calls[0][1].headers
    expect(headers['Signature']).toBeUndefined()
  })
})

describe('validateActivityActor', () => {
  it('should pass when activity.actor matches expected actor', async () => {
    const { validateActivityActor } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor'
    }
    const result = validateActivityActor(activity, 'https://example.com/actor')
    expect(result).toBe(true)
  })

  it('should throw when activity.actor does not match', async () => {
    const { validateActivityActor } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://other.example/actor'
    }
    expect(() => validateActivityActor(activity, 'https://example.com/actor'))
      .toThrow('Actor mismatch')
  })

  it('should throw when activity.actor is missing', async () => {
    const { validateActivityActor } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create'
    }
    expect(() => validateActivityActor(activity, 'https://example.com/actor'))
      .toThrow('Activity actor missing')
  })
})

describe('validateContext', () => {
  it('should pass when @context is present', async () => {
    const { validateContext } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }
    const result = validateContext(activity)
    expect(result).toBe(true)
  })

  it('should throw when @context is missing', async () => {
    const { validateContext } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor'
    }
    expect(() => validateContext(activity))
      .toThrow('Activity must include @context')
  })
})

describe('normalizeActivity', () => {
  it('should override existing id with generated id', async () => {
    const { normalizeActivity } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      id: 'https://example.com/activities/old-id',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }
    const normalized = normalizeActivity(activity)
    expect(normalized.id).toMatch(/^https:\/\/example\.com\/activities\/\d+$/)
    expect(normalized.id).not.toBe('https://example.com/activities/old-id')
  })

  it('should add published in ISO 8601 format if missing', async () => {
    const { normalizeActivity } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }
    const normalized = normalizeActivity(activity)
    expect(normalized.published).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
  })

  it('should preserve existing published if present', async () => {
    const { normalizeActivity } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      published: '2025-12-19T11:34:14.000Z',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }
    const normalized = normalizeActivity(activity)
    expect(normalized.published).toBe('2025-12-19T11:34:14.000Z')
  })

  it('should preserve all other activity properties', async () => {
    const { normalizeActivity } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['https://example.com/recipient'],
      object: { type: 'Note', content: 'Hello' },
      '@context': 'https://www.w3.org/ns/activitystreams'
    }
    const normalized = normalizeActivity(activity)
    expect(normalized.type).toBe('Create')
    expect(normalized.actor).toBe('https://example.com/actor')
    expect(normalized.to).toEqual(['https://example.com/recipient'])
    expect((normalized.object as any).type).toBe('Note')
    expect((normalized.object as any).content).toBe('Hello')
    expect((normalized.object as any).id).toMatch(/^https:\/\/example\.com\/actor\/status\/\d+$/)
    expect(normalized.id).toMatch(/^https:\/\/example\.com\/actor\/status\/\d+-activity$/)
  })

  it('should generate object id and derive activity id when object has no id', async () => {
    const { normalizeActivity } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams',
      object: { type: 'Note', content: 'Hello world' }
    }
    const normalized = normalizeActivity(activity)
    expect((normalized.object as any).id).toMatch(/^https:\/\/example\.com\/actor\/status\/\d+$/)
    expect(normalized.id).toBe(`${(normalized.object as any).id}-activity`)
  })

  it('should derive activity id from existing object id', async () => {
    const { normalizeActivity } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      id: 'https://example.com/activities/old-id',
      '@context': 'https://www.w3.org/ns/activitystreams',
      object: {
        type: 'Note',
        id: 'https://example.com/actor/status/existing-id',
        content: 'Hello'
      }
    }
    const normalized = normalizeActivity(activity)
    expect((normalized.object as any).id).toBe('https://example.com/actor/status/existing-id')
    expect(normalized.id).toBe('https://example.com/actor/status/existing-id-activity')
  })

  it('should not modify object when it is a string reference', async () => {
    const { normalizeActivity } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Delete',
      actor: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams',
      object: 'https://example.com/notes/123'
    }
    const normalized = normalizeActivity(activity)
    expect(normalized.object).toBe('https://example.com/notes/123')
    expect(normalized.id).toMatch(/^https:\/\/example\.com\/activities\/\d+$/)
  })

  it('should generate id for non-Note objects like Article', async () => {
    const { normalizeActivity } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams',
      object: { type: 'Article', name: 'My Article' }
    }
    const normalized = normalizeActivity(activity)
    expect((normalized.object as any).id).toMatch(/^https:\/\/example\.com\/actor\/status\/\d+$/)
    expect(normalized.id).toBe(`${(normalized.object as any).id}-activity`)
  })
})
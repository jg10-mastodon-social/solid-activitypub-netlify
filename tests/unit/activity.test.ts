import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity, ActivityRecipient } from '../../src/activity.js'

vi.mock('./base-url.js', () => ({
  baseUrl: 'https://example.com'
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
    expect(normalized.object).toEqual({ type: 'Note', content: 'Hello' })
  })
})
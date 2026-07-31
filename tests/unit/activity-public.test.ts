import { describe, it, expect } from 'vitest'
import type { Activity } from '../../src/activity.js'

describe('isActivityPublic', () => {
  it('returns true when to contains Public', async () => {
    const { isActivityPublic } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['Public']
    }
    expect(isActivityPublic(activity)).toBe(true)
  })

  it('returns true when to contains PUBLIC_IRI', async () => {
    const { isActivityPublic } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['https://www.w3.org/ns/activitystreams#Public']
    }
    expect(isActivityPublic(activity)).toBe(true)
  })

  it('returns true when cc contains Public', async () => {
    const { isActivityPublic } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      cc: ['Public']
    }
    expect(isActivityPublic(activity)).toBe(true)
  })

  it('returns true when audience contains Public', async () => {
    const { isActivityPublic } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      audience: ['Public']
    }
    expect(isActivityPublic(activity)).toBe(true)
  })

  it('returns true when multiple fields contain Public', async () => {
    const { isActivityPublic } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['https://example.com/recipient'],
      cc: ['Public']
    }
    expect(isActivityPublic(activity)).toBe(true)
  })

  it('returns false when no Public recipient', async () => {
    const { isActivityPublic } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      to: ['https://example.com/recipient1', 'https://example.com/recipient2']
    }
    expect(isActivityPublic(activity)).toBe(false)
  })

  it('returns false when only explicit HTTP recipients', async () => {
    const { isActivityPublic } = await import('../../src/activity.js')
    const activity: Activity = {
      type: 'Create',
      actor: 'https://example.com/actor'
    }
    expect(isActivityPublic(activity)).toBe(false)
  })
})
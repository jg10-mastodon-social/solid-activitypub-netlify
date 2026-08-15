import { describe, it, expect } from 'vitest'
import { isActorDeleteActivity } from '../../src/handlers/inbox.js'

const ACTOR_URL = 'https://mastodon.social/ap/users/116878551484577684'

describe('isActorDeleteActivity', () => {
  describe('positive cases (self-delete with string object)', () => {
    it('returns true for Delete with actor === object (string)', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: ACTOR_URL
      }
      expect(isActorDeleteActivity(activity)).toBe(true)
    })

    it('returns true for as:Delete with actor === object (string)', () => {
      const activity = {
        type: 'as:Delete',
        actor: ACTOR_URL,
        object: ACTOR_URL
      }
      expect(isActorDeleteActivity(activity)).toBe(true)
    })

    it('returns true for Delete when type is an array containing Delete', () => {
      const activity = {
        type: ['Delete', 'Activity'],
        actor: ACTOR_URL,
        object: ACTOR_URL
      }
      expect(isActorDeleteActivity(activity)).toBe(true)
    })

    it('returns true for Delete when type array contains as:Delete', () => {
      const activity = {
        type: ['as:Delete', 'Activity'],
        actor: ACTOR_URL,
        object: ACTOR_URL
      }
      expect(isActorDeleteActivity(activity)).toBe(true)
    })

    it('returns true for the full Mastodon-style account-delete payload', () => {
      const activity = {
        '@context': [
          'https://www.w3.org/ns/activitystreams',
          'https://w3id.org/security/v1'
        ],
        id: `${ACTOR_URL}#delete`,
        type: 'Delete',
        actor: ACTOR_URL,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        object: ACTOR_URL,
        signature: { type: 'RsaSignature2017' }
      }
      expect(isActorDeleteActivity(activity)).toBe(true)
    })
  })

  describe('positive cases (inline actor/Tombstone object)', () => {
    it('returns true when object is an inline Tombstone with id === actor', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: { id: ACTOR_URL, type: 'Tombstone' }
      }
      expect(isActorDeleteActivity(activity)).toBe(true)
    })

    it('returns true when object is an inline Tombstone with as: prefix', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: { id: ACTOR_URL, type: 'as:Tombstone' }
      }
      expect(isActorDeleteActivity(activity)).toBe(true)
    })

    it('returns true when object is an inline Person with id === actor', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: { id: ACTOR_URL, type: 'Person' }
      }
      expect(isActorDeleteActivity(activity)).toBe(true)
    })

    it('returns true when object is an inline Group with id === actor', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: { id: ACTOR_URL, type: 'Group' }
      }
      expect(isActorDeleteActivity(activity)).toBe(true)
    })

    it('returns true when object is an inline Service with id === actor', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: { id: ACTOR_URL, type: 'Service' }
      }
      expect(isActorDeleteActivity(activity)).toBe(true)
    })

    it('returns true when object is an inline Application with id === actor', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: { id: ACTOR_URL, type: 'Application' }
      }
      expect(isActorDeleteActivity(activity)).toBe(true)
    })

    it('returns true when object is an inline Organization with id === actor', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: { id: ACTOR_URL, type: 'Organization' }
      }
      expect(isActorDeleteActivity(activity)).toBe(true)
    })
  })

  describe('negative cases', () => {
    it('returns false when type is Follow even with actor === object', () => {
      const activity = {
        type: 'Follow',
        actor: ACTOR_URL,
        object: ACTOR_URL
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })

    it('returns false when type is Undo', () => {
      const activity = {
        type: 'Undo',
        actor: ACTOR_URL,
        object: { id: ACTOR_URL, type: 'Delete', actor: ACTOR_URL, object: ACTOR_URL }
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })

    it('returns false when type is missing', () => {
      const activity = {
        actor: ACTOR_URL,
        object: ACTOR_URL
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })

    it('returns false when actor is missing', () => {
      const activity = {
        type: 'Delete',
        object: ACTOR_URL
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })

    it('returns false when actor is not a string', () => {
      const activity = {
        type: 'Delete',
        actor: { id: ACTOR_URL, type: 'Person' },
        object: ACTOR_URL
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })

    it('returns false when object is missing', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })

    it('returns false when object is a string different from actor', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: 'https://other.example/note/123'
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })

    it('returns false when object is an inline Note (not an actor/tombstone)', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: { id: 'https://other.example/note/123', type: 'Note' }
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })

    it('returns false when object is an inline Tombstone with id !== actor', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: { id: 'https://other.example/ap/users/999', type: 'Tombstone' }
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })

    it('returns false when inline object has no id', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: { type: 'Tombstone' }
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })

    it('returns false when inline object has unknown type', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: { id: ACTOR_URL, type: 'Document' }
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })

    it('returns false when object is an array', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: [ACTOR_URL]
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })

    it('returns false when object is null', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: null
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })

    it('returns false when object is a number', () => {
      const activity = {
        type: 'Delete',
        actor: ACTOR_URL,
        object: 42
      }
      expect(isActorDeleteActivity(activity)).toBe(false)
    })
  })
})
import { describe, it, expect } from 'vitest'
import {
  RESERVED_ACTOR_NAMES,
  validateActorName,
  assertValidActorName
} from '../../../src/actors/naming.js'

const VALID_NAMES = ['alice', 'actor', 'flow_topics', 'task-management', 'a1']

const INVALID_CHARACTER_NAMES = [
  'Alice',
  'foo bar',
  'foo/bar',
  'foo.bar',
  'foo@bar',
  'ACTOR'
]

describe('RESERVED_ACTOR_NAMES', () => {
  it('lists the reserved route segments and document names', () => {
    for (const name of [
      'inbox',
      'outbox',
      'followers',
      'following',
      'admin',
      'webid',
      'jwks.json',
      '.well-known',
      'index.html',
      'components',
      'templates',
      'assets'
    ]) {
      expect(RESERVED_ACTOR_NAMES.has(name)).toBe(true)
    }
  })
})

describe('validateActorName', () => {
  it('accepts simple names', () => {
    for (const name of VALID_NAMES) {
      expect(validateActorName(name)).toEqual({ valid: true })
    }
  })

  it('accepts a 64-character name built from valid characters', () => {
    const name = 'a'.repeat(64)
    expect(name).toHaveLength(64)
    expect(validateActorName(name)).toEqual({ valid: true })
  })

  it('rejects an empty string', () => {
    const result = validateActorName('')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain('empty')
  })

  it('rejects a 65-character name as too_long', () => {
    const result = validateActorName('a'.repeat(65))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain('too_long')
  })

  it('rejects uppercase characters', () => {
    const result = validateActorName('Alice')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain('invalid_characters')
  })

  it('rejects a leading hyphen or underscore', () => {
    for (const name of ['-alice', '_alice']) {
      const result = validateActorName(name)
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toContain('must_start_with_letter_or_digit')
    }
  })

  it('rejects spaces, slashes, dots, and @', () => {
    for (const name of INVALID_CHARACTER_NAMES) {
      const result = validateActorName(name)
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toContain('invalid_characters')
    }
  })

  it('rejects spaces specifically', () => {
    const result = validateActorName('foo bar')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain('invalid_characters')
  })

  it('rejects every reserved name', () => {
    for (const name of RESERVED_ACTOR_NAMES) {
      const result = validateActorName(name)
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toContain('reserved')
    }
  })

  it('rejects reserved names case-insensitively', () => {
    const result = validateActorName('Inbox')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain('reserved')
  })

  it('includes the offending name in the reason where helpful', () => {
    const result = validateActorName('bad name')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain('bad name')
  })
})

describe('assertValidActorName', () => {
  it('does not throw for a valid name', () => {
    expect(() => assertValidActorName('alice')).not.toThrow()
  })

  it('throws for an invalid name with the reason in the message', () => {
    expect(() => assertValidActorName('Alice')).toThrowError(/invalid_characters/)
  })

  it('throws with the reserved reason for a reserved name', () => {
    expect(() => assertValidActorName('inbox')).toThrowError(/reserved/)
  })
})

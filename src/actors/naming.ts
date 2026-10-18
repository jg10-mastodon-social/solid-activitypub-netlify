export const RESERVED_ACTOR_NAMES: ReadonlySet<string> = new Set([
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
])

export type ActorNameValidation = { valid: true } | { valid: false; reason: string }

const MAX_ACTOR_NAME_LENGTH = 64
const ALLOWED_CHARACTERS = /^[a-z0-9_-]+$/
const STARTS_WITH_LETTER_OR_DIGIT = /^[a-z0-9]/

export function validateActorName(name: string): ActorNameValidation {
  if (name.length === 0) {
    return { valid: false, reason: 'empty' }
  }

  if (RESERVED_ACTOR_NAMES.has(name.toLowerCase())) {
    return { valid: false, reason: `reserved: "${name}"` }
  }

  if (name.length > MAX_ACTOR_NAME_LENGTH) {
    return { valid: false, reason: `too_long: "${name}"` }
  }

  if (!ALLOWED_CHARACTERS.test(name)) {
    return { valid: false, reason: `invalid_characters: "${name}"` }
  }

  if (!STARTS_WITH_LETTER_OR_DIGIT.test(name)) {
    return { valid: false, reason: `must_start_with_letter_or_digit: "${name}"` }
  }

  return { valid: true }
}

export function assertValidActorName(name: string): void {
  const result = validateActorName(name)
  if (!result.valid) {
    throw new Error(`invalid actor name: ${result.reason}`)
  }
}

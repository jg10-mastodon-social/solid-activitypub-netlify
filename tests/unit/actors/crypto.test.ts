import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  encryptActorSecret,
  decryptActorSecret,
  type EncryptedSecret
} from '../../../src/actors/crypto.js'

const KEY = Buffer.alloc(32, 7).toString('base64')
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64')

const jwk = {
  kty: 'EC',
  crv: 'P-256',
  x: 'f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU',
  y: 'x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0',
  d: 'jpsQnnGQmL-YBIffH1136cspYG6-0iY7X1fCE9-E9LI',
  kid: 'https://example.com/actor#main-key',
  alg: 'ES256'
}

describe('actor secret crypto', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.ACTOR_KEY_ENCRYPTION_KEY
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('round-trips a nested object with an explicit key', () => {
    const envelope = encryptActorSecret(jwk, KEY)

    expect(envelope.v).toBe(1)
    expect(typeof envelope.iv).toBe('string')
    expect(typeof envelope.ciphertext).toBe('string')
    expect(typeof envelope.tag).toBe('string')

    const decrypted = decryptActorSecret<typeof jwk>(envelope, KEY)
    expect(decrypted).toEqual(jwk)
  })

  it('round-trips using process.env.ACTOR_KEY_ENCRYPTION_KEY when no explicit key is passed', () => {
    process.env.ACTOR_KEY_ENCRYPTION_KEY = KEY

    const envelope = encryptActorSecret(jwk)
    const decrypted = decryptActorSecret<typeof jwk>(envelope)

    expect(decrypted).toEqual(jwk)
  })

  it('produces a different iv and ciphertext for the same plaintext on two calls', () => {
    const first = encryptActorSecret(jwk, KEY)
    const second = encryptActorSecret(jwk, KEY)

    expect(first.iv).not.toBe(second.iv)
    expect(first.ciphertext).not.toBe(second.ciphertext)
  })

  it('throws when the key env is missing and no key is passed', () => {
    expect(() => encryptActorSecret(jwk)).toThrow(/ACTOR_KEY_ENCRYPTION_KEY/)

    const envelope = encryptActorSecret(jwk, KEY)
    expect(() => decryptActorSecret(envelope)).toThrow(/ACTOR_KEY_ENCRYPTION_KEY/)
  })

  it('throws when the key does not decode to 32 bytes', () => {
    const shortKey = Buffer.alloc(16, 1).toString('base64')

    expect(() => encryptActorSecret(jwk, shortKey)).toThrow(/32 bytes/)

    const envelope = encryptActorSecret(jwk, KEY)
    expect(() => decryptActorSecret(envelope, shortKey)).toThrow(/32 bytes/)
  })

  it('throws on a wrong decryption key', () => {
    const envelope = encryptActorSecret(jwk, KEY)

    expect(() => decryptActorSecret(envelope, OTHER_KEY)).toThrow()
  })

  it('throws when the ciphertext is tampered with', () => {
    const envelope = encryptActorSecret(jwk, KEY)
    const tampered: EncryptedSecret = {
      ...envelope,
      ciphertext: flipFirstChar(envelope.ciphertext)
    }

    expect(() => decryptActorSecret(tampered, KEY)).toThrow()
  })

  it('throws when the tag is tampered with', () => {
    const envelope = encryptActorSecret(jwk, KEY)
    const tampered: EncryptedSecret = {
      ...envelope,
      tag: flipFirstChar(envelope.tag)
    }

    expect(() => decryptActorSecret(tampered, KEY)).toThrow()
  })

  it('throws on an unsupported envelope version', () => {
    const envelope = encryptActorSecret(jwk, KEY)
    const unsupported = { ...envelope, v: 2 } as unknown as EncryptedSecret

    expect(() => decryptActorSecret(unsupported, KEY)).toThrow(/version/)
  })
})

function flipFirstChar(value: string): string {
  const first = value[0] === 'A' ? 'B' : 'A'
  return first + value.slice(1)
}

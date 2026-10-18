import { describe, it, expect } from 'vitest'
import { deriveActorConfig, derivePodBase } from '../../../src/actors/config.js'

describe('deriveActorConfig', () => {
  it('derives every URL field', () => {
    const config = deriveActorConfig(
      'alice',
      'https://example.netlify.app',
      'https://pod.example/'
    )
    expect(config).toEqual({
      name: 'alice',
      path: '/alice',
      url: 'https://example.netlify.app/alice',
      keyId: 'https://example.netlify.app/alice#main-key',
      inboxUrl: 'https://example.netlify.app/alice/inbox',
      outboxUrl: 'https://example.netlify.app/alice/outbox',
      followersUrl: 'https://example.netlify.app/alice/followers',
      followingUrl: 'https://example.netlify.app/alice/following',
      sharedInboxUrl: 'https://example.netlify.app/inbox',
      webfingerResource: 'acct:alice@example.netlify.app'
    })
  })

  it('handles a base URL with a port', () => {
    const config = deriveActorConfig(
      'alice',
      'http://localhost:9999',
      'https://pod.example/'
    )
    expect(config.webfingerResource).toBe('acct:alice@localhost:9999')
  })

  it('throws when solidStorageBaseUrl lacks a trailing slash', () => {
    expect(() =>
      deriveActorConfig('alice', 'https://example.netlify.app', 'https://pod.example')
    ).toThrowError(/SOLID_STORAGE_BASE_URL must end with \//)
  })
})

describe('derivePodBase', () => {
  it('derives the pod base', () => {
    expect(derivePodBase('alice', 'https://pod.example/')).toBe(
      'https://pod.example/alice/'
    )
  })

  it('throws when solidStorageBaseUrl lacks a trailing slash', () => {
    expect(() => derivePodBase('alice', 'https://pod.example')).toThrowError(
      /SOLID_STORAGE_BASE_URL must end with \//
    )
  })
})

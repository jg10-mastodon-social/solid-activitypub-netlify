import { describe, it, expect } from 'vitest'
import { rewriteBody } from '../../src/services/rewriteBody.js'

const solidStorageBaseUrl = 'http://localhost:9998/'
const baseUrl = 'http://localhost:9999'
const actorName = 'alice'

describe('rewriteBody', () => {
  describe('absolute URIs (regression coverage)', () => {
    it('rewrites the absolute collection URL with trailing slash', () => {
      const body = '<http://localhost:9998/alice/outbox/> a <https://www.w3.org/ns/activitystreams#OrderedCollection> .'
      const out = rewriteBody(body, solidStorageBaseUrl, baseUrl, actorName, 'outbox')
      expect(out).toContain('http://localhost:9999/alice/outbox/')
      expect(out).not.toContain('http://localhost:9998/alice/outbox/')
    })

    it('rewrites page URLs whose path starts with the collection', () => {
      const body = '<http://localhost:9998/alice/outbox/pages/1786788074335> a <https://www.w3.org/ns/activitystreams#OrderedCollectionPage> .'
      const out = rewriteBody(body, solidStorageBaseUrl, baseUrl, actorName, 'outbox')
      expect(out).toContain('http://localhost:9999/alice/outbox/pages/1786788074335')
    })
  })

  describe('relative URIs (the bug fix)', () => {
    it('resolves a relative <pages/123> reference to the absolute public URL', () => {
      const body = '<> a <https://www.w3.org/ns/activitystreams#OrderedCollection> ; <https://www.w3.org/ns/activitystreams#first> <pages/1786788074335> .'
      const out = rewriteBody(body, solidStorageBaseUrl, baseUrl, actorName, 'outbox')
      expect(out).toContain('<http://localhost:9999/alice/outbox/pages/1786788074335>')
      expect(out).not.toMatch(/<pages\/1786788074335>/)
    })

    it('resolves a relative <../> reference (as:partOf in page bodies) to the absolute public URL', () => {
      const body = '<> a <https://www.w3.org/ns/activitystreams#OrderedCollectionPage> ; <https://www.w3.org/ns/activitystreams#partOf> <../> .'
      const podResourceUrl = 'http://localhost:9998/alice/outbox/pages/1786788074335'
      const out = rewriteBody(body, solidStorageBaseUrl, baseUrl, actorName, 'outbox', podResourceUrl)
      expect(out).toMatch(/<http:\/\/localhost:9999\/alice\/outbox\/?>/)
    })
  })

  describe('boundary and negative cases', () => {
    it('does not touch absolute URIs outside the pod base (e.g. external actor)', () => {
      const body = '<http://localhost:9998/alice/outbox> <https://www.w3.org/ns/activitystreams#items> <https://mastodon.social/users/jg10/statuses/1> .'
      const out = rewriteBody(body, solidStorageBaseUrl, baseUrl, actorName, 'outbox')
      expect(out).toContain('https://mastodon.social/users/jg10/statuses/1')
    })

    it('does not over-match a sibling collection whose name shares the prefix (inbox vs inbox2)', () => {
      const body = '<http://localhost:9998/alice/inbox2/foo> a <https://example.com/Thing> .'
      const out = rewriteBody(body, solidStorageBaseUrl, baseUrl, actorName, 'inbox')
      expect(out).toContain('http://localhost:9998/alice/inbox2/foo')
      expect(out).not.toContain('http://localhost:9999/alice/inbox2/foo')
    })

    it('does not rewrite predicate URIs', () => {
      const body = '<> <https://www.w3.org/ns/activitystreams#first> <pages/1> .'
      const out = rewriteBody(body, solidStorageBaseUrl, baseUrl, actorName, 'outbox')
      expect(out).toContain('https://www.w3.org/ns/activitystreams#first')
    })
  })

  describe('stripTrailingSlash', () => {
    it('strips the trailing slash from the public collection URL when stripTrailingSlash is true', () => {
      const body = '<http://localhost:9998/alice/outbox/> a <https://www.w3.org/ns/activitystreams#OrderedCollection> .'
      const out = rewriteBody(
        body,
        solidStorageBaseUrl,
        baseUrl,
        actorName,
        'outbox',
        'http://localhost:9998/alice/outbox/',
        true
      )
      expect(out).toContain('<http://localhost:9999/alice/outbox>')
      expect(out).not.toContain('<http://localhost:9999/alice/outbox/>')
    })

    it('does not strip the trailing slash from sub-paths (e.g. /pages/1) when stripTrailingSlash is true', () => {
      const body = '<http://localhost:9998/alice/outbox/> a <https://www.w3.org/ns/activitystreams#OrderedCollection> ; <https://www.w3.org/ns/activitystreams#first> <pages/1> .'
      const out = rewriteBody(
        body,
        solidStorageBaseUrl,
        baseUrl,
        actorName,
        'outbox',
        'http://localhost:9998/alice/outbox/',
        true
      )
      expect(out).toContain('<http://localhost:9999/alice/outbox/pages/1>')
      expect(out).not.toContain('<http://localhost:9999/alice/outboxpages/1>')
    })

    it('keeps the trailing slash when stripTrailingSlash is false (default)', () => {
      const body = '<http://localhost:9998/alice/outbox/> a <https://www.w3.org/ns/activitystreams#OrderedCollection> .'
      const out = rewriteBody(body, solidStorageBaseUrl, baseUrl, actorName, 'outbox')
      expect(out).toContain('<http://localhost:9999/alice/outbox/>')
    })
  })

  describe('fallback behaviour', () => {
    it('falls back to substring replacement when the body is not parseable Turtle', () => {
      const body = '<not valid turtle >>>>'
      const out = rewriteBody(body, solidStorageBaseUrl, baseUrl, actorName, 'outbox')
      expect(typeof out).toBe('string')
    })

    it('returns empty body unchanged', () => {
      expect(rewriteBody('', solidStorageBaseUrl, baseUrl, actorName, 'outbox')).toBe('')
    })
  })
})

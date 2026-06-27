import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()

describe('rdfUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parseInboxTurtle', () => {
    it('should parse inbox turtle and return first pointer', async () => {
      const { parseInboxTurtle } = await import('../../src/services/rdfUtils.js')
      const turtle = `
        @prefix as: <https://www.w3.org/ns/activitystreams#>.
        <https://example.com/inbox/> a as:OrderedCollection;
          as:first <https://example.com/inbox/pages/123>.
      `
      const result = await parseInboxTurtle(turtle, 'https://example.com/inbox/')
      expect(result).not.toBeNull()
      expect(result?.first).toBe('https://example.com/inbox/pages/123')
    })

    it('should return null when inbox has no first pointer', async () => {
      const { parseInboxTurtle } = await import('../../src/services/rdfUtils.js')
      const turtle = `
        @prefix as: <https://www.w3.org/ns/activitystreams#>.
        <https://example.com/inbox/> a as:OrderedCollection.
      `
      const result = await parseInboxTurtle(turtle, 'https://example.com/inbox/')
      expect(result).toBeNull()
    })
  })

  describe('getChildResources', () => {
    it('should return array of child resource URLs', async () => {
      const { getChildResources } = await import('../../src/services/rdfUtils.js')
      const turtle = `
        @prefix as: <https://www.w3.org/ns/activitystreams#>.
        @prefix ldp: <http://www.w3.org/ns/ldp#>.
        <https://example.com/inbox/> a as:OrderedCollection;
          ldp:contains <https://example.com/inbox/activities/1>,
                       <https://example.com/inbox/activities/2>.
      `
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(turtle)
      })

      const result = await getChildResources('https://example.com/inbox/', mockFetch as SolidFetch)
      expect(result).toHaveLength(2)
      expect(result[0].url).toBe('https://example.com/inbox/activities/1')
      expect(result[1].url).toBe('https://example.com/inbox/activities/2')
    })

    it('should return empty array when no children', async () => {
      const { getChildResources } = await import('../../src/services/rdfUtils.js')
      const turtle = `
        @prefix as: <https://www.w3.org/ns/activitystreams#>.
        <https://example.com/inbox/> a as:OrderedCollection.
      `
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(turtle)
      })

      const result = await getChildResources('https://example.com/inbox/', mockFetch as SolidFetch)
      expect(result).toHaveLength(0)
    })

    it('should return empty array on fetch failure', async () => {
      const { getChildResources } = await import('../../src/services/rdfUtils.js')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      })

      const result = await getChildResources('https://example.com/inbox/', mockFetch as SolidFetch)
      expect(result).toHaveLength(0)
    })

    it('should skip container resources', async () => {
      const { getChildResources } = await import('../../src/services/rdfUtils.js')
      const turtle = `
        @prefix as: <https://www.w3.org/ns/activitystreams#>.
        @prefix ldp: <http://www.w3.org/ns/ldp#>.
        <https://example.com/inbox/> a as:OrderedCollection;
          ldp:contains <https://example.com/inbox/activities/1>,
                       <https://example.com/inbox/pages/123>.
        <https://example.com/inbox/pages/123> a ldp:Container.
      `
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(turtle)
      })

      const result = await getChildResources('https://example.com/inbox/', mockFetch as SolidFetch)
      expect(result).toHaveLength(1)
      expect(result[0].url).toBe('https://example.com/inbox/activities/1')
    })
  })
})

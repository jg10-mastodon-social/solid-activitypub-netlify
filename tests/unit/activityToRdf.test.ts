import { describe, it, expect, vi } from 'vitest'

describe('activityToRdf', () => {
  describe('skolemizeBlankNodes', () => {
    it('should convert blank nodes to skolemized URIs', async () => {
      const { skolemizeBlankNodes } = await import('../../src/services/activityToRdf.js')
      const turtle = `<https://example.com/inbox/pages/123> a <https://www.w3.org/ns/activitystreams#OrderedCollectionPage>.
_:b1 <https://www.w3.org/ns/activitystreams#items> <https://example.com/activities/1>.
_:b2 <https://www.w3.org/ns/activitystreams#actor> <https://example.com/actor>.`
      const result = skolemizeBlankNodes(turtle, 'https://example.com/.well-known/genid/')
      expect(result).toContain('<https://example.com/.well-known/genid/')
      expect(result).not.toContain('_:b1')
      expect(result).not.toContain('_:b2')
    })

    it('should produce consistent skolem URIs with same base', async () => {
      const { skolemizeBlankNodes } = await import('../../src/services/activityToRdf.js')
      const turtle = `_:b1 <http://example.com/prop> "value1".
_:b2 <http://example.com/prop> "value2".`
      const result = skolemizeBlankNodes(turtle, 'https://example.com/genid/')
      const matches = result.match(/genid\/\d+_\d+/g)
      expect(matches).toHaveLength(2)
    })
  })

  describe('injectContexts', () => {
    it('should add ActivityStreams and Security contexts', async () => {
      const { injectContexts } = await import('../../src/services/activityToRdf.js')
      const activity = {
        type: 'Create',
        actor: 'https://example.com/actor'
      }
      const result = injectContexts(activity)
      expect(result['@context']).toBeDefined()
      const contexts = Array.isArray(result['@context']) ? result['@context'] : [result['@context']]
      expect(contexts).toContain('https://www.w3.org/ns/activitystreams')
      expect(contexts).toContain('https://w3id.org/security/v1')
    })

    it('should preserve existing @context entries', async () => {
      const { injectContexts } = await import('../../src/services/activityToRdf.js')
      const activity = {
        type: 'Create',
        actor: 'https://example.com/actor',
        '@context': 'https://example.com/custom-context'
      }
      const result = injectContexts(activity)
      const contexts = Array.isArray(result['@context']) ? result['@context'] : [result['@context']]
      expect(contexts).toContain('https://example.com/custom-context')
    })
  })

  describe('activityToTurtle', () => {
    it('should convert activity to JSON string', async () => {
      const { activityToTurtle } = await import('../../src/services/activityToRdf.js')
      const activity = {
        type: 'Create',
        actor: 'https://example.com/actor',
        '@context': 'https://www.w3.org/ns/activitystreams'
      }
      const result = activityToTurtle(activity)
      expect(typeof result).toBe('string')
      expect(result).toContain('"type":"Create"')
      expect(result).toContain('"actor":"https://example.com/actor"')
    })
  })
})

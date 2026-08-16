import { describe, it, expect } from 'vitest'

describe('buildPatch', () => {
  describe('buildInsertDeletePatch', () => {
    it('should build a valid InsertDeletePatch with prefixes', async () => {
      const { buildInsertDeletePatch } = await import('../../src/services/buildPatch.js')
      const turtle = `<https://example.com/activities/1> a <https://www.w3.org/ns/activitystreams#Create>.`
      const patch = buildInsertDeletePatch(turtle, 'https://example.com/activities/1', 'https://example.com/inbox/pages/123')
      expect(patch).toContain('@prefix as:')
      expect(patch).toContain('@prefix solid:')
      expect(patch).toContain('solid:InsertDeletePatch')
    })

    it('should include as:items triple', async () => {
      const { buildInsertDeletePatch } = await import('../../src/services/buildPatch.js')
      const turtle = `<https://example.com/activities/1> a <https://www.w3.org/ns/activitystreams#Create>.`
      const patch = buildInsertDeletePatch(turtle, 'https://example.com/activities/1', 'https://example.com/inbox/pages/123')
      expect(patch).toContain('as:items <https://example.com/activities/1>')
    })

    it('should include the item turtle', async () => {
      const { buildInsertDeletePatch } = await import('../../src/services/buildPatch.js')
      const turtle = `<https://example.com/activities/1> a <https://www.w3.org/ns/activitystreams#Create>.`
      const patch = buildInsertDeletePatch(turtle, 'https://example.com/activities/1', 'https://example.com/inbox/pages/123')
      expect(patch).toContain(turtle)
    })
  })

  describe('buildUpdatePatch', () => {
    it('should include both deletes and inserts sections', async () => {
      const { buildUpdatePatch } = await import('../../src/services/buildPatch.js')
      const oldTurtle = `<https://example.com/activities/1> <https://example.com/prop> "old".`
      const newTurtle = `<https://example.com/activities/1> <https://example.com/prop> "new".`
      const patch = buildUpdatePatch(oldTurtle, newTurtle, 'https://example.com/activities/1', 'https://example.com/inbox/pages/123')
      expect(patch).toContain('solid:deletes')
      expect(patch).toContain('solid:inserts')
    })
  })

  describe('buildDeletePatch', () => {
    it('should build a patch that only deletes', async () => {
      const { buildDeletePatch } = await import('../../src/services/buildPatch.js')
      const turtle = `<https://example.com/activities/1> a <https://www.w3.org/ns/activitystreams#Follow>.`
      const patch = buildDeletePatch(turtle, 'https://example.com/activities/1', 'https://example.com/followers/pages/123')
      expect(patch).toContain('solid:deletes')
      expect(patch).not.toContain('solid:inserts')
    })

    it('should include as:items triple for deletion', async () => {
      const { buildDeletePatch } = await import('../../src/services/buildPatch.js')
      const turtle = `<https://example.com/activities/1> a <https://www.w3.org/ns/activitystreams#Follow>.`
      const patch = buildDeletePatch(turtle, 'https://example.com/activities/1', 'https://example.com/followers/pages/123')
      expect(patch).toContain('as:items <https://example.com/activities/1>')
    })
  })

  describe('buildUpdateLiteralPatch', () => {
    it('includes the standard prefix block', async () => {
      const { buildUpdateLiteralPatch } = await import('../../src/services/buildPatch.js')
      const patch = buildUpdateLiteralPatch(
        'https://example.com/alice/followers/',
        'https://www.w3.org/ns/activitystreams#totalItems',
        '',
        '<https://example.com/alice/followers/> <https://www.w3.org/ns/activitystreams#totalItems> "1"^^<http://www.w3.org/2001/XMLSchema#nonNegativeInteger> .'
      )
      expect(patch).toContain('@prefix as:')
      expect(patch).toContain('@prefix solid:')
      expect(patch).toContain('solid:InsertDeletePatch')
    })

    it('puts oldTurtle in solid:deletes and newTurtle in solid:inserts', async () => {
      const { buildUpdateLiteralPatch } = await import('../../src/services/buildPatch.js')
      const oldTurtle = '<https://example.com/alice/followers/> <https://www.w3.org/ns/activitystreams#totalItems> "5"^^<http://www.w3.org/2001/XMLSchema#nonNegativeInteger> .'
      const newTurtle = '<https://example.com/alice/followers/> <https://www.w3.org/ns/activitystreams#totalItems> "6"^^<http://www.w3.org/2001/XMLSchema#nonNegativeInteger> .'
      const patch = buildUpdateLiteralPatch(
        'https://example.com/alice/followers/',
        'https://www.w3.org/ns/activitystreams#totalItems',
        oldTurtle,
        newTurtle
      )
      const deletesMatch = patch.match(/solid:deletes\s*\{([\s\S]*?)\}/)
      const insertsMatch = patch.match(/solid:inserts\s*\{([\s\S]*?)\}/)
      expect(deletesMatch).not.toBeNull()
      expect(insertsMatch).not.toBeNull()
      expect(deletesMatch![1]).toContain(oldTurtle)
      expect(insertsMatch![1]).toContain(newTurtle)
    })

    it('does not include an as:items link', async () => {
      const { buildUpdateLiteralPatch } = await import('../../src/services/buildPatch.js')
      const patch = buildUpdateLiteralPatch(
        'https://example.com/alice/followers/',
        'https://www.w3.org/ns/activitystreams#totalItems',
        '',
        '<https://example.com/alice/followers/> <https://www.w3.org/ns/activitystreams#totalItems> "1"^^<http://www.w3.org/2001/XMLSchema#nonNegativeInteger> .'
      )
      expect(patch).not.toContain('as:items')
    })

    it('allows empty oldTurtle for first-add (delete clause empty)', async () => {
      const { buildUpdateLiteralPatch } = await import('../../src/services/buildPatch.js')
      const newTurtle = '<https://example.com/alice/followers/> <https://www.w3.org/ns/activitystreams#totalItems> "1"^^<http://www.w3.org/2001/XMLSchema#nonNegativeInteger> .'
      const patch = buildUpdateLiteralPatch(
        'https://example.com/alice/followers/',
        'https://www.w3.org/ns/activitystreams#totalItems',
        '',
        newTurtle
      )
      expect(patch).toContain('solid:deletes')
      expect(patch).toContain('solid:inserts')
      expect(patch).toContain(newTurtle)
    })
  })
})

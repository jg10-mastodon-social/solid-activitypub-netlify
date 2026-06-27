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
})

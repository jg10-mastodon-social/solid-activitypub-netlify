import { describe, it, expect } from 'vitest'
import { wantsAs2Json } from '../../src/wantsAs2Json.js'

describe('wantsAs2Json vs turtle (default)', () => {
  it.each([
    [null, false],
    ['', false],
    ['text/turtle', false],
    ['text/html,application/xhtml+xml,*/*;q=0.8', false],
    ['application/activity+json', true],
    ['application/activity+json, application/ld+json', true],
    ['application/ld+json', true],
    // the rdflib.js default — Turtle wins
    [
      'image/*;q=0.9, */*;q=0.1, application/rdf+xml;q=0.9, application/xhtml+xml;q=0.8, text/xml;q=0.5, application/xml;q=0.5, text/html;q=0.8, application/ld+json;q=0.9, text/plain;q=0.5, text/n3, text/turtle',
      false,
    ],
    // explicit q override: ld+json preferred
    ['application/ld+json;q=0.95, text/turtle;q=0.5', true],
    // q tied, text/turtle earlier → Turtle
    ['text/turtle, application/activity+json', false],
    // q tied, activity+json earlier → AS2-JSON
    ['application/activity+json, text/turtle', true],
    // malformed q falls back to 1.0
    ['application/ld+json;q=abc', true],
    // q=0 still counts but loses to a Turtle at default q=1.0
    ['application/ld+json;q=0, text/turtle', false],
  ])('wantsAs2Json(%j) === %s', (header, expected) => {
    expect(wantsAs2Json(header as string | null)).toBe(expected)
  })
})

describe('wantsAs2Json vs html', () => {
  it.each([
    // null/empty → false (default to HTML)
    [null, false],
    ['', false],
    // explicit JSON
    ['application/activity+json', true],
    ['application/ld+json', true],
    // browser default
    ['text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8', false],
    // PodOS shape: text/turtle, application/ld+json, text/html → JSON (ld+json beats html on order)
    ['text/turtle, application/ld+json, text/html', true],
    // html-only → HTML
    ['text/html', false],
    // application/xhtml+xml counts as HTML
    ['application/xhtml+xml', false],
    // tied q, html earlier → HTML
    ['text/html, application/activity+json', false],
    // tied q, JSON earlier → JSON
    ['application/activity+json, text/html', true],
    // explicit q override: html beats ld+json
    ['application/ld+json;q=0.5, text/html;q=0.9', false],
    // explicit q override: ld+json beats html
    ['application/ld+json;q=0.95, text/html;q=0.5', true],
    // malformed q falls back to 1.0
    ['application/ld+json;q=abc, text/html', true],
  ])('wantsAs2Json(%j, "html") === %s', (header, expected) => {
    expect(wantsAs2Json(header as string | null, 'html')).toBe(expected)
  })
})

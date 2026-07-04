import { Parser, Store } from 'n3'
import type { SolidFetch } from '../types.js'

interface ChildResource {
  url: string
  types: string[]
}

export async function parseCollectionTurtle(
  turtle: string,
  inboxUrl: string
): Promise<{ first: string } | null> {
  const parser = new Parser({ baseIRI: inboxUrl })
  const store = new Store()
  const quads = parser.parse(turtle)
  if (quads) {
    store.addQuads(quads)
  }

  const firstQuads = store.getQuads(
    inboxUrl,
    'https://www.w3.org/ns/activitystreams#first',
    null,
    null
  )

  if (firstQuads.length === 0) {
    return null
  }

  return {
    first: firstQuads[0].object.value,
  }
}

export async function getChildResources(
  inboxUrl: string,
  fetch: SolidFetch
): Promise<ChildResource[]> {
  const response = await fetch(inboxUrl, {
    method: 'GET',
    headers: {
      accept: 'text/turtle',
    },
  })

  if (!response.ok) {
    console.error(`[rdfUtils] Failed to fetch inbox ${inboxUrl}: ${response.status}`)
    return []
  }

  const text = await response.text()
  const parser = new Parser({ baseIRI: inboxUrl })
  const store = new Store()
  const quads = parser.parse(text)
  if (quads) {
    store.addQuads(quads)
  }

  const containsQuads = store.getQuads(
    inboxUrl,
    'http://www.w3.org/ns/ldp#contains',
    null,
    null
  )

  const children: ChildResource[] = []
  for (const quad of containsQuads) {
    const childUrl = quad.object.value
    const typeQuads = store.getQuads(
      childUrl,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      null,
      null
    )
    const types = typeQuads.map(t => t.object.value)
    children.push({ url: childUrl, types })
  }

  return children.filter(child => {
    const isContainer = child.types.some(t =>
      t === 'http://www.w3.org/ns/ldp#Container' ||
      t === 'http://www.w3.org/ns/ldp#BasicContainer' ||
      t === 'http://www.w3.org/ns/ldp#DirectContainer' ||
      t === 'http://www.w3.org/ns/ldp#IndirectContainer'
    )
    return !isContainer
  })
}

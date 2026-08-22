import type { SolidFetch } from '../types.js'
import { Parser, Store } from 'n3'

export type CollectionName = 'followers' | 'following'

export async function getCollection(
  collection: CollectionName,
  solidStorageBaseUrl: string,
  actorName: string,
  fetch: SolidFetch
): Promise<string[]> {
  const collectionUrl = `${solidStorageBaseUrl}${actorName}/${collection}/`

  let firstPageUrl: string | null = null

  try {
    const response = await fetch(collectionUrl, {
      method: 'GET',
      headers: {
        accept: 'text/turtle',
      },
    })

    if (!response.ok) {
      console.warn(`[getCollection] Failed to fetch ${collection} collection: ${response.status}`)
      return []
    }

    const text = await response.text()
    firstPageUrl = getFirstPageUrl(text, collectionUrl)
  } catch (error) {
    console.warn(`[getCollection] Could not fetch ${collection} collection: ${error}`)
    return []
  }

  if (!firstPageUrl) {
    return []
  }

  const items: string[] = []
  let currentPageUrl: string | null = firstPageUrl

  while (currentPageUrl) {
    const pageResult = await getPageItems(currentPageUrl, fetch)
    items.push(...pageResult.items)
    currentPageUrl = pageResult.nextPageUrl
  }

  return items
}

function getFirstPageUrl(turtle: string, collectionUrl: string): string | null {
  const parser = new Parser({ baseIRI: collectionUrl })
  const store = new Store()
  const quads = parser.parse(turtle)
  if (quads) {
    store.addQuads(quads)
  }

  const firstQuads = store.getQuads(
    collectionUrl,
    'https://www.w3.org/ns/activitystreams#first',
    null,
    null
  )

  if (firstQuads.length === 0) {
    return null
  }

  return firstQuads[0].object.value
}

interface PageItems {
  items: string[]
  nextPageUrl: string | null
}

async function getPageItems(
  pageUrl: string,
  fetch: SolidFetch
): Promise<PageItems> {
  const response = await fetch(pageUrl, {
    method: 'GET',
    headers: {
      accept: 'text/turtle',
    },
  })

  if (!response.ok) {
    return { items: [], nextPageUrl: null }
  }

  const text = await response.text()
  return parsePage(text, pageUrl)
}

function parsePage(turtle: string, pageUrl: string): PageItems {
  const parser = new Parser({ baseIRI: pageUrl })
  const store = new Store()
  const quads = parser.parse(turtle)
  if (quads) {
    store.addQuads(quads)
  }

  const nextQuads = store.getQuads(
    pageUrl,
    'https://www.w3.org/ns/activitystreams#next',
    null,
    null
  )
  const nextPageUrl = nextQuads.length > 0 ? nextQuads[0].object.value : null

  const itemsQuads = store.getQuads(
    pageUrl,
    'https://www.w3.org/ns/activitystreams#items',
    null,
    null
  )

  const items = itemsQuads.map(q => q.object.value)

  return { items, nextPageUrl }
}
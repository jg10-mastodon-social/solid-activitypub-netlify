import { Parser, Store } from 'n3'
import type { SolidFetch } from '../types.js'

const PAGE_SIZE_LIMIT = 200

interface PageInfo {
  itemCount: number
  isFull: boolean
}

export async function getPageInfo(
  pageUrl: string,
  fetch: SolidFetch
): Promise<PageInfo> {
  const response = await fetch(pageUrl, {
    method: 'GET',
    headers: {
      accept: 'text/turtle',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status}`)
  }

  const text = await response.text()
  const parser = new Parser({ baseIRI: pageUrl })
  const store = new Store()
  const quads = parser.parse(text)
  if (quads) {
    store.addQuads(quads)
  }

  const itemsQuads = store.getQuads(
    pageUrl,
    'https://www.w3.org/ns/activitystreams#items',
    null,
    null
  )

  const itemCount = itemsQuads.length
  return {
    itemCount,
    isFull: itemCount >= PAGE_SIZE_LIMIT,
  }
}

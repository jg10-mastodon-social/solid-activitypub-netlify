import type { SolidFetch } from '../types.js'
import { Parser, Store } from 'n3'
import { derivePageUrl } from './derivePageUrl.js'
import { buildInsertItemLinkPatch, buildUpdateLiteralPatch } from './buildPatch.js'
import { parseFollowersRoot } from './rdfUtils.js'
import { discoverMetaResourceUrl } from './solidHelpers.js'

export type CollectionName = 'followers' | 'following'

const AS_TOTALITEMS = 'https://www.w3.org/ns/activitystreams#totalItems'
const XSD_NON_NEG_INT = 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger'

function totalItemsLiteralTurtle(subject: string, value: number): string {
  return `<${subject}> <${AS_TOTALITEMS}> "${value}"^^<${XSD_NON_NEG_INT}> .`
}

async function incrementCollectionTotal(
  collectionUrl: string,
  fetch: SolidFetch
): Promise<void> {
  try {
    const response = await fetch(collectionUrl, { headers: { accept: 'text/turtle' } })
    const text = await response.text()
    const parsed = await parseFollowersRoot(text, collectionUrl)
    const current = parsed?.totalItems ?? 0
    const next = current + 1
    const oldTurtle = current === 0
      ? ''
      : totalItemsLiteralTurtle(collectionUrl, current)
    const newTurtle = totalItemsLiteralTurtle(collectionUrl, next)
    const patchBody = buildUpdateLiteralPatch(collectionUrl, AS_TOTALITEMS, oldTurtle, newTurtle)
    const metaUrl = await discoverMetaResourceUrl(collectionUrl, fetch)
    const patchResponse = await fetch(metaUrl, {
      method: 'PATCH',
      headers: { 'content-type': 'text/n3' },
      body: patchBody
    })
    if (!patchResponse.ok) {
      console.warn(`[inbox] totalItems PATCH failed for ${metaUrl}: ${patchResponse.status}`)
    }
  } catch (error) {
    console.warn(`[inbox] Could not update totalItems on ${collectionUrl}: ${error}`)
  }
}

const AS_CONTEXT = 'https://www.w3.org/ns/activitystreams'

function rewriteUrl(podUrl: string, podRootUrl: string, publicRootUrl: string): string {
  const podPrefix = podRootUrl.replace(/\/$/, '') + '/'
  if (podUrl === podRootUrl) return publicRootUrl
  if (podUrl.startsWith(podPrefix)) {
    return publicRootUrl + podUrl.slice(podPrefix.length - 1)
  }
  return podUrl
}

function pageToPublic(
  podPageUrl: string,
  podRootUrl: string,
  publicRootUrl: string
): string {
  const podPrefix = podRootUrl.replace(/\/$/, '') + '/'
  if (podPageUrl === podRootUrl) return publicRootUrl
  if (podPageUrl.startsWith(podPrefix)) {
    return publicRootUrl + podPageUrl.slice(podPrefix.length - 1)
  }
  return podPageUrl
}

export async function serializeCollection(
  collection: CollectionName,
  fetchFn: SolidFetch,
  podRootUrl: string,
  publicRootUrl: string
): Promise<Response> {
  const response = await fetchFn(podRootUrl, {
    headers: { accept: 'text/turtle' }
  })
  const text = await response.text()
  const parsed = await parseFollowersRoot(text, podRootUrl)

  const body: Record<string, unknown> = {
    '@context': AS_CONTEXT,
    id: publicRootUrl,
    type: 'OrderedCollection',
    totalItems: parsed?.totalItems ?? 0
  }
  if (parsed?.first) {
    body.first = rewriteUrl(parsed.first, podRootUrl, publicRootUrl)
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/activity+json' }
  })
}

export async function serializePage(
  collection: CollectionName,
  fetchFn: SolidFetch,
  podPageUrl: string,
  podRootUrl: string,
  publicRootUrl: string
): Promise<Response> {
  const response = await fetchFn(podPageUrl, {
    headers: { accept: 'text/turtle' }
  })
  const text = await response.text()

  const parser = new Parser({ baseIRI: podPageUrl })
  const store = new Store()
  const quads = parser.parse(text)
  if (quads) {
    store.addQuads(quads)
  }

  const itemsQuads = store.getQuads(
    podPageUrl,
    'https://www.w3.org/ns/activitystreams#items',
    null,
    null
  )
  const orderedItems = itemsQuads.map(q => q.object.value)

  const nextQuads = store.getQuads(
    podPageUrl,
    'https://www.w3.org/ns/activitystreams#next',
    null,
    null
  )

  const body: Record<string, unknown> = {
    '@context': AS_CONTEXT,
    id: pageToPublic(podPageUrl, podRootUrl, publicRootUrl),
    type: 'OrderedCollectionPage',
    partOf: publicRootUrl,
    orderedItems
  }
  if (nextQuads.length > 0) {
    body.next = pageToPublic(nextQuads[0].object.value, podRootUrl, publicRootUrl)
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/activity+json' }
  })
}

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

export async function addToCollection(
  collection: CollectionName,
  item: string,
  fetch: SolidFetch,
  solidStorageBaseUrl: string,
  actorName: string
): Promise<void> {
  const collectionUrl = `${solidStorageBaseUrl}${actorName}/${collection}/`

  const pageUrl = await derivePageUrl(collectionUrl, fetch)

  const patchBody = buildInsertItemLinkPatch(pageUrl, item)

  const response = await fetch(pageUrl, {
    method: 'PATCH',
    headers: {
      'content-type': 'text/n3',
    },
    body: patchBody,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to add ${item} to ${actorName} ${collection}: ${response.status} ${text}`)
  }

  await incrementCollectionTotal(collectionUrl, fetch)

  console.log(`[inbox] Added ${item} to ${actorName} ${collection} collection`)
}
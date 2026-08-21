import type { SolidFetch } from '../types.js'
import { buildDeleteItemLinkPatch, buildUpdateLiteralPatch } from './buildPatch.js'
import { parseCollectionTurtle, parseFollowersRoot } from './rdfUtils.js'
import { discoverMetaResourceUrl } from './solidHelpers.js'
import { Parser, Store } from 'n3'

const AS_TOTALITEMS = 'https://www.w3.org/ns/activitystreams#totalItems'
const XSD_NON_NEG_INT = 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger'

function totalItemsLiteralTurtle(subject: string, value: number): string {
  return `<${subject}> <${AS_TOTALITEMS}> "${value}"^^<${XSD_NON_NEG_INT}> .`
}

async function decrementFollowingTotal(
  followingUrl: string,
  fetch: SolidFetch
): Promise<void> {
  try {
    const response = await fetch(followingUrl, { headers: { accept: 'text/turtle' } })
    const text = await response.text()
    const parsed = await parseFollowersRoot(text, followingUrl)
    const current = parsed?.totalItems ?? 0
    const next = Math.max(0, current - 1)
    if (next === current) return
    const oldTurtle = totalItemsLiteralTurtle(followingUrl, current)
    const newTurtle = totalItemsLiteralTurtle(followingUrl, next)
    const patchBody = buildUpdateLiteralPatch(followingUrl, AS_TOTALITEMS, oldTurtle, newTurtle)
    const metaUrl = await discoverMetaResourceUrl(followingUrl, fetch)
    const patchResponse = await fetch(metaUrl, {
      method: 'PATCH',
      headers: { 'content-type': 'text/n3' },
      body: patchBody
    })
    if (!patchResponse.ok) {
      console.warn(`[inbox] totalItems PATCH failed for ${metaUrl}: ${patchResponse.status}`)
    }
  } catch (error) {
    console.warn(`[inbox] Could not update totalItems on ${followingUrl}: ${error}`)
  }
}

export async function removeFromFollowing(
  followedActor: string,
  fetch: SolidFetch,
  solidStorageBaseUrl: string,
  actorName: string
): Promise<void> {
  const followingUrl = `${solidStorageBaseUrl}${actorName}/following/`

  let currentPageUrl: string | null = null

  try {
    const response = await fetch(followingUrl, {
      method: 'GET',
      headers: {
        accept: 'text/turtle',
      },
    })

    if (response.ok) {
      const text = await response.text()
      const collection = await parseCollectionTurtle(text, followingUrl)
      if (collection && collection.first) {
        currentPageUrl = collection.first
      }
    }
  } catch (error) {
    console.warn(`[removeFromFollowing] Could not fetch following collection: ${error}`)
  }

  if (!currentPageUrl) {
    throw new Error('Could not find first page of following collection')
  }

  let pageUrl = currentPageUrl
  while (pageUrl) {
    const deleted = await removeFromPage(pageUrl, followedActor, fetch)
    if (deleted) {
      await decrementFollowingTotal(followingUrl, fetch)
      console.log(`[inbox] Removed ${followedActor} from ${actorName} following collection`)
      return
    }

    const nextPageUrl: string | null = await getNextPageUrl(pageUrl, fetch)
    if (!nextPageUrl) break
    pageUrl = nextPageUrl
  }

  throw new Error(`Could not find followed actor ${followedActor} in ${actorName} following collection`)
}

async function removeFromPage(
  pageUrl: string,
  followedActor: string,
  fetch: SolidFetch
): Promise<boolean> {
  const response = await fetch(pageUrl, {
    method: 'GET',
    headers: {
      accept: 'text/turtle',
    },
  })

  if (!response.ok) {
    return false
  }

  const text = await response.text()
  const parser = new Parser({ baseIRI: pageUrl })
  const store = new Store()
  const quads = parser.parse(text)
  if (quads) {
    store.addQuads(quads)
  }

  const itemQuads = store.getQuads(
    pageUrl,
    'https://www.w3.org/ns/activitystreams#items',
    followedActor,
    null
  )

  if (itemQuads.length === 0) {
    return false
  }

  const patchBody = buildDeleteItemLinkPatch(pageUrl, followedActor)

  const deleteResponse = await fetch(pageUrl, {
    method: 'PATCH',
    headers: {
      'content-type': 'text/n3',
    },
    body: patchBody,
  })

  return deleteResponse.ok
}

async function getNextPageUrl(
  pageUrl: string,
  fetch: SolidFetch
): Promise<string | null> {
  const response = await fetch(pageUrl, {
    method: 'GET',
    headers: {
      accept: 'text/turtle',
    },
  })

  if (!response.ok) {
    return null
  }

  const text = await response.text()
  const parser = new Parser({ baseIRI: pageUrl })
  const store = new Store()
  const quads = parser.parse(text)
  if (quads) {
    store.addQuads(quads)
  }

  const nextQuads = store.getQuads(
    pageUrl,
    'https://www.w3.org/ns/activitystreams#next',
    null,
    null
  )

  return nextQuads.length > 0 ? nextQuads[0].object.value : null
}

import type { SolidFetch } from '../types.js'
import { buildDeleteItemLinkPatch, buildUpdateLiteralPatch } from './buildPatch.js'
import { parseCollectionTurtle, parseFollowersRoot } from './rdfUtils.js'
import { Parser, Store } from 'n3'

const AS_TOTALITEMS = 'https://www.w3.org/ns/activitystreams#totalItems'
const XSD_NON_NEG_INT = 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger'

function totalItemsLiteralTurtle(subject: string, value: number): string {
  return `<${subject}> <${AS_TOTALITEMS}> "${value}"^^<${XSD_NON_NEG_INT}> .`
}

async function decrementFollowersTotal(
  followersUrl: string,
  fetch: SolidFetch
): Promise<void> {
  try {
    const response = await fetch(followersUrl, { headers: { accept: 'text/turtle' } })
    const text = await response.text()
    const parsed = await parseFollowersRoot(text, followersUrl)
    const current = parsed?.totalItems ?? 0
    const next = Math.max(0, current - 1)
    if (next === current) return
    const oldTurtle = totalItemsLiteralTurtle(followersUrl, current)
    const newTurtle = totalItemsLiteralTurtle(followersUrl, next)
    const patchBody = buildUpdateLiteralPatch(followersUrl, AS_TOTALITEMS, oldTurtle, newTurtle)
    const patchResponse = await fetch(followersUrl, {
      method: 'PATCH',
      headers: { 'content-type': 'text/n3' },
      body: patchBody
    })
    if (!patchResponse.ok) {
      console.warn(`[inbox] totalItems PATCH failed for ${followersUrl}: ${patchResponse.status}`)
    }
  } catch (error) {
    console.warn(`[inbox] Could not update totalItems on ${followersUrl}: ${error}`)
  }
}

export async function removeFromFollowers(
  followerActor: string,
  fetch: SolidFetch,
  solidStorageBaseUrl: string,
  actorName: string
): Promise<void> {
  const followersUrl = `${solidStorageBaseUrl}${actorName}/followers/`

  let currentPageUrl: string | null = null

  try {
    const response = await fetch(followersUrl, {
      method: 'GET',
      headers: {
        accept: 'text/turtle',
      },
    })

    if (response.ok) {
      const text = await response.text()
      const collection = await parseCollectionTurtle(text, followersUrl)
      if (collection && collection.first) {
        currentPageUrl = collection.first
      }
    }
  } catch (error) {
    console.warn(`[removeFromFollowers] Could not fetch followers collection: ${error}`)
  }

  if (!currentPageUrl) {
    throw new Error('Could not find first page of followers collection')
  }

  let pageUrl = currentPageUrl
  while (pageUrl) {
    const deleted = await removeFromPage(pageUrl, followerActor, fetch)
    if (deleted) {
      await decrementFollowersTotal(followersUrl, fetch)
      console.log(`[inbox] Removed ${followerActor} from ${actorName} followers collection`)
      return
    }

    const nextPageUrl: string | null = await getNextPageUrl(pageUrl, fetch)
    if (!nextPageUrl) break
    pageUrl = nextPageUrl
  }

  throw new Error(`Could not find follower ${followerActor} in ${actorName} followers collection`)
}

async function removeFromPage(
  pageUrl: string,
  followerActor: string,
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
    followerActor,
    null
  )

  if (itemQuads.length === 0) {
    return false
  }

  const patchBody = buildDeleteItemLinkPatch(pageUrl, followerActor)

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

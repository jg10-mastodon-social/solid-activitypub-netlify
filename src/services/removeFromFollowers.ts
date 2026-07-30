import type { SolidFetch } from '../types.js'
import { buildDeletePatch } from './buildPatch.js'
import { parseCollectionTurtle } from './rdfUtils.js'
import { Parser, Store, NamedNode } from 'n3'

export async function removeFromFollowers(
  followerActor: string,
  fetch: SolidFetch,
  solidStorageBaseUrl: string,
  actorUrl: string
): Promise<void> {
  const followersUrl = `${solidStorageBaseUrl}followers/`

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
      console.log(`[inbox] Removed ${followerActor} from followers collection`)
      return
    }

    const nextPageUrl = await getNextPageUrl(pageUrl, fetch)
    pageUrl = nextPageUrl
  }

  throw new Error(`Could not find follower ${followerActor} in followers collection`)
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

  const actorQuads = store.getQuads(
    null,
    'https://www.w3.org/ns/activitystreams#actor',
    followerActor,
    null
  )

  if (actorQuads.length === 0) {
    return false
  }

  const entrySubject = actorQuads[0].subject.value
  const entryQuads = store.getQuads(entrySubject, null, null, null)

  if (entryQuads.length === 0) {
    return false
  }

  const itemTurtle = entryQuads.map(q => {
    const subject = `<${q.subject.value}>`
    const predicate = `<${q.predicate.value}>`
    const object = q.object instanceof NamedNode
      ? `<${q.object.value}>`
      : `"${q.object.value}"`
    return `${subject} ${predicate} ${object}.`
  }).join('\n')

  const patchBody = buildDeletePatch(itemTurtle, entrySubject, pageUrl)

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
      accept: 'text/timeline',
    },
  })

  if (!response.ok) {
    return null
  }

  const text = await response.text()
  const nextPageMatch = text.match(/<[^>]*>\s+<https:\/\/www\.w3\.org\/ns\/activitystreams#next>\s+<([^>]+)>/)

  return nextPageMatch ? nextPageMatch[1] : null
}

import type { SolidFetch } from '../types.js'
import { buildDeletePatch } from './buildPatch.js'
import { parseCollectionTurtle } from './rdfUtils.js'

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
  const lines = text.split('\n')
  const entryLines: string[] = []
  let entrySubject: string | null = null
  let isInEntry = false
  let foundActorTriple = false

  for (const line of lines) {
    const actorPattern = `<https://www.w3.org/ns/activitystreams#actor> <${followerActor}>`
    if (line.includes(actorPattern)) {
      const subjectMatch = line.match(/^<([^>]+)>/)
      if (subjectMatch) {
        entrySubject = subjectMatch[1]
        isInEntry = true
        foundActorTriple = true
      }
    }

    if (isInEntry) {
      entryLines.push(line)
      if (line.trim().endsWith('.')) {
        if (foundActorTriple) {
          const itemTurtle = entryLines.join('\n')
          const itemId = entrySubject || `${followerActor}/follow/0`

          const patchBody = buildDeletePatch(itemTurtle, itemId, pageUrl)

          const deleteResponse = await fetch(pageUrl, {
            method: 'PATCH',
            headers: {
              'content-type': 'text/n3',
            },
            body: patchBody,
          })

          if (deleteResponse.ok) {
            return true
          }
        }
        entryLines.length = 0
        entrySubject = null
        isInEntry = false
        foundActorTriple = false
      }
    }
  }

  return false
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

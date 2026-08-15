import type { SolidFetch } from '../types.js'
import { Parser, Store } from 'n3'

export async function getFollowers(
  solidStorageBaseUrl: string,
  actorName: string,
  fetch: SolidFetch
): Promise<string[]> {
  const followersUrl = `${solidStorageBaseUrl}${actorName}/followers/`

  let firstPageUrl: string | null = null

  try {
    const response = await fetch(followersUrl, {
      method: 'GET',
      headers: {
        accept: 'text/turtle',
      },
    })

    if (!response.ok) {
      console.warn(`[getFollowers] Failed to fetch followers collection: ${response.status}`)
      return []
    }

    const text = await response.text()
    firstPageUrl = getFirstPageUrl(text, followersUrl)
  } catch (error) {
    console.warn(`[getFollowers] Could not fetch followers collection: ${error}`)
    return []
  }

  if (!firstPageUrl) {
    return []
  }

  const followers: string[] = []
  let currentPageUrl: string | null = firstPageUrl

  while (currentPageUrl) {
    const pageResult = await getFollowersFromPage(currentPageUrl, fetch)
    followers.push(...pageResult.followers)
    currentPageUrl = pageResult.nextPageUrl
  }

  return followers
}

function getFirstPageUrl(turtle: string, followersUrl: string): string | null {
  const parser = new Parser({ baseIRI: followersUrl })
  const store = new Store()
  const quads = parser.parse(turtle)
  if (quads) {
    store.addQuads(quads)
  }

  const firstQuads = store.getQuads(
    followersUrl,
    'https://www.w3.org/ns/activitystreams#first',
    null,
    null
  )

  if (firstQuads.length === 0) {
    return null
  }

  return firstQuads[0].object.value
}

interface PageFollowers {
  followers: string[]
  nextPageUrl: string | null
}

async function getFollowersFromPage(
  pageUrl: string,
  fetch: SolidFetch
): Promise<PageFollowers> {
  const response = await fetch(pageUrl, {
    method: 'GET',
    headers: {
      accept: 'text/turtle',
    },
  })

  if (!response.ok) {
    return { followers: [], nextPageUrl: null }
  }

  const text = await response.text()
  return parseFollowersPage(text, pageUrl)
}

function parseFollowersPage(turtle: string, pageUrl: string): PageFollowers {
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

  const actorQuads = store.getQuads(
    null,
    'https://www.w3.org/ns/activitystreams#actor',
    null,
    null
  )

  const followers = actorQuads.map(q => q.object.value)

  return { followers, nextPageUrl }
}
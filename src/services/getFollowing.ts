import type { SolidFetch } from '../types.js'
import { Parser, Store } from 'n3'

export async function getFollowing(
  solidStorageBaseUrl: string,
  actorName: string,
  fetch: SolidFetch
): Promise<string[]> {
  const followingUrl = `${solidStorageBaseUrl}${actorName}/following/`

  let firstPageUrl: string | null = null

  try {
    const response = await fetch(followingUrl, {
      method: 'GET',
      headers: {
        accept: 'text/turtle',
      },
    })

    if (!response.ok) {
      console.warn(`[getFollowing] Failed to fetch following collection: ${response.status}`)
      return []
    }

    const text = await response.text()
    firstPageUrl = getFirstPageUrl(text, followingUrl)
  } catch (error) {
    console.warn(`[getFollowing] Could not fetch following collection: ${error}`)
    return []
  }

  if (!firstPageUrl) {
    return []
  }

  const following: string[] = []
  let currentPageUrl: string | null = firstPageUrl

  while (currentPageUrl) {
    const pageResult = await getFollowingFromPage(currentPageUrl, fetch)
    following.push(...pageResult.followers)
    currentPageUrl = pageResult.nextPageUrl
  }

  return following
}

function getFirstPageUrl(turtle: string, followingUrl: string): string | null {
  const parser = new Parser({ baseIRI: followingUrl })
  const store = new Store()
  const quads = parser.parse(turtle)
  if (quads) {
    store.addQuads(quads)
  }

  const firstQuads = store.getQuads(
    followingUrl,
    'https://www.w3.org/ns/activitystreams#first',
    null,
    null
  )

  if (firstQuads.length === 0) {
    return null
  }

  return firstQuads[0].object.value
}

interface PageFollowing {
  followers: string[]
  nextPageUrl: string | null
}

async function getFollowingFromPage(
  pageUrl: string,
  fetch: SolidFetch
): Promise<PageFollowing> {
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
  return parseFollowingPage(text, pageUrl)
}

function parseFollowingPage(turtle: string, pageUrl: string): PageFollowing {
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

  const followers = itemsQuads.map(q => q.object.value)

  return { followers, nextPageUrl }
}

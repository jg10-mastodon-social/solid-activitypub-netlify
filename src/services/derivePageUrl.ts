import type { SolidFetch } from '../types.js'
import { parseCollectionTurtle } from './rdfUtils.js'
import { getPageInfo } from './getPageInfo.js'
import { createPage } from './createPage.js'
import { updateCollectionFirst } from './updateInbox.js'
import { updatePageNext } from './updatePageNext.js'

function generatePageUrl(inboxUrl: string): string {
  const timestamp = Date.now()
  return `${inboxUrl}pages/${timestamp}`
}

export async function derivePageUrl(
  inboxUrl: string,
  fetch: SolidFetch
): Promise<string> {
  if (!inboxUrl.endsWith('/')) throw new Error('Inbox url should end with /')

  let firstPageUrl: string | null = null

  try {
    const inboxResponse = await fetch(inboxUrl, {
      method: 'GET',
      headers: {
        accept: 'text/turtle',
      },
    })

    if (inboxResponse.ok) {
      const inboxText = await inboxResponse.text()
      const collection = await parseCollectionTurtle(inboxText, inboxUrl)
      if (collection && collection.first) {
        firstPageUrl = collection.first
      }
    }
  } catch (error) {
    console.warn(`[derivePageUrl] Could not fetch inbox collection: ${error}`)
  }

  if (firstPageUrl) {
    try {
      const pageInfo = await getPageInfo(firstPageUrl, fetch)
      if (!pageInfo.isFull) {
        return firstPageUrl
      }
    } catch (error) {
      console.warn(`[derivePageUrl] Could not check page info: ${error}`)
    }
  }

  const newPageUrl = generatePageUrl(inboxUrl)

  try {
    await createPage(newPageUrl, inboxUrl, fetch, firstPageUrl ?? undefined)
    console.log(`[derivePageUrl] Created new page ${newPageUrl}`)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Already exists')) {
      return newPageUrl
    }
    throw new Error(`Failed to create page ${newPageUrl}: ${error}`)
  }

  if (firstPageUrl) {
    try {
      await updatePageNext(firstPageUrl, newPageUrl, fetch)
      console.log(`[derivePageUrl] Added next link on ${firstPageUrl} to ${newPageUrl}`)
    } catch (error) {
      console.warn(`[derivePageUrl] Could not update page next link: ${error}`)
    }
  }

  try {
    await updateCollectionFirst(inboxUrl, newPageUrl, fetch)
    console.log(`[derivePageUrl] Updated inbox first link to ${newPageUrl}`)
  } catch (error) {
    console.warn(`[derivePageUrl] Could not update inbox first link: ${error}`)
  }

  return newPageUrl
}

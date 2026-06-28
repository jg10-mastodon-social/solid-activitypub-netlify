import type { SolidFetch } from '../types.js'

export async function createPage(
  pageUrl: string,
  inboxUrl: string,
  fetch: SolidFetch,
  prevPageUrl?: string
): Promise<void> {
  let body = `@prefix as: <https://www.w3.org/ns/activitystreams#>.
<${pageUrl}> a as:OrderedCollectionPage;
  as:partOf <${inboxUrl}>.`

  if (prevPageUrl) {
    body += `\n  as:prev <${prevPageUrl}>.`
  } else {
    body += '.'
  }

  const response = await fetch(pageUrl, {
    method: 'PUT',
    headers: {
      'content-type': 'text/turtle',
    },
    body,
  })

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error('Already exists')
    }
    const text = await response.text()
    throw new Error(`Failed to create page ${pageUrl}: ${response.status} ${text}`)
  }
}

import type { SolidFetch } from '../types.js'
import { Parser, Store } from 'n3'

const AS_CONTEXT = 'https://www.w3.org/ns/activitystreams'

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

export async function serializeFollowingPage(
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

import type { SolidFetch } from '../types.js'
import { parseFollowersRoot } from './rdfUtils.js'

const AS_CONTEXT = 'https://www.w3.org/ns/activitystreams'

function rewriteUrl(podUrl: string, podRootUrl: string, publicRootUrl: string): string {
  const podPrefix = podRootUrl.replace(/\/$/, '') + '/'
  if (podUrl === podRootUrl) return publicRootUrl
  if (podUrl.startsWith(podPrefix)) {
    return publicRootUrl + podUrl.slice(podPrefix.length - 1)
  }
  return podUrl
}

export async function serializeFollowersCollection(
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
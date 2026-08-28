import type { SolidFetch } from '../types.js'
import { serializePage } from './collection.js'

export async function serializeInboxPage(
  fetchFn: SolidFetch,
  podPageUrl: string,
  podRootUrl: string,
  publicRootUrl: string
): Promise<Response> {
  return serializePage('inbox', fetchFn, podPageUrl, podRootUrl, publicRootUrl)
}

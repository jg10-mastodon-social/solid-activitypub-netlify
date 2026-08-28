import type { SolidFetch } from '../types.js'
import { serializePage } from './collection.js'

export async function serializeOutboxPage(
  fetchFn: SolidFetch,
  podPageUrl: string,
  podRootUrl: string,
  publicRootUrl: string
): Promise<Response> {
  return serializePage('outbox', fetchFn, podPageUrl, podRootUrl, publicRootUrl)
}

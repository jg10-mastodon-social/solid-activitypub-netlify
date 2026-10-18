import type { SolidFetch } from '../types.js'

async function putCollectionRoot(
  collectionUrl: string,
  fetch: SolidFetch
): Promise<void> {
  const rootDocument = `@prefix as: <https://www.w3.org/ns/activitystreams#>.
<${collectionUrl}> a as:OrderedCollection;
  as:totalItems 0.`

  const response = await fetch(collectionUrl, {
    method: 'PUT',
    headers: { 'content-type': 'text/turtle' },
    body: rootDocument,
  })

  if (response.ok || response.status === 409 || response.status === 412) {
    return
  }

  let detail = ''
  try {
    detail = await response.text()
  } catch {
    detail = ''
  }
  throw new Error(`Failed to create collection root ${collectionUrl}: ${response.status} ${detail}`)
}

export async function ensureCollectionRoot(
  collectionUrl: string,
  fetch: SolidFetch
): Promise<void> {
  const response = await fetch(collectionUrl, {
    headers: { accept: 'text/turtle' },
  })

  if (response.ok) {
    return
  }

  if (response.status !== 404) {
    throw new Error(`Failed to check collection root ${collectionUrl}: ${response.status}`)
  }

  await putCollectionRoot(collectionUrl, fetch)
}

export async function readCollectionRoot(
  collectionUrl: string,
  fetch: SolidFetch
): Promise<string | null> {
  const response = await fetch(collectionUrl, {
    headers: { accept: 'text/turtle' },
  })

  if (response.ok) {
    return response.text()
  }

  if (response.status !== 404) {
    throw new Error(`Failed to check collection root ${collectionUrl}: ${response.status}`)
  }

  await putCollectionRoot(collectionUrl, fetch)
  return null
}

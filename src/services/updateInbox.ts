import type { SolidFetch } from '../types.js'

export async function updateInboxFirst(
  inboxUrl: string,
  firstPageUrl: string,
  fetch: SolidFetch
): Promise<void> {
  const patchBody = `@prefix as: <https://www.w3.org/ns/activitystreams#>.
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
_:patch a solid:InsertDeletePatch;
  solid:deletes { <${inboxUrl}> as:first ?old. };
  solid:inserts { <${inboxUrl}> as:first <${firstPageUrl}>. }.`

  const response = await fetch(inboxUrl, {
    method: 'PATCH',
    headers: {
      'content-type': 'text/n3',
    },
    body: patchBody,
  })

  if (!response.ok) {
    throw new Error(`Failed to update inbox first pointer: ${response.status}`)
  }
}

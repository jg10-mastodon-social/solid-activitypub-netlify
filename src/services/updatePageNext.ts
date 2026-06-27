import type { SolidFetch } from '../types.js'

export async function updatePageNext(
  pageUrl: string,
  nextPageUrl: string,
  fetch: SolidFetch
): Promise<void> {
  const patchBody = `@prefix as: <https://www.w3.org/ns/activitystreams#>.
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
_:patch a solid:InsertDeletePatch;
  solid:deletes { <${pageUrl}> as:next ?old. };
  solid:inserts { <${pageUrl}> as:next <${nextPageUrl}>. }.`

  const response = await fetch(pageUrl, {
    method: 'PATCH',
    headers: {
      'content-type': 'text/n3',
    },
    body: patchBody,
  })

  if (!response.ok) {
    throw new Error(`Failed to update page next link: ${response.status}`)
  }
}

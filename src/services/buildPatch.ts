export const INSERT_DELETE_PATCH_PREFIX = `@prefix as: <https://www.w3.org/ns/activitystreams#>.
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
`

export function buildInsertDeletePatch(
  itemTurtle: string,
  itemId: string,
  pageUrl: string
): string {
  const patch = `${INSERT_DELETE_PATCH_PREFIX}
      _:patch a solid:InsertDeletePatch;
      solid:inserts {
			      <${pageUrl}> as:items <${itemId}>.
       ${itemTurtle}
     }.
`
  return patch
}

export function buildUpdatePatch(
  oldTurtle: string,
  newTurtle: string,
  itemId: string,
  pageUrl: string
): string {
  const patch = `${INSERT_DELETE_PATCH_PREFIX}
      _:patch a solid:InsertDeletePatch;
      solid:deletes {
		      <${pageUrl}> as:items <${itemId}>.
       ${oldTurtle}
     };
      solid:inserts {
		      <${pageUrl}> as:items <${itemId}>.
       ${newTurtle}
     }.
`
  return patch
}

export function buildDeletePatch(
  itemTurtle: string,
  itemId: string,
  pageUrl: string
): string {
  const patch = `${INSERT_DELETE_PATCH_PREFIX}
      _:patch a solid:InsertDeletePatch;
      solid:deletes {
		      <${pageUrl}> as:items <${itemId}>.
       ${itemTurtle}
     }.
`
  return patch
}

export function buildInsertItemLinkPatch(
  pageUrl: string,
  itemUri: string
): string {
  return `${INSERT_DELETE_PATCH_PREFIX}
      _:patch a solid:InsertDeletePatch;
      solid:inserts {
        <${pageUrl}> as:items <${itemUri}>.
      }.
`
}

export function buildDeleteItemLinkPatch(
  pageUrl: string,
  itemUri: string
): string {
  return `${INSERT_DELETE_PATCH_PREFIX}
      _:patch a solid:InsertDeletePatch;
      solid:deletes {
        <${pageUrl}> as:items <${itemUri}>.
      }.
  `
}

export function buildUpdateLiteralPatch(
  subject: string,
  predicate: string,
  oldLiteralTurtle: string,
  newLiteralTurtle: string
): string {
  void subject
  void predicate
  return `${INSERT_DELETE_PATCH_PREFIX}
      _:patch a solid:InsertDeletePatch;
      solid:deletes {
        ${oldLiteralTurtle}
      };
      solid:inserts {
        ${newLiteralTurtle}
      }.
  `
}

import { Parser, Store, Writer, DataFactory, Quad } from 'n3'

export type Collection = 'inbox' | 'outbox' | 'followers' | 'following'

export function rewriteBody(
  body: string,
  solidStorageBaseUrl: string,
  baseUrl: string,
  actorName: string,
  collection: Collection,
  podResourceUrl?: string,
  stripTrailingSlash = false
): string {
  const podBase = `${solidStorageBaseUrl}${actorName}/${collection}`.replace(/\/$/, '')
  const publicBase = `${baseUrl}/${actorName}/${collection}`
  const podBaseIri = podResourceUrl ?? `${solidStorageBaseUrl}${actorName}/${collection}/`

  const finalize = (output: string): string =>
    stripTrailingSlash ? output.replaceAll(`<${publicBase}/>`, `<${publicBase}>`) : output

  try {
    const parser = new Parser({ baseIRI: podBaseIri })
    const store = new Store()
    const quads = parser.parse(body)
    if (!quads || quads.length === 0) {
      return finalize(body.replaceAll(podBase, publicBase))
    }
    for (const q of quads) store.addQuads([q])

    const rewriteIri = (iri: string): string =>
      iri === podBase || iri.startsWith(podBase + '/')
        ? publicBase + iri.slice(podBase.length)
        : iri

    const writer = new Writer({ format: 'turtle' })
    const rewritten: Quad[] = []
    for (const q of store.getQuads(null, null, null, null)) {
      const subj = DataFactory.namedNode(rewriteIri(q.subject.value))
      const pred = q.predicate
      const obj = q.object.termType === 'NamedNode'
        ? DataFactory.namedNode(rewriteIri(q.object.value))
        : q.object
      rewritten.push(DataFactory.quad(subj, pred, obj, q.graph))
    }
    return finalize(writer.quadsToString(rewritten))
  } catch {
    return finalize(body.replaceAll(podBase, publicBase))
  }
}

import type { ActorRecord } from './registry.js'

const AS_PREFIX = '@prefix as: <https://www.w3.org/ns/activitystreams> .'

export function serializeActorList(actors: ActorRecord[], baseUrl: string): string {
  const enabled = actors
    .filter((actor) => !actor.disabled)
    .sort((a, b) => a.name.localeCompare(b.name))

  const lines = [
    AS_PREFIX,
    '',
    `<${baseUrl}/actors> a as:Collection;`,
    `  as:totalItems ${enabled.length}${enabled.length > 0 ? ';' : '.'}`
  ]

  if (enabled.length > 0) {
    const items = enabled.map((actor) => `<${baseUrl}/${actor.name}>`).join(', ')
    lines.push(`  as:items ${items}.`)
  }

  return `${lines.join('\n')}\n`
}

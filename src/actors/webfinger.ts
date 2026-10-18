import type { ActorRegistry } from './registry.ts'

export interface WebFingerLink {
  rel: string
  type: string
  href: string
}

export interface WebFingerEntry {
  subject: string
  aliases: string[]
  links: WebFingerLink[]
}

function stripScheme(baseUrl: string): string {
  return baseUrl.replace(/^https?:\/\//, '')
}

export async function resolveWebFinger(
  resource: string,
  baseUrl: string,
  registry: ActorRegistry
): Promise<WebFingerEntry | null> {
  const match = /^acct:([^@]+)@(.+)$/i.exec(resource)
  if (match === null) return null

  const name = match[1]
  const domain = match[2]
  if (domain.toLowerCase() !== stripScheme(baseUrl).toLowerCase()) return null

  const actor = await registry.getActor(name)
  if (actor === null || actor.disabled === true) return null

  const actorUrl = `${baseUrl}/${name}`
  return {
    subject: resource,
    aliases: [actorUrl],
    links: [{ rel: 'self', type: 'application/activity+json', href: actorUrl }]
  }
}

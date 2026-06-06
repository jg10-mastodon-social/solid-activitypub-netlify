import type { SolidFetch } from './types.js'

export interface Activity {
  type: string
  actor?: string
  to?: string | string[]
  cc?: string | string[]
  bto?: string | string[]
  bcc?: string | string[]
  audience?: string | string[]
  object?: unknown
  id?: string
  published?: string
  [key: string]: unknown
}

export type ActivityRecipient = string

const PUBLIC_IRI = 'https://www.w3.org/ns/activitystreams#Public'

function normalizeToArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  return [value]
}

export function extractRecipients(activity: Activity): ActivityRecipient[] {
  const recipients = new Set<string>()

  const fields: (keyof Activity)[] = ['to', 'cc', 'bto', 'bcc', 'audience']

  for (const field of fields) {
    const values = normalizeToArray(activity[field] as string | string[] | undefined)
    for (const value of values) {
      if (value === 'Public' || value === PUBLIC_IRI || value === 'as:Public') {
        continue
      }
      if (value.startsWith('http')) {
        recipients.add(value)
      }
    }
  }

  return Array.from(recipients)
}

export async function fetchActorInbox(
  actorUrl: string,
  fetchFn: SolidFetch
): Promise<string> {
  const response = await fetchFn(actorUrl, {
    headers: { accept: 'application/activity+json, application/ld+json, application/json' }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch actor document: ${response.status}`)
  }

  const actor = await response.json()

  if (!actor.inbox) {
    throw new Error('Actor inbox not found')
  }

  return actor.inbox
}

export function validateActivityActor(activity: Activity, expectedActor: string): boolean {
  if (!activity.actor) {
    throw new Error('Activity actor missing')
  }

  if (activity.actor !== expectedActor) {
    throw new Error(`Actor mismatch: expected ${expectedActor}, got ${activity.actor}`)
  }

  return true
}
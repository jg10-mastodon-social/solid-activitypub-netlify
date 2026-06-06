import type { SolidFetch } from './types.js'
// @ts-ignore
import { baseUrl } from './base-url.js'

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
  '@context'?: string | string[]
  [key: string]: unknown
}

export type ActivityRecipient = string

const PUBLIC_IRI = 'https://www.w3.org/ns/activitystreams#Public'

function toIso8601(date: Date): string {
  return date.toISOString()
}

export function validateContext(activity: Activity): boolean {
  if (!activity['@context']) {
    throw new Error('Activity must include @context')
  }
  return true
}

export function normalizeActivity(activity: Activity): Activity {
  return {
    ...activity,
    id: `${baseUrl}/activities/${Date.now()}`,
    published: activity.published || toIso8601(new Date())
  }
}

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
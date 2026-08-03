import { createHash } from 'node:crypto'

import type { SolidFetch } from './types.js'
import { isBlockedUrl } from './ssrf.js'

export interface ParsedSignature {
  keyId: string
  algorithm: string
  headers: string
  signature: string
}

export function parseSignatureHeader(header: string): ParsedSignature {
  const result: Partial<ParsedSignature> = {}

  const keyIdMatch = header.match(/keyId="([^"]+)"/)
  if (!keyIdMatch) {
    throw new Error('Missing keyId in Signature header')
  }
  result.keyId = keyIdMatch[1]

  const algorithmMatch = header.match(/algorithm="([^"]+)"/)
  if (!algorithmMatch) {
    throw new Error('Missing algorithm in Signature header')
  }
  result.algorithm = algorithmMatch[1]

  const headersMatch = header.match(/headers="([^"]+)"/)
  if (!headersMatch) {
    throw new Error('Missing headers in Signature header')
  }
  result.headers = headersMatch[1]

  const signatureMatch = header.match(/signature="([^"]+)"/)
  if (!signatureMatch) {
    throw new Error('Missing signature in Signature header')
  }
  result.signature = signatureMatch[1]

  return result as ParsedSignature
}

const ALLOWED_ALGORITHMS = [
  'rsa-sha256',
  'rsa-v1_5-sha256',
  'hs2019',
  'rsa-pss-sha512',
  'ecdsa-p256-sha256',
  'ed25519'
]

export function isAllowedAlgorithm(algorithm: string): boolean {
  return ALLOWED_ALGORITHMS.includes(algorithm)
}

const MAX_AGE_SECONDS = 5 * 60
const MAX_FUTURE_SECONDS = 1 * 60

export function validateTimestamp(dateHeader: string): boolean {
  if (!dateHeader) return false

  const date = new Date(dateHeader)
  if (isNaN(date.getTime())) return false

  const now = Math.floor(Date.now() / 1000)
  const dateTimestamp = Math.floor(date.getTime() / 1000)
  const age = now - dateTimestamp

  if (age > MAX_AGE_SECONDS) return false
  if (age < -MAX_FUTURE_SECONDS) return false

  return true
}

export function verifyDigest(body: string, digestHeader: string): boolean {
  if (!digestHeader) return false

  const match = digestHeader.match(/^SHA-256=(.+)$/i)
  if (!match) return false

  const expectedHash = match[1]
  const actualHash = createHash('sha256').update(body, 'utf8').digest('base64')

  return actualHash === expectedHash
}

export interface ActorKeyResult {
  actorUrl: string
  keyId: string
  publicKeyPem: string
}

export async function fetchActorPublicKey(
  actorUrl: string,
  fetchFn: SolidFetch
): Promise<ActorKeyResult> {
  if (isBlockedUrl(actorUrl)) {
    throw new Error('SSRF: Actor URL points to private network')
  }

  const response = await fetchFn(actorUrl, {
    headers: { accept: 'application/activity+json, application/ld+json, application/json' }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch actor: ${response.status}`)
  }

  const actor = await response.json() as Record<string, unknown>

  if (!actor.publicKey || typeof actor.publicKey !== 'object') {
    throw new Error('Actor document missing publicKey')
  }

  const publicKey = actor.publicKey as Record<string, unknown>
  const keyId = publicKey.id as string
  const publicKeyPem = publicKey.publicKeyPem as string

  if (!keyId || !publicKeyPem) {
    throw new Error('Actor publicKey missing id or publicKeyPem')
  }

  return { actorUrl, keyId, publicKeyPem }
}
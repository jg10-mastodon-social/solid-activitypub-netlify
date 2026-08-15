import { createHash, createVerify } from 'node:crypto'

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

export type DigestResult =
  | { match: true }
  | { match: false; expected: string; actual: string; bodyLength: number }

export function verifyDigest(rawBody: ArrayBuffer | Uint8Array, digestHeader: string): DigestResult {
  if (!digestHeader) {
    return { match: false, expected: '', actual: '', bodyLength: bodyByteLength(rawBody) }
  }

  const match = digestHeader.match(/^SHA-256=(.+)$/i)
  if (!match) {
    return { match: false, expected: '', actual: '', bodyLength: bodyByteLength(rawBody) }
  }

  const expectedHash = match[1]
  const bytes = rawBody instanceof ArrayBuffer ? Buffer.from(rawBody) : Buffer.from(rawBody.buffer, rawBody.byteOffset, rawBody.byteLength)
  const actualHash = createHash('sha256').update(bytes).digest('base64')

  if (actualHash === expectedHash) {
    return { match: true }
  }
  return { match: false, expected: expectedHash, actual: actualHash, bodyLength: bytes.byteLength }
}

function bodyByteLength(rawBody: ArrayBuffer | Uint8Array): number {
  if (rawBody instanceof ArrayBuffer) return rawBody.byteLength
  return rawBody.byteLength
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
    const err = new Error(`Failed to fetch actor: ${response.status}`)
    ;(err as Error & { actorFetchStatus?: number }).actorFetchStatus = response.status
    throw err
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

export function buildSignatureBase(headers: Record<string, string>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(headers)) {
    lines.push(`${key}: ${value}`)
  }
  return lines.join('\n')
}

export async function verifySignature(
  publicKeyPem: string,
  algorithm: string,
  signingString: string,
  signatureBase64: string
): Promise<boolean> {
  try {
    const algorithmMap: Record<string, string> = {
      'rsa-sha256': 'RSA-SHA256',
      'rsa-v1_5-sha256': 'RSA-SHA256',
      'hs2019': 'RSA-SHA256'
    }

    const verifyAlgorithm = algorithmMap[algorithm.toLowerCase()] || algorithm
    const verify = createVerify(verifyAlgorithm)
    verify.update(signingString)
    verify.end()
    return verify.verify(publicKeyPem, signatureBase64, 'base64')
  } catch {
    return false
  }
}

export function verifyActorBinding(
  activity: Record<string, unknown>,
  keyId: string
): boolean {
  const activityActor = activity.actor as string | undefined
  if (!activityActor) return false

  const keyIdActor = keyId.split('#')[0]
  return activityActor === keyIdActor
}
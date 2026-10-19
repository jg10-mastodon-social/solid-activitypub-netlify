import { createHash, createSign, createPrivateKey } from 'node:crypto'
import type { SolidFetch } from './types.js'
import { openActorRegistry } from './actors/registry.js'
import { openActorKeys, type ActorKeys } from './actors/keys.js'

let actorKeysProvider: ActorKeys | null = null

function getActorKeysProvider(): ActorKeys {
  if (actorKeysProvider === null) {
    actorKeysProvider = openActorKeys(openActorRegistry())
  }
  return actorKeysProvider
}

export function buildSigningString(
  method: string,
  path: string,
  host: string,
  date: string,
  digest: string,
  contentType: string
): string {
  const lines = [
    `(request-target): ${method.toLowerCase()} ${path}`,
    `host: ${host}`,
    `date: ${date}`,
    `digest: ${digest}`,
    `content-type: ${contentType}`
  ]
  return lines.join('\n')
}

export function buildActorFetchSigningString(
  method: string,
  path: string,
  host: string,
  date: string
): string {
  const lines = [
    `(request-target): ${method.toLowerCase()} ${path}`,
    `host: ${host}`,
    `date: ${date}`
  ]
  return lines.join('\n')
}

export function createSignatureHeader(keyId: string, signatureBase64: string): string {
  return `keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="${signatureBase64}"`
}

export function createActorFetchSignatureHeader(keyId: string, signatureBase64: string): string {
  return `keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) host date",signature="${signatureBase64}"`
}

function computeDigest(body: string): string {
  const hash = createHash('sha256').update(body, 'utf8').digest('base64')
  return `SHA-256=${hash}`
}

function formatDate(date: Date): string {
  return date.toUTCString()
}

function importPrivateKey(jwk: Record<string, unknown>): ReturnType<typeof createPrivateKey> {
  return createPrivateKey({
    key: jwk,
    format: 'jwk'
  })
}

export interface ActorFetchSigner {
  keyId: string
  actorUrl: string
  baseUrl: string
}

function actorNameFromActorUrl(actorUrl: string, baseUrl: string): string {
  const prefix = `${baseUrl}/`
  if (!actorUrl.startsWith(prefix)) {
    throw new Error(`Actor URL ${actorUrl} is not under base URL ${baseUrl}`)
  }
  return actorUrl.slice(prefix.length)
}

export async function resolveActorPrivateKey(
  actorName: string
): Promise<Record<string, unknown>> {
  return getActorKeysProvider().getPrivateKeyJwk(actorName)
}

export async function signActivityRequest(
  inboxUrl: string,
  activityBody: string,
  keyId: string,
  actorUrl: string,
  baseUrl: string,
  fetchFn: SolidFetch
): Promise<Response> {
  const actorName = actorNameFromActorUrl(actorUrl, baseUrl)
  const privateKey = await resolveActorPrivateKey(actorName)

  const url = new URL(inboxUrl)
  const method = 'POST'
  const path = url.pathname + url.search
  const host = url.host
  const date = formatDate(new Date())
  const digest = computeDigest(activityBody)
  const contentType = 'application/activity+json'

  const signingString = buildSigningString(method, path, host, date, digest, contentType)

  const privateKeyObject = importPrivateKey(privateKey)
  const sign = createSign('RSA-SHA256')
  sign.update(signingString)
  sign.end()
  const signatureBase64 = sign.sign(privateKeyObject, 'base64')

  const signatureHeader = createSignatureHeader(keyId, signatureBase64)

  return fetchFn(inboxUrl, {
    method,
    headers: {
      'Content-Type': contentType,
      'Host': host,
      'Date': date,
      'Digest': digest,
      'Signature': signatureHeader,
      'Accept': 'application/activity+json, application/ld+json'
    },
    body: activityBody
  })
}

export async function signActorFetchRequest(
  actorUrl: string,
  keyId: string,
  localActorUrl: string,
  baseUrl: string,
  fetchFn: SolidFetch
): Promise<Response> {
  const actorName = actorNameFromActorUrl(localActorUrl, baseUrl)
  const privateKey = await resolveActorPrivateKey(actorName)

  const url = new URL(actorUrl)
  const method = 'GET'
  const path = url.pathname + url.search
  const host = url.host
  const date = formatDate(new Date())

  const signingString = buildActorFetchSigningString(method, path, host, date)

  const privateKeyObject = importPrivateKey(privateKey)
  const sign = createSign('RSA-SHA256')
  sign.update(signingString)
  sign.end()
  const signatureBase64 = sign.sign(privateKeyObject, 'base64')

  const signatureHeader = createActorFetchSignatureHeader(keyId, signatureBase64)

  return fetchFn(actorUrl, {
    method,
    headers: {
      'Host': host,
      'Date': date,
      'Signature': signatureHeader,
      'Accept': 'application/activity+json, application/ld+json'
    }
  })
}
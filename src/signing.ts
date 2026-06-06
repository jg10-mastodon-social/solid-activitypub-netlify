import { createHash, createSign, createPrivateKey } from 'node:crypto'
import type { SolidFetch } from './types.js'
// @ts-ignore
import { actorPrivateKey } from './actor-private-key.js'

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

export function createSignatureHeader(keyId: string, signatureBase64: string): string {
  return `keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="${signatureBase64}"`
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

export async function signActivityRequest(
  inboxUrl: string,
  activityBody: string,
  keyId: string,
  fetchFn: SolidFetch
): Promise<Response> {
  const url = new URL(inboxUrl)
  const method = 'POST'
  const path = url.pathname + url.search
  const host = url.host
  const date = formatDate(new Date())
  const digest = computeDigest(activityBody)
  const contentType = 'application/activity+json'

  const signingString = buildSigningString(method, path, host, date, digest, contentType)

  const privateKey = importPrivateKey(actorPrivateKey)
  const sign = createSign('RSA-SHA256')
  sign.update(signingString)
  sign.end()
  const signatureBase64 = sign.sign(privateKey, 'base64')

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
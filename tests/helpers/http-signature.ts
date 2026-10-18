import { createHash, createSign, generateKeyPairSync } from 'node:crypto'

export interface RemoteActorKeys {
  actorUrl: string
  keyId: string
  publicKeyPem: string
  privateKeyPem: string
}

export function createRemoteActorKeys(actorUrl: string): RemoteActorKeys {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })

  return {
    actorUrl,
    keyId: `${actorUrl}#main-key`,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
  }
}

export function buildActorDocument(
  keys: RemoteActorKeys,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
    id: keys.actorUrl,
    type: 'Service',
    inbox: `${keys.actorUrl}/inbox`,
    publicKey: {
      id: keys.keyId,
      owner: keys.actorUrl,
      publicKeyPem: keys.publicKeyPem
    },
    ...overrides
  }
}

export function signActivityRequest(
  url: string,
  activity: unknown,
  keys: RemoteActorKeys,
  options: { contentType?: string } = {}
): { body: string; headers: Record<string, string> } {
  const contentType = options.contentType ?? 'application/activity+json'
  const body = JSON.stringify(activity)
  const parsed = new URL(url)
  const date = new Date().toUTCString()
  const digest = `SHA-256=${createHash('sha256').update(body, 'utf8').digest('base64')}`

  const signingString = [
    `(request-target): post ${parsed.pathname}${parsed.search}`,
    `host: ${parsed.host}`,
    `date: ${date}`,
    `digest: ${digest}`,
    `content-type: ${contentType}`
  ].join('\n')

  const sign = createSign('RSA-SHA256')
  sign.update(signingString)
  sign.end()
  const signature = sign.sign(keys.privateKeyPem, 'base64')

  return {
    body,
    headers: {
      'content-type': contentType,
      'date': date,
      'digest': digest,
      'signature': `keyId="${keys.keyId}",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="${signature}"`
    }
  }
}

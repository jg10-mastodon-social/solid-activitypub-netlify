import type { ActorConfig } from '../types.js'

function assertSolidStorageBaseUrl(solidStorageBaseUrl: string): void {
  if (!solidStorageBaseUrl.endsWith('/')) {
    throw new Error('SOLID_STORAGE_BASE_URL must end with /')
  }
}

export function derivePodBase(
  name: string,
  solidStorageBaseUrl: string
): string {
  assertSolidStorageBaseUrl(solidStorageBaseUrl)
  return `${solidStorageBaseUrl}${name}/`
}

export function deriveActorConfig(
  name: string,
  baseUrl: string,
  solidStorageBaseUrl: string
): ActorConfig {
  assertSolidStorageBaseUrl(solidStorageBaseUrl)
  const domain = baseUrl.replace(/^https?:\/\//, '')
  const url = `${baseUrl}/${name}`
  return {
    name,
    path: `/${name}`,
    url,
    keyId: `${url}#main-key`,
    inboxUrl: `${baseUrl}/${name}/inbox`,
    outboxUrl: `${baseUrl}/${name}/outbox`,
    followersUrl: `${baseUrl}/${name}/followers`,
    followingUrl: `${baseUrl}/${name}/following`,
    sharedInboxUrl: `${baseUrl}/inbox`,
    webfingerResource: `acct:${name}@${domain}`
  }
}

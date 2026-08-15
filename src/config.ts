import type { ActorConfig, Config } from './types.js'
// @ts-ignore
import { baseUrl } from './base-url.js'

export interface EnvConfig {
  WEBID: string
  ISSUER: string
  WHITELISTED_ISSUERS: string
  SOLID_STORAGE_BASE_URL: string
  SEND_TO_URL: string
  ADMIN_WEBID?: string
}

export function parseActorNames(raw: string | undefined): string[] {
  if (!raw) return ['actor']
  const names = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  if (names.length === 0) {
    throw new Error('ACTOR_NAME must contain at least one non-empty actor name')
  }
  return names
}

function buildActorConfigs(
  baseUrlValue: string,
  solidStorageBaseUrl: string,
  names: string[]
): Record<string, ActorConfig> {
  const domain = baseUrlValue.replace(/^https?:\/\//, '')
  const byPath: Record<string, ActorConfig> = {}
  for (const name of names) {
    const url = `${baseUrlValue}/${name}`
    byPath[`/${name}`] = {
      name,
      path: `/${name}`,
      url,
      keyId: `${url}#main-key`,
      inboxUrl: `${baseUrlValue}/${name}/inbox`,
      outboxUrl: `${baseUrlValue}/${name}/outbox`,
      followersUrl: `${baseUrlValue}/${name}/followers`,
      webfingerResource: `acct:${name}@${domain}`,
    }
  }
  return byPath
}

export function loadConfig(): Config {
  const whitelistedIssuersStr = process.env.WHITELISTED_ISSUERS
  if (!whitelistedIssuersStr) {
    throw new Error('WHITELISTED_ISSUERS is required')
  }
  if (!process.env.SOLID_STORAGE_BASE_URL) {
    throw new Error('SOLID_STORAGE_BASE_URL is required')
  }
  if (!process.env.SOLID_STORAGE_BASE_URL.endsWith('/')) {
    throw new Error('SOLID_STORAGE_BASE_URL must end with /')
  }

  const webId = process.env.WEBID || `${baseUrl}/webid`
  const issuer = process.env.ISSUER || baseUrl
  const outboxEndpoint = '/outbox'
  const sendToUrl = process.env.SEND_TO_URL || `${baseUrl}${outboxEndpoint}`
  const adminWebId = process.env.ADMIN_WEBID || ''
  const whitelistedIssuers = whitelistedIssuersStr.split(',').map((s) => s.trim())
  const solidStorageBaseUrl = process.env.SOLID_STORAGE_BASE_URL
  const inboxUrl = `${solidStorageBaseUrl}inbox/`
  const outboxUrl = `${solidStorageBaseUrl}outbox/`
  const actorNames = parseActorNames(process.env.ACTOR_NAME)
  const actorByPath = buildActorConfigs(baseUrl, solidStorageBaseUrl, actorNames)

  return {
    webId,
    issuer,
    baseUrl,
    outboxEndpoint,
    sendToUrl,
    whitelistedIssuers,
    solidStorageBaseUrl,
    adminWebId,
    inboxUrl,
    outboxUrl,
    actorNames,
    actorByPath,
  }
}
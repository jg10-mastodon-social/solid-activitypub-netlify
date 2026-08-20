export interface OutboxEvent {
  type: 'Add' | 'Remove' | 'Update'
  object: string
  topic: string
  raw: unknown
}

export type SolidFetch = (
  url: string | URL | Request,
  init?: RequestInit
) => Promise<Response>

export interface ActorConfig {
  name: string
  path: string
  url: string
  keyId: string
  inboxUrl: string
  outboxUrl: string
  followersUrl: string
  sharedInboxUrl: string
  webfingerResource: string
}

export interface Config {
  webId: string
  issuer: string
  baseUrl: string
  outboxEndpoint: string
  sendToUrl: string
  whitelistedIssuers: string[]
  solidStorageBaseUrl: string
  adminWebId: string
  inboxUrl: string
  outboxUrl: string
  actorNames: string[]
  actorByPath: Record<string, ActorConfig>
}

export interface TokenPayload {
  webid: string
  client_id: string
  iss: string
  iat: number
  exp: number
  cnf?: {
    jkt: string
  }
}
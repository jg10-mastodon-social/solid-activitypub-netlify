import type { ActorConfig } from '../../src/types.js'
import type { ActorResolver } from '../../src/actors/resolve.js'
import { deriveActorConfig } from '../../src/actors/config.js'

const BASE_URL = 'http://localhost:9999'
const SOLID_STORAGE_BASE_URL = 'http://localhost:9998/'
const FAKE_PUBLIC_KEY_PEM =
  '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtest\n-----END PUBLIC KEY-----\n'

export function createFakeResolver(): ActorResolver {
  const name = process.env.ACTOR_NAME ?? 'actor'
  const actor: ActorConfig = deriveActorConfig(name, BASE_URL, SOLID_STORAGE_BASE_URL)

  async function resolveActor(requested: string): Promise<ActorConfig | null> {
    return requested === actor.name ? actor : null
  }

  async function listActors(): Promise<ActorConfig[]> {
    return [actor]
  }

  async function getPublicKeyPem(): Promise<string> {
    return FAKE_PUBLIC_KEY_PEM
  }

  return { resolveActor, listActors, getPublicKeyPem }
}

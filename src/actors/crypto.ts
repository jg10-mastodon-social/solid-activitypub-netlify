import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

export interface EncryptedSecret {
  v: 1
  iv: string
  ciphertext: string
  tag: string
}

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const KEY_BYTES = 32
const ENV_VAR = 'ACTOR_KEY_ENCRYPTION_KEY'

function resolveKey(keyBase64?: string): Buffer {
  const encoded = keyBase64 ?? process.env[ENV_VAR]

  if (!encoded) {
    throw new Error(`${ENV_VAR} is required to encrypt or decrypt actor secrets`)
  }

  const key = Buffer.from(encoded, 'base64')

  if (key.length !== KEY_BYTES) {
    throw new Error(`${ENV_VAR} must decode to exactly ${KEY_BYTES} bytes, got ${key.length}`)
  }

  return key
}

export function encryptActorSecret(value: unknown, keyBase64?: string): EncryptedSecret {
  const key = resolveKey(keyBase64)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = JSON.stringify(value)

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    v: 1,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64')
  }
}

export function decryptActorSecret<T = unknown>(secret: EncryptedSecret, keyBase64?: string): T {
  if (secret.v !== 1) {
    throw new Error(`Unsupported actor secret envelope version: ${String(secret.v)}`)
  }

  const key = resolveKey(keyBase64)

  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(secret.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(secret.tag, 'base64'))

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(secret.ciphertext, 'base64')),
      decipher.final()
    ])

    return JSON.parse(plaintext.toString('utf8')) as T
  } catch (error) {
    throw new Error(`Failed to decrypt actor secret: ${(error as Error).message}`, { cause: error })
  }
}

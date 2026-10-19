import { devServerUrl } from './dev-server.js'
import { mintAdminSession } from './admin-session.js'

export async function ensureActor(name: string): Promise<void> {
  const session = await mintAdminSession()
  const url = `${devServerUrl}/admin/actors`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(await session.headers('POST', url))
    },
    body: JSON.stringify({ name })
  })
  if (response.status === 200 || response.status === 409) {
    return
  }
  const body = await response.text()
  throw new Error(`Failed to ensure actor "${name}": ${response.status} ${body}`)
}

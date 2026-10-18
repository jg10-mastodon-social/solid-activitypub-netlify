const DEV_ALLOWLIST_ENV = 'ACTOR_FETCH_ALLOW_PRIVATE_HOSTS'

// Private-address fetches are only ever allowed while running under Netlify Dev,
// so e2e tests can point at loopback mock servers. Production, branch, and
// deploy-preview contexts never honor the allowlist.
function isDevContext(): boolean {
  return process.env.CONTEXT === 'dev' || process.env.NETLIFY_DEV === 'true'
}

function devAllowlist(): Set<string> {
  if (!isDevContext()) return new Set()

  const raw = process.env[DEV_ALLOWLIST_ENV] ?? ''
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0)
  )
}

export function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    if (!hostname) return true

    if (devAllowlist().has(hostname)) return false

    if (hostname === 'localhost' || hostname === 'localhost.') return true

    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (ipv4Match) {
      const octets = ipv4Match.slice(1).map(Number)
      if (octets[0] === 127) return true
      if (octets[0] === 10) return true
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true
      if (octets[0] === 192 && octets[1] === 168) return true
      if (octets[0] === 169 && octets[1] === 254) return true
      return false
    }

    if (hostname.startsWith('[')) {
      const ip = hostname.replace(/[\[\]]/g, '')
      if (ip === '::1') return true
      if (ip.toLowerCase().startsWith('fe80:')) return true
    }

    return false
  } catch {
    return true
  }
}

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateKeyPair, exportJWK, importJWK } from 'jose'
import { createHash } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const publicDir = path.join(rootDir, 'public')
const baseUrlPath = path.join(rootDir, 'src/base-url.ts')
const privateKeyPath = path.join(rootDir, 'src/private-key.ts')
const actorKeysPath = path.join(rootDir, 'src/actor-keys.ts')
const webfingerDataPath = path.join(rootDir, 'src/webfinger-data.ts')

const context = process.env.CONTEXT
let baseUrl: string | undefined

console.log("CONTEXT", context)
if (context === 'production') {
  baseUrl = process.env.URL
} else {
  baseUrl = process.env.DEPLOY_URL || process.env.URL
}

if (!baseUrl) {
  console.error('URL (for production) or DEPLOY_URL (for previews) is required')
  process.exit(1)
}

const staticUiDir = path.join(rootDir, 'static-ui')

fs.writeFileSync(baseUrlPath, `export const baseUrl = '${baseUrl}'\n`)
console.log(`Written: ${baseUrlPath}`)

const webId = process.env.WEBID || `${baseUrl}/webid`
const issuer = process.env.ISSUER || baseUrl

function derivePublicJwk(privateJwk: Record<string, unknown>): Record<string, unknown> {
  if (!privateJwk.kid) {
    throw new Error('JWKS missing required kid field')
  }
  const { d, dp, dq, p, q, ...publicFields } = privateJwk
  return {
    ...publicFields,
    use: 'sig',
    alg: 'ES256',
    kid: privateJwk.kid,
  }
}

function parseActorNames(raw: string | undefined): string[] {
  if (!raw) return ['actor']
  const names = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  if (names.length === 0) {
    throw new Error('ACTOR_NAME must contain at least one non-empty actor name')
  }
  return names
}

function loadExistingObjectLiteral(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {}
  const src = fs.readFileSync(filePath, 'utf-8')
  const eqIdx = src.indexOf('=')
  if (eqIdx === -1) return {}
  const startIdx = src.indexOf('{', eqIdx)
  if (startIdx === -1) return {}

  let depth = 0
  let quote: '"' | "'" | '`' | null = null
  let endIdx = -1
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      if (ch === '\\') { i++; continue }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch as '"' | "'" | '`'
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) { endIdx = i; break }
    }
  }

  if (endIdx === -1 || depth !== 0) {
    console.warn(`Could not locate object literal in ${filePath}; starting with empty map.`)
    return {}
  }

  try {
    return JSON.parse(src.slice(startIdx, endIdx + 1)) as Record<string, unknown>
  } catch (err) {
    console.warn(`Could not parse existing ${filePath} (${(err as Error).message}); starting with empty map.`)
    return {}
  }
}

function copyTemplatesExcludingSpecs(srcDir: string, dstDir: string): void {
  fs.mkdirSync(dstDir, { recursive: true })
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name)
    const dstPath = path.join(dstDir, entry.name)
    if (entry.isDirectory()) {
      copyTemplatesExcludingSpecs(srcPath, dstPath)
    } else if (!/\.spec\.(ts|tsx)$/.test(entry.name)) {
      fs.copyFileSync(srcPath, dstPath)
    }
  }
}

async function generateIdentity() {
  console.log(`Generating identity files`)
  console.log(`BASE_URL: ${baseUrl}`)
  console.log(`WEBID: ${webId}`)
  console.log(`ISSUER: ${issuer}`)

  let publicJwk: Record<string, unknown>
  let privateJwk: Record<string, unknown>

  const existingJwks = process.env.JWKS

  if (existingJwks) {
    console.log('Using existing JWKS from environment variable')
    const parsed = JSON.parse(existingJwks)
    if (!parsed.kid) {
      throw new Error('JWKS missing required kid field')
    }
    const importedKey = await importJWK(parsed, 'ES256')
    const fullJwk = await exportJWK(importedKey)
    privateJwk = { ...fullJwk, kid: parsed.kid }
    publicJwk = {
      kty: fullJwk.kty,
      crv: fullJwk.crv,
      x: fullJwk.x,
      y: fullJwk.y,
      use: 'sig',
      alg: 'ES256',
      kid: parsed.kid,
    }
  } else {
    console.log('Generating new key pair')
    const { publicKey, privateKey } = await generateKeyPair('ES256', { crv: 'P-256' })

    publicJwk = await exportJWK(publicKey)
    publicJwk.kid = createHash('sha256')
      .update(JSON.stringify(publicJwk))
      .digest('base64url')
    publicJwk.alg = 'ES256'
    publicJwk.use = 'sig'

    privateJwk = await exportJWK(privateKey)
    privateJwk.kid = publicJwk.kid
    privateJwk.alg = 'ES256'
    privateJwk.use = 'sig'
  }

  fs.mkdirSync(publicDir, { recursive: true })

  const jwksContent = JSON.stringify({ keys: [publicJwk] }, null, 2)
  const jwksPath = path.join(publicDir, 'jwks.json')
  fs.writeFileSync(jwksPath, jwksContent)
  console.log(`Written: ${jwksPath}`)

  const openidConfiguration = {
    issuer: issuer,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    jwks_uri: `${baseUrl}/jwks.json`,
    solid_oidc_supported: true,
    solid_oidc_version: '1.0.0'
  }

  const openidPath = path.join(publicDir, '.well-known', 'openid-configuration')
  fs.mkdirSync(path.dirname(openidPath), { recursive: true })
  fs.writeFileSync(openidPath, JSON.stringify(openidConfiguration, null, 2))
  console.log(`Written: ${openidPath}`)

  const webidTurtle = `@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix oidc: <http://www.w3.org/ns/solid/oidc#>.

<${webId}> a <http://www.w3.org/2005/Incubator/w3c/Alice/WebID/1.0#Agent>.
<${webId}> solid:oidcIssuer <${issuer}>.
`

  const webidPath = path.join(publicDir, 'webid')
  fs.writeFileSync(webidPath, webidTurtle)
  console.log(`Written: ${webidPath}`)

  fs.writeFileSync(privateKeyPath, `export const privateKey = ${JSON.stringify(privateJwk)}\n`)
  console.log(`Written: ${privateKeyPath}`)

  console.log('Generating actor documents, keys, and webfinger data')
  const actorNames = parseActorNames(process.env.ACTOR_NAME)
  const domain = (baseUrl as string).replace(/^https?:\/\//, '')

  // Reuse existing per-actor signing keys when present so that remote servers
  // don't invalidate cached HTTP signatures across deploys. Only keys for
  // newly-listed actor names are generated.
  const existingActorKeys = loadExistingObjectLiteral(actorKeysPath) as Record<string, Record<string, unknown>>
  const actorKeys: Record<string, Record<string, unknown>> = { ...existingActorKeys }

  // Build fresh webfinger entries for the currently-configured actors so URLs
  // track the current BASE_URL. Entries from the previous file that point at
  // actors no longer present in ACTOR_NAME are preserved unchanged.
  const existingWebfingerEntries = loadExistingObjectLiteral(webfingerDataPath)
  const webfingerEntries: Record<string, unknown> = { ...existingWebfingerEntries }

  let reusedActorCount = 0
  let generatedActorCount = 0

  for (const actorName of actorNames) {
    const actorUrl = `${baseUrl}/${actorName}`

    if (actorKeys[actorName]) {
      console.log(`actor-keys: reusing existing key for "${actorName}"`)
      reusedActorCount++
    } else {
      const { privateKey: actorPrivateKey } = await generateKeyPair('RS256')
      const actorPrivateJwk = await exportJWK(actorPrivateKey)
      actorKeys[actorName] = actorPrivateJwk
      generatedActorCount++
    }

    const resource = `acct:${actorName}@${domain}`
    webfingerEntries[resource] = {
      subject: resource,
      aliases: [actorUrl],
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: actorUrl
        }
      ]
    }
  }

  console.log(`actor-keys: ${reusedActorCount} reused, ${generatedActorCount} newly generated`)

  fs.writeFileSync(actorKeysPath, `export const actorKeys: Record<string, Record<string, unknown>> = ${JSON.stringify(actorKeys, null, 2)}\n`)
  console.log(`Written: ${actorKeysPath}`)

  fs.writeFileSync(webfingerDataPath, `export const webfingerEntries: Record<string, unknown> = ${JSON.stringify(webfingerEntries, null, 2)}\n`)
  console.log(`Written: ${webfingerDataPath}`)

  console.log('Copying default UI from static-ui/ into public/')
  const landingTemplatePath = path.join(staticUiDir, 'index.html')
  const landingTemplate = fs.readFileSync(landingTemplatePath, 'utf-8')
  const actorItems = actorNames
    .map(name => `            <li><a href="/${name}">@${name}@${domain}</a></li>`)
    .join('\n')
  const landingHtml = landingTemplate
    .replaceAll('{{BASE_URL}}', baseUrl)
    .replace(
      /            <ul id="actors">\n              <!-- one <li> per actor, emitted by scripts\/generate-identity\.ts -->\n            <\/ul>/,
      `            <ul id="actors">\n${actorItems}\n            </ul>`
    )
  const landingPath = path.join(publicDir, 'index.html')
  fs.writeFileSync(landingPath, landingHtml)
  console.log(`Written: ${landingPath}`)

  const actorPageTemplateSrc = path.join(staticUiDir, 'actor-page.template.html')
  const actorPageTemplateDst = path.join(publicDir, 'actor-page.template.html')
  fs.copyFileSync(actorPageTemplateSrc, actorPageTemplateDst)
  console.log(`Written: ${actorPageTemplateDst}`)

  const componentsSrc = path.join(staticUiDir, 'components')
  const componentsDst = path.join(publicDir, 'components')
  fs.cpSync(componentsSrc, componentsDst, { recursive: true })
  console.log(`Copied: ${componentsSrc} -> ${componentsDst}`)

  const templatesSrc = path.join(staticUiDir, 'templates')
  const templatesDst = path.join(publicDir, 'templates')
  copyTemplatesExcludingSpecs(templatesSrc, templatesDst)
  console.log(`Copied: ${templatesSrc} -> ${templatesDst}`)

  console.log('Identity files generated successfully')
}

generateIdentity().catch(err => {
  console.error('Error generating identity:', err)
  process.exit(1)
})

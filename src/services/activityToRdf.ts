const ACTIVITYSTREAMS_CONTEXT = {
  '@vocab': '_:',
  'xsd': 'http://www.w3.org/2001/XMLSchema#',
  'as': 'https://www.w3.org/ns/activitystreams#',
  'ldp': 'http://www.w3.org/ns/ldp#',
  'vcard': 'http://www.w3.org/2006/vcard/ns#',
  'id': '@id',
  'Accept': 'as:Accept',
  'Activity': 'as:Activity',
  'Add': 'as:Add',
  'Create': 'as:Create',
  'Delete': 'as:Delete',
  'Update': 'as:Update',
  'Follow': 'as:Follow',
  'Undo': 'as:Undo',
  'type': { '@id': '@type' },
  'actor': { '@id': 'as:actor', '@type': '@id' },
  'object': { '@id': 'as:object', '@type': '@id' },
  'items': { '@id': 'as:items', '@type': '@id', '@container': '@set' },
  'published': { '@id': 'as:published', '@type': 'xsd:dateTime' },
  'to': { '@id': 'as:to', '@type': '@id', '@container': '@set' },
}

const SECURITY_CONTEXT = {
  'id': '@id',
  'type': '@type',
  'sec': 'https://w3id.org/security#',
  'xsd': 'http://www.w3.org/2001/XMLSchema#',
  'EcdsaKoblitzSignature2016': 'sec:EcdsaKoblitzSignature2016',
  'Ed25519Signature2018': 'sec:Ed25519Signature2018',
  'RsaSignature2017': 'sec:RsaSignature2017',
  'CryptographicKey': 'sec:Key',
  'creator': { '@id': 'dc:creator', '@type': '@id' },
  'created': { '@id': 'dc:created', '@type': 'xsd:dateTime' },
  'publicKey': { '@id': 'sec:publicKey', '@type': '@id' },
  'privateKey': { '@id': 'sec:privateKey', '@type': '@id' },
}

function buildContext(obj: Record<string, unknown>): (Record<string, unknown> | string)[] {
  const contexts: (Record<string, unknown> | string)[] = [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1',
    ACTIVITYSTREAMS_CONTEXT,
    SECURITY_CONTEXT,
  ]
  if (obj['@context']) {
    const existing = Array.isArray(obj['@context']) ? obj['@context'] : [obj['@context']]
    return [...contexts, ...existing]
  }
  return contexts
}

export function injectContexts(obj: Record<string, unknown>): Record<string, unknown> {
  const result = { ...obj }
  result['@context'] = buildContext(obj)
  return result
}

export function skolemizeBlankNodes(turtle: string, baseUri: string): string {
  let result = turtle
  let counter = 0
  const regex = /_:b(\d+)/g
  const timestamp = Date.now()
  result = result.replace(regex, () => {
    const skolem = `${baseUri}${timestamp}_${counter++}`
    return `<${skolem}>`
  })
  return result
}

export function activityToTurtle(activity: Record<string, unknown>): string {
  const activityWithContext = injectContexts(activity as Record<string, unknown>)
  const jsonLd = JSON.stringify(activityWithContext)
  return jsonLd
}

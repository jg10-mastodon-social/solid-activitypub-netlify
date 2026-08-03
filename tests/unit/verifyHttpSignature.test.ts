import { describe, it, expect } from 'vitest'

describe('parseSignatureHeader', () => {
  it('should parse valid Signature header with all fields', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="Y2FiYWJjZGVmZw=="'
    const result = parseSignatureHeader(header)
    expect(result.keyId).toBe('https://example.com/actor#main-key')
    expect(result.algorithm).toBe('rsa-sha256')
    expect(result.headers).toBe('(request-target) host date digest content-type')
    expect(result.signature).toBe('Y2FiYWJjZGVmZw==')
  })

  it('should parse Signature header with minimal fields', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date",signature="abc123"'
    const result = parseSignatureHeader(header)
    expect(result.keyId).toBe('https://example.com/actor#main-key')
    expect(result.algorithm).toBe('rsa-sha256')
    expect(result.headers).toBe('(request-target) host date')
    expect(result.signature).toBe('abc123')
  })

  it('should throw when keyId is missing', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'algorithm="rsa-sha256",headers="(request-target)",signature="abc123"'
    expect(() => parseSignatureHeader(header)).toThrow('keyId')
  })

  it('should throw when signature is missing', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",algorithm="rsa-sha256",headers="(request-target)"'
    expect(() => parseSignatureHeader(header)).toThrow('signature')
  })

  it('should throw when headers is missing', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",algorithm="rsa-sha256",signature="abc123"'
    expect(() => parseSignatureHeader(header)).toThrow('headers')
  })

  it('should throw when algorithm is missing', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",headers="(request-target)",signature="abc123"'
    expect(() => parseSignatureHeader(header)).toThrow('algorithm')
  })

  it('should handle signature with special characters', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",algorithm="rsa-sha256",headers="(request-target)",signature="Y2Fi/Y2Fi==Z2V0"'
    const result = parseSignatureHeader(header)
    expect(result.signature).toBe('Y2Fi/Y2Fi==Z2V0')
  })

  it('should handle algorithm value with hyphens', async () => {
    const { parseSignatureHeader } = await import('../../src/verifyHttpSignature.js')
    const header = 'keyId="https://example.com/actor#main-key",algorithm="ecdsa-p256-sha256",headers="(request-target)",signature="abc123"'
    const result = parseSignatureHeader(header)
    expect(result.algorithm).toBe('ecdsa-p256-sha256')
  })
})

describe('isAllowedAlgorithm', () => {
  it('should accept rsa-sha256', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('rsa-sha256')).toBe(true)
  })

  it('should accept rsa-v1_5-sha256', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('rsa-v1_5-sha256')).toBe(true)
  })

  it('should accept hs2019', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('hs2019')).toBe(true)
  })

  it('should accept rsa-pss-sha512', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('rsa-pss-sha512')).toBe(true)
  })

  it('should accept ecdsa-p256-sha256', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('ecdsa-p256-sha256')).toBe(true)
  })

  it('should accept ed25519', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('ed25519')).toBe(true)
  })

  it('should reject unknown algorithms', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('hmac-sha256')).toBe(false)
    expect(isAllowedAlgorithm('sha256')).toBe(false)
    expect(isAllowedAlgorithm('md5')).toBe(false)
  })

  it('should reject algorithm with different case', async () => {
    const { isAllowedAlgorithm } = await import('../../src/verifyHttpSignature.js')
    expect(isAllowedAlgorithm('RSA-SHA256')).toBe(false)
    expect(isAllowedAlgorithm('Ed25519')).toBe(false)
  })
})

describe('validateTimestamp', () => {
  it('should accept Date within 5 minutes', async () => {
    const { validateTimestamp } = await import('../../src/verifyHttpSignature.js')
    const now = new Date()
    const dateHeader = now.toUTCString()
    expect(validateTimestamp(dateHeader)).toBe(true)
  })

  it('should accept Date within 1 minute past', async () => {
    const { validateTimestamp } = await import('../../src/verifyHttpSignature.js')
    const past = new Date(Date.now() - 30 * 1000)
    const dateHeader = past.toUTCString()
    expect(validateTimestamp(dateHeader)).toBe(true)
  })

  it('should reject Date older than 5 minutes', async () => {
    const { validateTimestamp } = await import('../../src/verifyHttpSignature.js')
    const old = new Date(Date.now() - 6 * 60 * 1000)
    const dateHeader = old.toUTCString()
    expect(validateTimestamp(dateHeader)).toBe(false)
  })

  it('should reject Date more than 1 minute in future', async () => {
    const { validateTimestamp } = await import('../../src/verifyHttpSignature.js')
    const future = new Date(Date.now() + 2 * 60 * 1000)
    const dateHeader = future.toUTCString()
    expect(validateTimestamp(dateHeader)).toBe(false)
  })

  it('should reject invalid Date format', async () => {
    const { validateTimestamp } = await import('../../src/verifyHttpSignature.js')
    expect(validateTimestamp('invalid-date')).toBe(false)
    expect(validateTimestamp('')).toBe(false)
  })
})
import { describe, it, expect } from 'vitest'

describe('SSRF protection', () => {
  describe('localhost blocking', () => {
    it('should reject localhost', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://localhost/actor')).toBe(true)
    })

    it('should reject localhost with port', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://localhost:8080/actor')).toBe(true)
    })

    it('should reject localhost with trailing dot', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://localhost./actor')).toBe(true)
    })
  })

  describe('IPv4 loopback blocking', () => {
    it('should reject 127.0.0.1', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://127.0.0.1/actor')).toBe(true)
    })

    it('should reject 127.255.255.255', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://127.255.255.255/actor')).toBe(true)
    })

    it('should reject 127.1.2.3', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://127.1.2.3/actor')).toBe(true)
    })
  })

  describe('IPv4 private network blocking', () => {
    it('should reject 10.x.x.x range', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://10.0.0.1/actor')).toBe(true)
      expect(isBlockedUrl('http://10.255.255.255/actor')).toBe(true)
    })

    it('should reject 172.16-31.x.x range', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://172.16.0.1/actor')).toBe(true)
      expect(isBlockedUrl('http://172.31.255.255/actor')).toBe(true)
      expect(isBlockedUrl('http://172.20.100.50/actor')).toBe(true)
    })

    it('should accept 172.15.x.x (outside private range)', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://172.15.0.1/actor')).toBe(false)
    })

    it('should accept 172.32.x.x (outside private range)', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://172.32.0.1/actor')).toBe(false)
    })

    it('should reject 192.168.x.x range', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://192.168.0.1/actor')).toBe(true)
      expect(isBlockedUrl('http://192.168.255.255/actor')).toBe(true)
    })

    it('should accept 192.169.x.x (outside private range)', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://192.169.0.1/actor')).toBe(false)
    })
  })

  describe('IPv4 link-local blocking', () => {
    it('should reject 169.254.x.x range', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://169.254.0.1/actor')).toBe(true)
      expect(isBlockedUrl('http://169.254.255.255/actor')).toBe(true)
    })
  })

  describe('IPv6 blocking', () => {
    it('should reject IPv6 loopback ::1', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://[::1]/actor')).toBe(true)
    })

    it('should reject IPv6 link-local fe80::', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://[fe80::1]/actor')).toBe(true)
    })

    it('should reject IPv6 with zone ID', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://[fe80::1%25eth0]/actor')).toBe(true)
    })
  })

  describe('public URL acceptance', () => {
    it('should accept public IPv4 addresses', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('https://8.8.8.8/actor')).toBe(false)
      expect(isBlockedUrl('https://1.1.1.1/actor')).toBe(false)
      expect(isBlockedUrl('https://93.184.216.34/actor')).toBe(false)
    })

    it('should accept public hostnames', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('https://example.com/actor')).toBe(false)
      expect(isBlockedUrl('https://mastodon.social/actor')).toBe(false)
      expect(isBlockedUrl('https://example.org/.well-known/actor')).toBe(false)
    })

    it('should accept IPv6 global unicast addresses', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('http://[2001:db8::1]/actor')).toBe(false)
    })
  })

  describe('malformed URL handling', () => {
    it('should reject malformed URLs', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('not-a-url')).toBe(true)
      expect(isBlockedUrl('')).toBe(true)
    })

    it('should reject URLs with no hostname', async () => {
      const { isBlockedUrl } = await import('../../src/ssrf.js')
      expect(isBlockedUrl('file:///etc/passwd')).toBe(true)
    })
  })
})
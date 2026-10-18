import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mocks = vi.hoisted(() => ({
  getPrivateKeyJwk: vi.fn(),
  openActorKeys: vi.fn(),
  openActorRegistry: vi.fn(),
  getBuildKey: vi.fn()
}))

const buildKey = {
  kty: 'RSA',
  kid: 'build-key',
  source: 'build'
}

const registryKey = {
  kty: 'RSA',
  kid: 'registry-key',
  source: 'registry'
}

const realRegistryKey = {
  kty: 'RSA',
  n: '087LLHjkTFSIpzGFsFJbtJ3kLYfgv_LbbwejTYTtW8v6SZtd5XvWQsYYzwDgfPa2fBKFwb9pP2peDdtTackH0kIV86T1gerGjEbziz7Mn8mnB7hAxvJupEMoMuxS0DxpVokZfgeQkb9cI-pcoxSrPMJ7h92_6JKB_PubRbBSDTlOQacyIWKx_UsZBODVnt12UuJSSAKATD8wkXaeQ495ED_zdz1AvLaeu_hMuq3pC8uyWDD35XLF3nM0oTgCA9JoINfQtoG8bZxWveS_3RFa0EaM_RkBHDd87TJWCpuEZSXJdCS5R2NqXjM28YS35Zp7zQstk0ZzxZ1WYNNGqkPSJw',
  e: 'AQAB',
  d: 'Iu6JipmbiU0txmk_8675ieW6Ypn0wqNydjLLx3ajUM7oxef2SektEpEqOUWbQHDN8tN5NNV1LazEu0NPU_SAMjiM90Re6yDFww_WjcH7LGUtA3RrVoRYJAYhZJieJdK4yrlMt4DW4nqtXw0BXzIC9b_bcLJtOpWjE46JcqpcNerPGin1mlbdjouaAxl_xkN0oz1iP-mVuKnPTEdCSgQI1-o5KAhHiM4r2L3Nc1rza9mThtdloD9OQK-sN2sVat3dMRyia2-EakPLT45L9riCzL8Lzg3dYo2cEOKNyso9fIaPWwhjbqXHVpHHq6ZtBPqI_AZ1SP7ksyhBRBDEf3q5uQ',
  p: '-FWcrivYkLdVwtjPkbhFKvuuX1pxgrtAc3SN06TAMkLiBpScS1v7CU0GNHe0KeftnbsUMWy_PUu-NztyoUblL-XwS54TEVuPP8Xs6QBAjIUlknmumhX5XN4KuIEz8RxgT-Q1cW2eMqukkmiSFsLJrYXdqHS9c1YtzULvIY3C84k',
  q: '2liKd7sGwFsqIRbSWU5LZChvrtOQaDPXSst9l18HrI3vzMk0UERsmi8ulPWxjEsB0v8HPAdkwcjXScGLI-RqMUdzIXlyo5dYgEy18m56uNQmixivzRXT3AATjMiDPqm_r8l4xfX_e7BmKMUzRhfG8RsBq-2oJJbfVLfCqiT9PC8',
  dp: 'DvuLUm7OyBxnjjPqgg4uDiPVJ2ebhZmqj8yuaeB8wAuM-3yn2VwZTzxYbX3zXrvheCy7USgQebBCL67kgZp3ZWZoEwfceqWdhOl6G6yqOFAoLigtQpqkyteSqgMRkTB3FxrbppZIfyIf8b1hYwIpjNCQyQMSEw1WAhZRuyKEapE',
  dq: 'jICFOd6DzavcREanPQiAwwayN1G0jxks5NhlDM795S_Aq4qduzkMmXrbAsfHZHuvxNKPGTW4xGo0_yUoIASPwP41O8km19ZAAO9b9ZDaL610z_Umy1XMarkx21n7-orI6pk-ukQ-Dp3IX1vmTqhmQCgcv0HC_SiItb856Lq8qck',
  qi: 'RkS8eJCBj6jS_X79mpshzhhob_-wpOWaTE7S_V2EYmbgFM45WlGfIxF7anX-Sds3qjko-cvAwy77pdke1ghEVyg1EzIgetrhqzKMDvv6bT-dY_mhPbk1r7ioXUYpl1BpcrpsuWCS1rxrZQk352J-asEmThXqzlWK7pn2Os17lX0'
}

vi.mock('../../src/actors/keys.js', () => ({
  openActorKeys: mocks.openActorKeys
}))

vi.mock('../../src/actors/registry.js', () => ({
  openActorRegistry: mocks.openActorRegistry
}))

vi.mock('../../src/actor-keys.js', () => ({
  actorKeys: {
    get actor() {
      mocks.getBuildKey()
      return buildKey
    }
  }
}))

beforeEach(() => {
  vi.resetModules()
  mocks.getPrivateKeyJwk.mockReset()
  mocks.openActorKeys.mockReset()
  mocks.openActorRegistry.mockReset()
  mocks.getBuildKey.mockReset()
  mocks.openActorRegistry.mockReturnValue({})
  mocks.openActorKeys.mockReturnValue({ getPrivateKeyJwk: mocks.getPrivateKeyJwk })
})

describe('resolveActorPrivateKey', () => {
  it('returns the registry key without consulting the build fallback', async () => {
    mocks.getPrivateKeyJwk.mockResolvedValue(registryKey)

    const { resolveActorPrivateKey } = await import('../../src/signing.js')

    const key = await resolveActorPrivateKey('actor')

    expect(key).toBe(registryKey)
    expect(mocks.getBuildKey).not.toHaveBeenCalled()
  })

  it('falls back to the build-time key when the registry provider throws', async () => {
    mocks.getPrivateKeyJwk.mockRejectedValue(new Error('registry unavailable'))

    const { resolveActorPrivateKey } = await import('../../src/signing.js')

    const key = await resolveActorPrivateKey('actor')

    expect(key).toBe(buildKey)
    expect(mocks.getBuildKey).toHaveBeenCalled()
  })

  it('throws the build lookup error when the registry throws and no build key exists', async () => {
    mocks.getPrivateKeyJwk.mockRejectedValue(new Error('registry unavailable'))

    const { resolveActorPrivateKey } = await import('../../src/signing.js')

    await expect(resolveActorPrivateKey('missing')).rejects.toThrow(
      'No signing key configured for actor "missing"'
    )
  })
})

describe('signActivityRequest with registry keys', () => {
  it('signs the request with the registry private key', async () => {
    mocks.getPrivateKeyJwk.mockResolvedValue(realRegistryKey)

    const { signActivityRequest } = await import('../../src/signing.js')

    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 })

    await signActivityRequest(
      'https://remote.example/inbox',
      JSON.stringify({ type: 'Create' }),
      'https://example.com/actor#main-key',
      'https://example.com/actor',
      'https://example.com',
      fetchFn as unknown as SolidFetch
    )

    expect(fetchFn).toHaveBeenCalledOnce()
    const init = fetchFn.mock.calls[0][1] as { headers: Record<string, string> }
    expect(init.headers.Signature).toContain('keyId="https://example.com/actor#main-key"')
    expect(mocks.getBuildKey).not.toHaveBeenCalled()
  })
})

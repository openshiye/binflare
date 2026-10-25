import { describe, expect, it } from 'vitest'
import { validatePasteRequest, ValidationError } from '../../src/server/validation'
import type { AppConfig } from '../../src/server/config'
import type { ExpireKey } from '../../src/lib/protocol'

const expireOptions: ExpireKey[] = ['5min', '10min', '1hour', '1day', '1week']
const config: AppConfig = {
  d1MaxCtBytes: 1_875_000,
  d1MaxCtBase64: 2_500_000,
  maxCtBytes: 1_875_000,
  maxCtBase64: 2_500_000,
  r2Enabled: false,
  expireOptions,
  expireDefault: '1day',
  rateLimitWindowSeconds: 60,
  rateLimitMaxRequests: 1,
  turnstileSiteKey: '',
  turnstileSecret: '',
  corsOrigin: '',
}

function bodyFor(expire: string) {
  return {
    v: 2,
    adata: [
      ['AAAAAAAAAAAAAAAAAAAAAA==', 'AAAAAAAAAAA=', 100_000, 256, 128, 'aes', 'gcm', 'none'],
      'plaintext',
      0,
      0,
    ],
    ct: Buffer.from('expiry-gate').toString('base64'),
    meta: { expire },
  }
}

describe('expiry policy', () => {
  it('accepts an option within the deployment cap', () => {
    expect(validatePasteRequest(bodyFor('1week'), config).expire).toBe('1week')
  })

  it('rejects a longer expiry even when the API is called directly', () => {
    expect(() => validatePasteRequest(bodyFor('1year'), config)).toThrow(ValidationError)
  })

  it('falls back to the configured default', () => {
    expect(validatePasteRequest(bodyFor('unsupported'), config).expire).toBe('1day')
  })
})

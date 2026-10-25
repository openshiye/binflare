import { describe, expect, it } from 'vitest'
import { verifyTurnstile } from '../../src/server/turnstile'

const DUMMY_SECRET = '1x0000000000000000000000000000000AA'
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'

describe('Turnstile siteverify', () => {
  it('accepts a solved token and rejects an unknown secret', async () => {
    await expect(verifyTurnstile(DUMMY_SECRET, DUMMY_TOKEN, '')).resolves.toBe(true)
    await expect(verifyTurnstile('not-a-real-secret', DUMMY_TOKEN, '')).resolves.toBe(false)
  })
})

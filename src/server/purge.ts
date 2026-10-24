import { cleanupRateLimits, purgeExpired, purgeOrphanComments } from './db'

export async function purge(env: Env, nowMs = Date.now()): Promise<{ pastes: number }> {
  const nowSeconds = Math.floor(nowMs / 1000)
  let pastes = 0
  for (let batch = 0; batch < 5; batch++) {
    const deleted = await purgeExpired(env.DB, nowSeconds, 100)
    pastes += deleted
    if (deleted < 100) {
      break
    }
  }
  await purgeOrphanComments(env.DB)
  await cleanupRateLimits(env.DB, nowSeconds - 3600)
  return { pastes }
}

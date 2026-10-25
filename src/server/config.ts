import {
  DEFAULT_EXPIRE,
  DEFAULT_FORMATTER,
  EXPIRY_OPTIONS,
  FORMATTERS,
  MAX_CT_BASE64,
  MAX_CT_BYTES,
  isExpireKey,
  type ExpireKey,
  type Formatter,
} from '../lib/protocol'

export interface AppConfig {
  d1MaxCtBytes: number
  d1MaxCtBase64: number
  maxCtBytes: number
  maxCtBase64: number
  r2Enabled: boolean
  expireOptions: ExpireKey[]
  expireDefault: ExpireKey
  rateLimitWindowSeconds: number
  rateLimitMaxRequests: number
  turnstileSiteKey: string
  turnstileSecret: string
  corsOrigin: string
}

export interface PublicConfig {
  expire: ExpireKey[]
  expireDefault: ExpireKey
  formatters: Formatter[]
  formatterDefault: Formatter
  maxCiphertextBytes: number
  maxCiphertextBase64: number
  d1CiphertextBytes: number
  r2Enabled: boolean
  largePastes: boolean
  features: {
    discussion: boolean
    password: boolean
    burn: boolean
    attachments: boolean
    qr: boolean
    email: boolean
  }
  turnstileSiteKey: string
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function expireOptions(maxExpire: string | undefined): ExpireKey[] {
  const all = Object.keys(EXPIRY_OPTIONS) as ExpireKey[]
  if (!isExpireKey(maxExpire) || maxExpire === 'never') {
    return all
  }
  const max = EXPIRY_OPTIONS[maxExpire]
  return all.filter((key) => key !== 'never' && EXPIRY_OPTIONS[key] <= max)
}

function expireDefault(value: string | undefined, allowed: ExpireKey[]): ExpireKey {
  const requested = isExpireKey(value) ? value : DEFAULT_EXPIRE
  return allowed.includes(requested) ? requested : (allowed[0] ?? DEFAULT_EXPIRE)
}

export function getConfig(env: Env): AppConfig {
  const d1MaxCtBytes = numberFromEnv(env.MAX_PASTE_CT_BYTES, MAX_CT_BYTES)
  const d1MaxCtBase64 = numberFromEnv(env.MAX_PASTE_CT_BASE64, MAX_CT_BASE64)
  const r2Enabled = Boolean((env as Env & { PASTES?: R2Bucket }).PASTES)
  const maxCtBytes = r2Enabled ? numberFromEnv(env.MAX_R2_CT_BYTES, 10_000_000) : d1MaxCtBytes
  const maxCtBase64 = r2Enabled
    ? numberFromEnv(env.MAX_R2_CT_BASE64, 13_400_000)
    : d1MaxCtBase64
  const optionalEnv = env as Env & { MAX_EXPIRE?: string; EXPIRE_DEFAULT?: string }
  const allowedExpireOptions = expireOptions(optionalEnv.MAX_EXPIRE)
  return {
    d1MaxCtBytes,
    d1MaxCtBase64,
    maxCtBytes,
    maxCtBase64,
    r2Enabled,
    expireOptions: allowedExpireOptions,
    expireDefault: expireDefault(optionalEnv.EXPIRE_DEFAULT, allowedExpireOptions),
    rateLimitWindowSeconds: numberFromEnv(env.RATE_LIMIT_WINDOW_SECONDS, 10),
    rateLimitMaxRequests: numberFromEnv(env.RATE_LIMIT_MAX_REQUESTS, 1),
    turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? '',
    turnstileSecret:
      (env as Env & { TURNSTILE_SECRET?: string }).TURNSTILE_SECRET ?? '',
    corsOrigin: env.CORS_ORIGIN ?? '',
  }
}

export function getPublicConfig(env: Env): PublicConfig {
  const config = getConfig(env)
  return {
    expire: config.expireOptions,
    expireDefault: config.expireDefault,
    formatters: FORMATTERS,
    formatterDefault: DEFAULT_FORMATTER,
    maxCiphertextBytes: config.maxCtBytes,
    maxCiphertextBase64: config.maxCtBase64,
    d1CiphertextBytes: config.d1MaxCtBytes,
    r2Enabled: config.r2Enabled,
    largePastes: config.r2Enabled,
    features: {
      discussion: true,
      password: true,
      burn: true,
      attachments: true,
      qr: true,
      email: true,
    },
    turnstileSiteKey: config.turnstileSiteKey,
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) {
    return `${bytes} B`
  }
  if (bytes < 1_000_000) {
    return `${(bytes / 1000).toFixed(2)} KB`
  }
  return `${(bytes / 1_000_000).toFixed(2)} MB`
}

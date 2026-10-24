import {
  DEFAULT_EXPIRE,
  DEFAULT_FORMATTER,
  EXPIRY_OPTIONS,
  FORMATTERS,
  MAX_CT_BASE64,
  MAX_CT_BYTES,
  type ExpireKey,
  type Formatter,
} from '../lib/protocol'

export interface AppConfig {
  maxCtBytes: number
  maxCtBase64: number
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

export function getConfig(env: Env): AppConfig {
  return {
    maxCtBytes: numberFromEnv(env.MAX_PASTE_CT_BYTES, MAX_CT_BYTES),
    maxCtBase64: numberFromEnv(env.MAX_PASTE_CT_BASE64, MAX_CT_BASE64),
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
    expire: Object.keys(EXPIRY_OPTIONS) as ExpireKey[],
    expireDefault: DEFAULT_EXPIRE,
    formatters: FORMATTERS,
    formatterDefault: DEFAULT_FORMATTER,
    maxCiphertextBytes: config.maxCtBytes,
    maxCiphertextBase64: config.maxCtBase64,
    features: {
      discussion: true,
      password: true,
      burn: true,
      attachments: false,
      qr: false,
      email: false,
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

import {
  DEFAULT_EXPIRE,
  DEFAULT_FORMATTER,
  EXPIRY_OPTIONS,
  FORMATTERS,
  MAX_CT_BASE64,
  MAX_CT_BYTES,
  type CommentRequest,
  type ExpireKey,
  type Formatter,
  type PasteRequest,
} from './protocol'

export type ApiErrorKind = 'not_found' | 'rate_limit' | 'too_large' | 'invalid' | 'network' | 'server'

export class ApiError extends Error {
  readonly kind: ApiErrorKind

  constructor(message: string, kind: ApiErrorKind) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
  }
}

export interface ClientConfig {
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

export const FALLBACK_CONFIG: ClientConfig = {
  expire: Object.keys(EXPIRY_OPTIONS) as ExpireKey[],
  expireDefault: DEFAULT_EXPIRE,
  formatters: FORMATTERS,
  formatterDefault: DEFAULT_FORMATTER,
  maxCiphertextBytes: MAX_CT_BYTES,
  maxCiphertextBase64: MAX_CT_BASE64,
  features: {
    discussion: true,
    password: true,
    burn: true,
    attachments: false,
    qr: false,
    email: false,
  },
  turnstileSiteKey: '',
}

let configPromise: Promise<ClientConfig> | null = null

export function getClientConfig(): Promise<ClientConfig> {
  if (!configPromise) {
    configPromise = fetch('/api/config', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          return FALLBACK_CONFIG
        }
        return (await response.json()) as ClientConfig
      })
      .catch(() => FALLBACK_CONFIG)
  }
  return configPromise
}

export interface CommentRecord {
  id: string
  parentid: string
  adata: unknown
  ct: string
  meta: { created: number }
}

export interface ReadResponse {
  status: 0
  id: string
  url: string
  v: number
  adata: unknown[]
  ct: string
  meta: { time_to_live?: number }
  comments: CommentRecord[]
  comment_count: number
  comment_offset: number
  burned?: boolean
}

function turnstileHeader(): Record<string, string> {
  const token = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value
  return token ? { 'cf-turnstile-response': token } : {}
}

function classify(message: string): ApiErrorKind {
  if (message.includes('does not exist') || message.includes('has expired')) {
    return 'not_found'
  }
  if (message.includes('Please wait')) {
    return 'rate_limit'
  }
  if (message.includes('limited to')) {
    return 'too_large'
  }
  return 'invalid'
}

async function compatJson(response: Response): Promise<Record<string, unknown>> {
  let data: Record<string, unknown>
  try {
    data = (await response.json()) as Record<string, unknown>
  } catch {
    throw new ApiError('The server returned an invalid response.', 'server')
  }
  if (!response.ok) {
    const error = data.error as { message?: string } | undefined
    throw new ApiError(error?.message ?? `HTTP ${response.status}`, 'server')
  }
  if (data.status === 1) {
    const message = typeof data.message === 'string' ? data.message : 'Invalid data.'
    throw new ApiError(message, classify(message))
  }
  if (data.status !== 0) {
    throw new ApiError('The server returned an invalid response.', 'server')
  }
  return data
}

export async function createPaste(
  request: PasteRequest,
  turnstileToken?: string,
): Promise<{ id: string; url: string; deletetoken: string }> {
  let response: Response
  try {
    response = await fetch('/', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        'x-requested-with': 'JSONHttpRequest',
        ...(turnstileToken ? { 'cf-turnstile-response': turnstileToken } : turnstileHeader()),
      },
      body: JSON.stringify(request),
    })
  } catch {
    throw new ApiError('Could not reach the server.', 'network')
  }
  const data = await compatJson(response)
  if (typeof data.id !== 'string' || typeof data.url !== 'string' || typeof data.deletetoken !== 'string') {
    throw new ApiError('The server returned an invalid response.', 'server')
  }
  return { id: data.id, url: data.url, deletetoken: data.deletetoken }
}

export async function readPaste(id: string): Promise<ReadResponse> {
  let response: Response
  try {
    response = await fetch(`/?pasteid=${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: { 'x-requested-with': 'JSONHttpRequest' },
    })
  } catch {
    throw new ApiError('Could not reach the server.', 'network')
  }
  return (await compatJson(response)) as unknown as ReadResponse
}

export async function postComment(
  request: CommentRequest,
  turnstileToken?: string,
): Promise<{ id: string }> {
  let response: Response
  try {
    response = await fetch('/', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        'x-requested-with': 'JSONHttpRequest',
        ...(turnstileToken ? { 'cf-turnstile-response': turnstileToken } : turnstileHeader()),
      },
      body: JSON.stringify(request),
    })
  } catch {
    throw new ApiError('Could not reach the server.', 'network')
  }
  const data = await compatJson(response)
  if (typeof data.id !== 'string') {
    throw new ApiError('The server returned an invalid response.', 'server')
  }
  return { id: data.id }
}

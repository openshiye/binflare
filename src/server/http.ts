import { ValidationError } from './validation'

export const GENERIC_ERROR = 'Document does not exist, has expired or has been deleted.'
export const INVALID_DATA = 'Invalid data.'
export const WRONG_TOKEN = 'Wrong deletion token. Document was not deleted.'
export const INVALID_ID = 'Invalid document ID.'
export const COLLISION = 'You are unlucky. Try again.'
export const DELETED = 'Document was properly deleted.'

const BASE_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
}

export function jsonResponse(data: unknown, status = 200, extra: HeadersInit = {}): Response {
  const headers = new Headers(BASE_HEADERS)
  headers.set('content-type', 'application/json; charset=utf-8')
  for (const [key, value] of new Headers(extra)) {
    headers.set(key, value)
  }
  return Response.json(data, { status, headers })
}

export function compatError(message: string): Response {
  return jsonResponse(
    { status: 1, message },
    200,
    { 'access-control-allow-origin': '*' },
  )
}

export function compatResult(id: string, path: string, extra: Record<string, unknown> = {}): Response {
  return jsonResponse(
    { status: 0, id, url: `${path}?${id}`, ...extra },
    200,
    { 'access-control-allow-origin': '*' },
  )
}

export function restError(
  status: number,
  code: string,
  message: string,
  extra: HeadersInit = {},
): Response {
  return jsonResponse({ error: { code, message } }, status, extra)
}

export function requestIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? 'unknown'
}

export function requestPath(request: Request): string {
  const pathname = new URL(request.url).pathname
  return pathname === '' ? '/' : pathname
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentLength = Number.parseInt(request.headers.get('content-length') ?? '', 10)
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ValidationError('too_large', 'Request body is too large.')
  }
  const text = await request.text()
  if (text.length > maxBytes) {
    throw new ValidationError('too_large', 'Request body is too large.')
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ValidationError('invalid', INVALID_DATA)
  }
}

export function htmlResponse(title: string, message: string, status = 200): Response {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p><a href="/">Start over</a></p></main></body></html>`
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy':
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'cross-origin-resource-policy': 'same-origin',
    },
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function withCors(response: Response, origin: string): Response {
  if (!origin) {
    return response
  }
  const headers = new Headers(response.headers)
  headers.set('access-control-allow-origin', origin)
  headers.set('vary', 'origin')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export function corsHeaders(request: Request, allowedOrigin: string): Record<string, string> {
  const origin = request.headers.get('origin') ?? ''
  if (!allowedOrigin || origin !== allowedOrigin) {
    return {}
  }
  return {
    'access-control-allow-origin': origin,
    vary: 'origin',
  }
}

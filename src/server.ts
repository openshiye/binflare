import handler from '@tanstack/react-start/server-entry'
import { purge } from './server/purge'
import { handleRootCreate, handleRootDelete, handleRootGet } from './server/root'
import { ensureSchema } from './server/schema'

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'nonce-__NONCE__' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src 'self' blob: https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
].join('; ')

function isRootApiRequest(request: Request, url: URL): boolean {
  if (url.pathname !== '/') {
    return false
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return true
  }
  if (url.searchParams.has('pasteid') || url.searchParams.has('deletetoken') || url.searchParams.has('jsonld')) {
    return true
  }
  return request.headers.get('x-requested-with') === 'JSONHttpRequest'
}

function nonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function withHtmlHeaders(response: Response, cspNonce: string): Response {
  const headers = new Headers(response.headers)
  headers.set('content-security-policy', CONTENT_SECURITY_POLICY.replace('__NONCE__', cspNonce))
  headers.set('referrer-policy', 'no-referrer')
  headers.set('x-content-type-options', 'nosniff')
  headers.set('x-frame-options', 'DENY')
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
  headers.set('cross-origin-resource-policy', 'same-origin')
  headers.set('cache-control', 'no-store')
  headers.delete('etag')
  headers.delete('last-modified')
  headers.delete('cf-cache-status')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

async function serveShell(request: Request, env: Env): Promise<Response> {
  // During the prerender step the assets binding is not populated yet; let the
  // Start handler render the shell. At runtime the shell is served from ASSETS.
  if (!env?.ASSETS) {
    return handler.fetch(request)
  }

  const shellUrl = new URL('/', request.url)
  const shellRequest = new Request(shellUrl, request)
  const assetResponse = await env.ASSETS.fetch(shellRequest)
  if (!assetResponse.ok) {
    return handler.fetch(request)
  }

  const cspNonce = nonce()
  const rewritten = new HTMLRewriter()
    .on('script', {
      element(element) {
        element.setAttribute('nonce', cspNonce)
      },
    })
    .transform(assetResponse)

  return withHtmlHeaders(rewritten, cspNonce)
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      await ensureSchema(env.DB)
      return handler.fetch(request)
    }
    if (isRootApiRequest(request, url)) {
      await ensureSchema(env.DB)
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'access-control-allow-headers': 'Content-Type, X-Requested-With, CF-Turnstile-Response',
            'access-control-max-age': '86400',
            'cache-control': 'no-store',
          },
        })
      }
      if (request.method === 'POST' || request.method === 'PUT') {
        return handleRootCreate(request, env)
      }
      if (request.method === 'DELETE') {
        return handleRootDelete(request, env)
      }
      return handleRootGet(request, env)
    }
    return serveShell(request, env)
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      ensureSchema(env.DB)
        .then(() => purge(env))
        .catch((error) => {
          console.error('binflare scheduled task failed', error)
        }),
    )
  },
} satisfies ExportedHandler<Env>

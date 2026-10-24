import type { AppConfig } from './config'
import { compatError, corsHeaders, restError } from './http'
import { ServiceError } from './service'
import { ValidationError } from './validation'

export function restFromError(error: unknown, request: Request, config: AppConfig): Response {
  if (error instanceof ValidationError) {
    return restError(
      error.code === 'too_large' ? 413 : 400,
      error.code === 'too_large' ? 'payload_too_large' : 'invalid_request',
      error.message,
      corsHeaders(request, config.corsOrigin),
    )
  }
  if (error instanceof ServiceError) {
    const headers: Record<string, string> = corsHeaders(request, config.corsOrigin)
    if (error.retryAfter) {
      headers['retry-after'] = String(error.retryAfter)
    }
    return restError(error.status, error.code, error.upstreamMessage, headers)
  }
  console.error('binflare api error', error)
  return restError(500, 'internal', 'Internal server error.', corsHeaders(request, config.corsOrigin))
}

export function compatFromError(error: unknown): Response {
  if (error instanceof ValidationError || error instanceof ServiceError) {
    return compatError(
      error instanceof ServiceError ? error.upstreamMessage : error.message,
    )
  }
  console.error('binflare compat error', error)
  return compatError('Invalid data.')
}

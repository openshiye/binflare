import { DELETED, GENERIC_ERROR, INVALID_DATA, INVALID_ID, compatError, compatResult, htmlResponse, readJsonBody, requestIp, requestPath } from './http'
import { compatFromError } from './api'
import { createComment, createPaste, deletePaste, readPaste, ServiceError } from './service'
import {
  isCommentBody,
  isJsonApiCall,
  validateCommentRequest,
  validateDeleteToken,
  validateId,
  validatePasteRequest,
  ValidationError,
} from './validation'
import { getConfig } from './config'

function errorMessage(error: unknown): string {
  if (error instanceof ServiceError) {
    return error.upstreamMessage
  }
  if (error instanceof ValidationError) {
    return error.message
  }
  return GENERIC_ERROR
}

export async function handleRootGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const rawId = url.searchParams.get('pasteid')
  const json = isJsonApiCall(request)
  if (!rawId) {
    return json ? compatError(INVALID_DATA) : htmlResponse('Binflare', INVALID_ID, 400)
  }

  let id: string
  try {
    id = validateId(rawId)
  } catch {
    return json ? compatError(INVALID_ID) : htmlResponse('Invalid document', INVALID_ID, 400)
  }

  const token = url.searchParams.get('deletetoken')
  if (token) {
    try {
      const validToken = validateDeleteToken(token)
      await deletePaste(env, id, validToken)
      return json ? compatResult(id, requestPath(request)) : htmlResponse('Document deleted', DELETED)
    } catch (error) {
      return json
        ? compatFromError(error)
        : htmlResponse('Document not deleted', errorMessage(error), 200)
    }
  }

  if (!json) {
    return htmlResponse(
      'Binflare',
      'This document link is incomplete. Open the original link, including its #fragment.',
      200,
    )
  }

  try {
    const result = await readPaste(env, id)
    return compatResult(id, requestPath(request), result as unknown as Record<string, unknown>)
  } catch (error) {
    return compatFromError(error)
  }
}

export async function handleRootCreate(request: Request, env: Env): Promise<Response> {
  const config = getConfig(env)
  try {
    const body = await readJsonBody(request, config.maxCtBase64 + 200_000)
    const turnstileToken = request.headers.get('cf-turnstile-response') ?? undefined
    if (isCommentBody(body)) {
      const valid = validateCommentRequest(body, config)
      const result = await createComment(env, valid, requestIp(request), turnstileToken)
      return compatResult(result.id, requestPath(request))
    }
    const valid = validatePasteRequest(body, config)
    const result = await createPaste(env, valid, requestIp(request), turnstileToken)
    return compatResult(result.id, requestPath(request), {
      deletetoken: result.deleteToken,
    })
  } catch (error) {
    return compatFromError(error)
  }
}

export async function handleRootDelete(request: Request, env: Env): Promise<Response> {
  const config = getConfig(env)
  try {
    const body = await readJsonBody(request, config.maxCtBase64 + 200_000)
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return compatError(INVALID_DATA)
    }
    const record = body as Record<string, unknown>
    const id = validateId(record.pasteid)
    const token = validateDeleteToken(record.deletetoken)
    await deletePaste(env, id, token)
    return compatResult(id, requestPath(request))
  } catch (error) {
    return compatFromError(error)
  }
}

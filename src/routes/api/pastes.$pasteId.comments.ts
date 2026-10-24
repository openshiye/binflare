import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/pastes/$pasteId/comments')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const [{ env }, { getConfig }, { readJsonBody, jsonResponse, corsHeaders, requestIp }, { validateCommentRequest, validateId }, { createComment }, { restFromError }] =
          await Promise.all([
            import('cloudflare:workers'),
            import('../../server/config'),
            import('../../server/http'),
            import('../../server/validation'),
            import('../../server/service'),
            import('../../server/api'),
          ])
        const config = getConfig(env)
        try {
          const id = validateId(params.pasteId)
          const body = await readJsonBody(request, config.maxCtBase64 + 200_000)
          if (typeof body !== 'object' || body === null || Array.isArray(body)) {
            throw new Error('Invalid body')
          }
          const record = body as Record<string, unknown>
          const parentId =
            typeof record.parentId === 'string' && record.parentId.length > 0
              ? record.parentId
              : typeof record.parentid === 'string' && record.parentid.length > 0
                ? record.parentid
                : id
          const valid = validateCommentRequest(
            {
              v: record.v,
              adata: record.adata,
              ct: record.ct,
              pasteid: id,
              parentid: parentId,
            },
            config,
          )
          const result = await createComment(
            env,
            valid,
            requestIp(request),
            request.headers.get('cf-turnstile-response') ?? undefined,
          )
          return jsonResponse(
            { id: result.id, createdAt: result.createdAt },
            201,
            corsHeaders(request, config.corsOrigin),
          )
        } catch (error) {
          return restFromError(error, request, config)
        }
      },
    },
  },
})

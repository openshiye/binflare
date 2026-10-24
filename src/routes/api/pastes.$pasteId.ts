import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/pastes/$pasteId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const [{ env }, { getConfig }, { jsonResponse, corsHeaders }, { validateId }, { readPaste }, { restFromError }] =
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
          const result = await readPaste(env, id)
          return jsonResponse({ id, ...result }, 200, corsHeaders(request, config.corsOrigin))
        } catch (error) {
          return restFromError(error, request, config)
        }
      },
      DELETE: async ({ request, params }) => {
        const [{ env }, { getConfig }, { corsHeaders }, { validateDeleteToken, validateId, ValidationError }, { deletePaste }, { restFromError }] =
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
          const authorization = request.headers.get('authorization') ?? ''
          const token = authorization.toLowerCase().startsWith('bearer ')
            ? authorization.slice(7).trim()
            : ''
          if (!token) {
            throw new ValidationError('invalid', 'Missing bearer token.')
          }
          const validToken = validateDeleteToken(token)
          await deletePaste(env, id, validToken)
          return new Response(null, {
            status: 204,
            headers: {
              'cache-control': 'no-store',
              'x-content-type-options': 'nosniff',
              ...corsHeaders(request, config.corsOrigin),
            },
          })
        } catch (error) {
          return restFromError(error, request, config)
        }
      },
    },
  },
})

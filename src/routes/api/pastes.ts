import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/pastes')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ env }, { getConfig }, { readJsonBody, jsonResponse, corsHeaders, requestIp }, { validatePasteRequest }, { createPaste }, { restFromError }] =
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
          const body = await readJsonBody(request, config.maxCtBase64 + 200_000)
          const valid = validatePasteRequest(body, config)
          const result = await createPaste(
            env,
            valid,
            requestIp(request),
            request.headers.get('cf-turnstile-response') ?? undefined,
          )
          return jsonResponse(
            {
              id: result.id,
              deleteToken: result.deleteToken,
              expiresAt: result.expiresAt,
            },
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

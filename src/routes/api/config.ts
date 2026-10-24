import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [{ env }, { getConfig, getPublicConfig }, { jsonResponse, corsHeaders }] =
          await Promise.all([
            import('cloudflare:workers'),
            import('../../server/config'),
            import('../../server/http'),
          ])
        const config = getConfig(env)
        return jsonResponse(getPublicConfig(env), 200, {
          ...corsHeaders(request, config.corsOrigin),
          'cache-control': 'public, max-age=60',
        })
      },
    },
  },
})

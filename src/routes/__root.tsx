import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { I18nProvider } from '../lib/i18n'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
      { name: 'description', content: 'A zero-knowledge pastebin on Cloudflare Workers, compatible with the PrivateBin v2 protocol.' },
      { title: 'Binflare' },
    ],
    links: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script src="/theme.js" />
      </head>
      <body suppressHydrationWarning>
        <a className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground" href="#main-content">
          Skip to content
        </a>
        <noscript>
          <div className="mx-auto max-w-2xl p-6 text-sm">
            Binflare requires JavaScript for client-side encryption.
          </div>
        </noscript>
        <I18nProvider>
          <Outlet />
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  )
}

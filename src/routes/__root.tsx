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
      { title: 'Binflare' },
    ],
    links: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script src="/theme.js" />
      </head>
      <body>
        <noscript>
          <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
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

import { PROJECT } from '../lib/project'
import { useI18n } from '../lib/i18n'

export function SiteFooter() {
  const { t } = useI18n()
  const links = [
    { label: t('Protocol compatibility'), href: PROJECT.protocolDocsUrl },
    { label: t('Upstream PrivateBin'), href: PROJECT.upstreamUrl },
    { label: t('Source'), href: PROJECT.repositoryUrl },
    { label: t('License'), href: PROJECT.licenseUrl },
  ]

  return (
    <footer className="border-t bg-background/80">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>{t('A Cloudflare rewrite derived from PrivateBin.')}</span>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Footer">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}

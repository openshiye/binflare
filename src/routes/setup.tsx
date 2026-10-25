import { useEffect, useState } from 'react'
import { CircleCheck, CircleAlert, ExternalLink, RefreshCw } from 'lucide-react'
import { createFileRoute } from '@tanstack/react-router'
import { SiteHeader } from '../components/site-header'
import { SiteFooter } from '../components/site-footer'
import { AppShellSkeleton } from '../components/app-shell-skeleton'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { getClientConfig, type ClientConfig } from '../lib/api-client'
import { formatFileSize } from '../lib/attachments'
import { useI18n } from '../lib/i18n'
import { useMounted } from '../lib/use-mounted'
import { PROJECT } from '../lib/project'

export const Route = createFileRoute('/setup')({
  component: Setup,
})

function StatusRow({
  label,
  detail,
  status,
  state,
  children,
}: {
  label: string
  detail: string
  status: string
  state: 'ready' | 'attention' | 'manual'
  children?: React.ReactNode
}) {
  const Icon = state === 'ready' ? CircleCheck : CircleAlert
  const variant = state === 'ready' ? 'success' : state === 'attention' ? 'warning' : 'secondary'
  return (
    <div className="border-b p-4 last:border-b-0 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={`size-4 ${state === 'ready' ? 'text-success' : 'text-warning'}`} />
            <h2 className="text-sm font-semibold">{label}</h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
        <Badge variant={variant}>{status}</Badge>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  )
}

function Setup() {
  const { lang, t } = useI18n()
  const mounted = useMounted()
  const [config, setConfig] = useState<ClientConfig | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const previous = document.title
    document.title = lang === 'zh' ? '部署状态 — Binflare' : 'Deployment status — Binflare'
    return () => {
      document.title = previous
    }
  }, [lang])

  async function refresh() {
    setError('')
    try {
      const response = await fetch('/api/config', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      setConfig((await response.json()) as ClientConfig)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  useEffect(() => {
    void getClientConfig().then((next) => {
      setConfig((current) => current ?? next)
    })
  }, [])

  if (!mounted) {
    return <AppShellSkeleton />
  }

  const zh = lang === 'zh'
  const largePastes = config?.largePastes ?? false

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="about" />
      <main id="main-content" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('Deployment status')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('This page only reads the runtime configuration. It does not change Cloudflare resources.')}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw />
            {t('Refresh')}
          </Button>
        </div>

        {error ? (
          <div role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {t('Could not read the runtime configuration.')} {error}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('Capability check')}</CardTitle>
            <CardDescription>{t('Values come from the deployed Worker, not from a hard-coded template.')} </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <StatusRow
              label={t('D1 database')}
              detail={config ? t('Ready. The schema is initialized on the first API request.') : t('Checking...')}
              status={config ? t('Ready') : t('Checking')}
              state={config ? 'ready' : 'attention'}
            />
            <StatusRow
              label={t('Large pastes and attachments')}
              detail={
                config
                  ? largePastes
                    ? t('Enabled. The current deployment accepts ciphertext up to the configured R2 limit.')
                    : t('Not enabled. Short text and code snippets work; the current deployment cap is about 1.8 MB.')
                  : t('Checking...')
              }
              status={largePastes ? t('Enabled') : t('Not enabled')}
              state={largePastes ? 'ready' : 'attention'}
            >
              {config && !largePastes ? (
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                  <li>{t('Enable R2 in the Cloudflare dashboard and create the bucket used by this deployment.')}</li>
                  <li>{t('Redeploy the Worker once so Cloudflare attaches the R2 bucket.')}</li>
                  <li>{t('Return here and refresh. This page turns green when the Worker sees the R2 binding.')}</li>
                </ol>
              ) : null}
            </StatusRow>
            <StatusRow
              label={t('Effective ciphertext limit')}
              detail={
                config
                  ? `${formatFileSize(config.maxCiphertextBytes)} · ${t('D1-only tier')} ${formatFileSize(config.d1CiphertextBytes)}`
                  : t('Checking...')
              }
              status={config ? t('Detected') : t('Checking')}
              state={config ? 'ready' : 'attention'}
            />
            <StatusRow
              label={t('R2 lifecycle rule')}
              detail={t('The Worker cannot verify this rule from its runtime binding. Confirm it exists in the Cloudflare dashboard.')}
              status={t('Manual check')}
              state="manual"
            >
              <div className="flex flex-wrap gap-3 text-sm">
                <a href="https://dash.cloudflare.com/?to=/:account/r2" target="_blank" rel="noopener noreferrer">
                  {t('Open R2 dashboard')} <ExternalLink className="inline size-3.5" />
                </a>
                <a href={`${PROJECT.repositoryUrl}/blob/main/docs/DEPLOYMENT.md`} target="_blank" rel="noopener noreferrer">
                  {t('Lifecycle guide')} <ExternalLink className="inline size-3.5" />
                </a>
              </div>
            </StatusRow>
          </CardContent>
        </Card>

        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          {t('The D1 and R2 tiers are capabilities of the same deployment, not separate products.')}
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}

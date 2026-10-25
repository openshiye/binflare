import { useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { AppDialog } from './ui/dialog'

export function PasswordModal({
  onSubmit,
  error,
  busy,
  title,
  description,
  submitLabel,
}: {
  onSubmit: (password: string) => Promise<void>
  error?: string
  busy?: boolean
  title?: string
  description?: string
  submitLabel?: string
}) {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <AppDialog
      open
      onOpenChange={() => undefined}
      title={title ?? t('Password required')}
      description={description ?? t('This document was encrypted with a password. The server cannot verify or recover it.')}
      className="modal max-w-md"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit(password)
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="document-password">{t('Password')}</Label>
          <Input
            id="document-password"
            ref={inputRef}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
        </div>
        {error ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : null}
          {busy ? t('Working…') : submitLabel ?? t('Unlock')}
        </Button>
      </form>
      <p className="text-xs leading-5 text-muted-foreground">{t('The password is never sent to the server.')}</p>
    </AppDialog>
  )
}

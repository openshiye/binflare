import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'

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
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="password-title">
      <div className="modal">
        <p className="eyebrow">{t('Protected document')}</p>
        <h1 id="password-title">{title ?? t('Password required')}</h1>
        <p className="muted">
          {description ?? t('This document was encrypted with a password. The server cannot verify or recover it.')}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void onSubmit(password)
          }}
        >
          <label className="field">
            <span>{t('Password')}</span>
            <input
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
            />
          </label>
          {error ? <div className="alert error" role="alert">{error}</div> : null}
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? t('Working…') : submitLabel ?? t('Unlock')}
          </button>
        </form>
        <p className="muted small">{t('The password is never sent to the server.')}</p>
      </div>
    </div>
  )
}

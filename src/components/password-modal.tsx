import { useEffect, useRef, useState } from 'react'

export function PasswordModal({
  onSubmit,
  error,
  busy,
  title = 'Password required',
  description = 'This document was encrypted with a password. The server cannot verify or recover it.',
  submitLabel = 'Unlock',
}: {
  onSubmit: (password: string) => Promise<void>
  error?: string
  busy?: boolean
  title?: string
  description?: string
  submitLabel?: string
}) {
  const [password, setPassword] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="password-title">
      <div className="modal">
        <p className="eyebrow">Protected document</p>
        <h1 id="password-title">{title}</h1>
        <p className="muted">{description}</p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void onSubmit(password)
          }}
        >
          <label className="field">
            <span>Password</span>
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
            {busy ? 'Working…' : submitLabel}
          </button>
        </form>
        <p className="muted small">The password is never sent to the server.</p>
      </div>
    </div>
  )
}

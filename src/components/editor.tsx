import { useEffect, useRef, useState } from 'react'
import type { ClientConfig } from '../lib/api-client'
import type { ExpireKey, Formatter } from '../lib/protocol'
import { ContentRenderer } from './content'
import { TurnstileWidget } from './turnstile'

export interface CreateInput {
  text: string
  format: Formatter
  expire: ExpireKey
  password: string
  discussion: boolean
  burn: boolean
  turnstileToken: string
}

const EXPIRY_LABELS: Record<ExpireKey, string> = {
  '5min': '5 minutes',
  '10min': '10 minutes',
  '1hour': '1 hour',
  '1day': '1 day',
  '1week': '1 week',
  '1month': '1 month',
  '1year': '1 year',
  never: 'Never',
}

const FORMAT_LABELS: Record<Formatter, string> = {
  plaintext: 'Text',
  markdown: 'Markdown',
  syntaxhighlighting: 'Code',
}

function formatBytes(bytes: number): string {
  if (bytes < 1000) {
    return `${bytes} B`
  }
  if (bytes < 1_000_000) {
    return `${(bytes / 1000).toFixed(1)} KB`
  }
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

export function Editor({
  config,
  busy,
  error,
  onCreate,
}: {
  config: ClientConfig
  busy: boolean
  error?: string
  onCreate: (input: CreateInput) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [format, setFormat] = useState<Formatter>(config.formatterDefault)
  const [expire, setExpire] = useState<ExpireKey>(config.expireDefault)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [discussion, setDiscussion] = useState(false)
  const [burn, setBurn] = useState(false)
  const [tab, setTab] = useState<'editor' | 'preview'>('editor')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileKey, setTurnstileKey] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (error) {
      setTurnstileToken('')
      setTurnstileKey((value) => value + 1)
    }
  }, [error])

  useEffect(() => {
    if (!config.expire.includes(expire)) {
      setExpire(config.expireDefault)
    }
    if (!config.formatters.includes(format)) {
      setFormat(config.formatterDefault)
    }
  }, [config, expire, format])

  const bytes = new TextEncoder().encode(text).length
  const canSubmit = text.trim().length > 0 && !busy

  function submit() {
    if (!canSubmit) {
      return
    }
    void onCreate({
      text,
      format,
      expire,
      password,
      discussion,
      burn,
      turnstileToken,
    })
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      submit()
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      const target = event.currentTarget
      const start = target.selectionStart
      const end = target.selectionEnd
      const next = `${text.slice(0, start)}\t${text.slice(end)}`
      setText(next)
      requestAnimationFrame(() => {
        target.selectionStart = start + 1
        target.selectionEnd = start + 1
      })
    }
  }

  return (
    <section className="editor" aria-labelledby="editor-title">
      <div className="editor-heading">
        <div>
          <p className="eyebrow">Zero-knowledge paste</p>
          <h1 id="editor-title">Write it. Encrypt it. Share the link.</h1>
        </div>
        <p className="muted editor-note">
          Encryption happens in this browser. The key stays in the URL fragment and never reaches
          the server.
        </p>
      </div>

      <div className="card editor-card">
        <div className="tabs" role="tablist" aria-label="Editor mode">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'editor'}
            className={tab === 'editor' ? 'tab active' : 'tab'}
            onClick={() => setTab('editor')}
          >
            Editor
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            className={tab === 'preview' ? 'tab active' : 'tab'}
            onClick={() => setTab('preview')}
          >
            Preview
          </button>
          <span className="spacer" />
          <span className="byte-count">
            {formatBytes(bytes)} text
            <span className="muted"> · ciphertext ≤ {formatBytes(config.maxCiphertextBytes)}</span>
          </span>
        </div>

        {tab === 'editor' ? (
          <label className="editor-textarea">
            <span className="sr-only">Paste content</span>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Paste or type something worth keeping private…"
              spellCheck={false}
              rows={14}
            />
          </label>
        ) : (
          <div className="preview">
            {text.length > 0 ? (
              <ContentRenderer text={text} format={format} />
            ) : (
              <p className="muted">Nothing to preview yet.</p>
            )}
          </div>
        )}

        <div className="editor-options">
          <label className="field compact">
            <span>Expires</span>
            <select value={expire} onChange={(event) => setExpire(event.target.value as ExpireKey)}>
              {config.expire.map((key) => (
                <option key={key} value={key}>
                  {EXPIRY_LABELS[key] ?? key}
                </option>
              ))}
            </select>
          </label>

          <label className="field compact">
            <span>Format</span>
            <select value={format} onChange={(event) => setFormat(event.target.value as Formatter)}>
              {config.formatters.map((key) => (
                <option key={key} value={key}>
                  {FORMAT_LABELS[key] ?? key}
                </option>
              ))}
            </select>
          </label>

          <label className="field compact password-field">
            <span>Password (optional)</span>
            <span className="password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="No password"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="button ghost small"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={burn}
              onChange={(event) => {
                setBurn(event.target.checked)
                if (event.target.checked) {
                  setDiscussion(false)
                }
              }}
            />
            <span>Burn after reading</span>
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={discussion}
              disabled={burn}
              onChange={(event) => {
                setDiscussion(event.target.checked)
                if (event.target.checked) {
                  setBurn(false)
                }
              }}
            />
            <span>Open discussion</span>
          </label>
        </div>

        {password.length > 0 ? (
          <p className="muted small">
            The password cannot be recovered. The recipient needs both the link and the password.
          </p>
        ) : null}

        {burn ? (
          <p className="alert warning small">
            A burn link is prefixed with <code>#-</code>. Opening it destroys the paste after one
            read. Send it only when the recipient is ready.
          </p>
        ) : null}

        {config.turnstileSiteKey ? (
          <TurnstileWidget key={turnstileKey} siteKey={config.turnstileSiteKey} onToken={setTurnstileToken} />
        ) : null}

        {error ? <div className="alert error" role="alert">{error}</div> : null}

        <div className="editor-actions">
          <button type="button" className="button primary" onClick={submit} disabled={!canSubmit}>
            {busy ? 'Encrypting…' : 'Create paste'}
          </button>
          <span className="muted small">⌘/Ctrl + S to submit</span>
        </div>
      </div>

      <p className="muted small footer-note">
        Supports PrivateBin v2 pastes, comments and delete links. Not affiliated with the
        PrivateBin project.
      </p>
    </section>
  )
}

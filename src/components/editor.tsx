import { useEffect, useRef, useState } from 'react'
import type { ClientConfig } from '../lib/api-client'
import type { ExpireKey, Formatter } from '../lib/protocol'
import {
  attachmentSize,
  fileToAttachment,
  formatFileSize,
  previewKind,
  type DraftAttachment,
} from '../lib/attachments'
import { ContentRenderer } from './content'
import { TurnstileWidget } from './turnstile'
import { useI18n } from '../lib/i18n'

export interface CreateInput {
  text: string
  format: Formatter
  expire: ExpireKey
  password: string
  discussion: boolean
  burn: boolean
  turnstileToken: string
  attachments: DraftAttachment[]
}

export interface EditorInitial {
  text: string
  format: Formatter
  attachments: DraftAttachment[]
  clone?: boolean
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
  initial,
  onCreate,
}: {
  config: ClientConfig
  busy: boolean
  error?: string
  initial?: EditorInitial
  onCreate: (input: CreateInput) => Promise<void>
}) {
  const [text, setText] = useState(initial?.text ?? '')
  const [format, setFormat] = useState<Formatter>(initial?.format ?? config.formatterDefault)
  const [expire, setExpire] = useState<ExpireKey>(config.expireDefault)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [discussion, setDiscussion] = useState(false)
  const [burn, setBurn] = useState(false)
  const [tab, setTab] = useState<'editor' | 'preview'>('editor')
  const [attachments, setAttachments] = useState<DraftAttachment[]>(initial?.attachments ?? [])
  const [fileError, setFileError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileKey, setTurnstileKey] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { t } = useI18n()

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
  const attachmentBytes = attachments.reduce((sum, item) => sum + item.size, 0)
  const canSubmit = (text.trim().length > 0 || attachments.length > 0) && !busy

  async function addFiles(files: File[]): Promise<void> {
    if (files.length === 0) {
      return
    }
    setFileError('')
    const added: DraftAttachment[] = []
    for (const file of files) {
      if (file.size === 0) {
        continue
      }
      try {
        added.push(await fileToAttachment(file))
      } catch {
        setFileError(`${t('Could not read')} ${file.name}.`)
      }
    }
    if (added.length > 0) {
      setAttachments((current) => [...current, ...added])
    }
  }

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
      attachments,
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
    <section
      className={dragging ? 'editor dragging' : 'editor'}
      aria-labelledby="editor-title"
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setDragging(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        void addFiles(Array.from(event.dataTransfer.files))
      }}
    >
      <div className="editor-heading">
        <div>
          <p className="eyebrow">{t('Zero-knowledge paste')}</p>
          <h1 id="editor-title">{t('Write it. Encrypt it. Share the link.')}</h1>
        </div>
        <p className="muted editor-note">
          {t('Encryption happens in this browser. The key stays in the URL fragment and never reaches the server.')}
        </p>
      </div>

      {initial?.clone ? (
        <div className="alert info" role="status">
          {t('Cloning an existing document. Text, format and attachments are copied into this editor; password, expiry and burn settings are reset.')}
        </div>
      ) : null}

      <div className="card editor-card">
        <div className="tabs" role="tablist" aria-label="Editor mode">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'editor'}
            className={tab === 'editor' ? 'tab active' : 'tab'}
            onClick={() => setTab('editor')}
          >
            {t('Editor')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            className={tab === 'preview' ? 'tab active' : 'tab'}
            onClick={() => setTab('preview')}
          >
            {t('Preview')}
          </button>
          <span className="spacer" />
          <span className="byte-count">
            {formatBytes(bytes + attachmentBytes)} {t('text+files')}
            <span className="muted"> · {t('ciphertext ≤')} {formatBytes(config.maxCiphertextBytes)}</span>
          </span>
        </div>

        {tab === 'editor' ? (
          <label className="editor-textarea">
            <span className="sr-only">{t('Editor')}</span>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
              onPaste={(event) => {
                if (event.clipboardData.files.length > 0) {
                  event.preventDefault()
                  void addFiles(Array.from(event.clipboardData.files))
                }
              }}
              placeholder={t('Paste or type something worth keeping private…')}
              spellCheck={false}
              rows={14}
            />
          </label>
        ) : (
          <div className="preview">
            {text.length > 0 ? (
              <ContentRenderer text={text} format={format} />
            ) : attachments.length > 0 ? (
              <p className="muted">{t('Attachments are included; add text if you want a preview.')}</p>
            ) : (
              <p className="muted">{t('Nothing to preview yet.')}</p>
            )}
          </div>
        )}

        <div className="editor-options">
          <label className="field compact">
            <span>{t('Expires')}</span>
            <select value={expire} onChange={(event) => setExpire(event.target.value as ExpireKey)}>
              {config.expire.map((key) => (
                <option key={key} value={key}>
                  {t(EXPIRY_LABELS[key] ?? key)}
                </option>
              ))}
            </select>
          </label>

          <label className="field compact">
            <span>{t('Format')}</span>
            <select value={format} onChange={(event) => setFormat(event.target.value as Formatter)}>
              {config.formatters.map((key) => (
                <option key={key} value={key}>
                  {t(FORMAT_LABELS[key] ?? key)}
                </option>
              ))}
            </select>
          </label>

          <label className="field compact password-field">
            <span>{t('Password (optional)')}</span>
            <span className="password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('No password')}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="button ghost small"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? t('Hide password') : t('Show password')}
              >
                {showPassword ? t('Hide') : t('Show')}
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
            <span>{t('Burn after reading')}</span>
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
            <span>{t('Open discussion')}</span>
          </label>
        </div>

        <div className="attachment-editor">
          <div className="attachment-toolbar">
            <button
              type="button"
              className="button ghost small"
              onClick={() => fileInputRef.current?.click()}
            >
              {t('Attach files')}
            </button>
            <span className="muted small">
              {t('Or drag and drop / paste files. Files are encrypted inside the document.')}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => {
                void addFiles(Array.from(event.target.files ?? []))
                event.target.value = ''
              }}
            />
          </div>
          {attachments.length > 0 ? (
            <ul className="attachment-drafts">
              {attachments.map((attachment) => {
                const kind = previewKind(attachment.mime)
                return (
                  <li key={attachment.id} className="attachment-draft">
                    {kind === 'image' ? (
                      <img src={attachment.dataUrl} alt="" className="attachment-thumb" />
                    ) : (
                      <span className="attachment-icon">{attachment.name.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'}</span>
                    )}
                    <span className="attachment-draft-name">{attachment.name}</span>
                    <span className="muted small">{formatFileSize(attachment.size)}</span>
                    <button
                      type="button"
                      className="button ghost tiny"
                      onClick={() =>
                        setAttachments((current) => current.filter((item) => item.id !== attachment.id))
                      }
                    >
                      {t('Remove')}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
          {attachments.length > 0 && attachmentBytes > 0 ? (
            <p className="muted small">
              {t('Attachments:')} {formatFileSize(attachmentBytes)} {t('before encryption.')}
            </p>
          ) : null}
        </div>

        {password.length > 0 ? (
          <p className="muted small">
            {t('The password cannot be recovered. The recipient needs both the link and the password.')}
          </p>
        ) : null}

        {burn ? (
          <p className="alert warning small">
            {t('A burn link is prefixed with')} <code>#-</code>
            {t('. Opening it destroys the paste after one read. Send it only when the recipient is ready.')}
          </p>
        ) : null}

        {config.turnstileSiteKey ? (
          <TurnstileWidget key={turnstileKey} siteKey={config.turnstileSiteKey} onToken={setTurnstileToken} />
        ) : null}

        {fileError ? <div className="alert error" role="alert">{fileError}</div> : null}
        {error ? <div className="alert error" role="alert">{error}</div> : null}

        <div className="editor-actions">
          <button type="button" className="button primary" onClick={submit} disabled={!canSubmit}>
            {busy ? t('Encrypting…') : t('Create paste')}
          </button>
          <span className="muted small">{t('⌘/Ctrl + S to submit')}</span>
        </div>
      </div>

      {dragging ? <div className="drop-overlay">{t('Drop files to attach')}</div> : null}

      <p className="muted small footer-note">
        {t('Supports PrivateBin v2 pastes, comments and delete links. Not affiliated with the PrivateBin project.')}
      </p>
    </section>
  )
}

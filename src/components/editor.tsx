import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, FilePlus2, LoaderCircle, Paperclip, Trash2, X } from 'lucide-react'
import type { ApiErrorKind, ClientConfig } from '../lib/api-client'
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
import { PROJECT } from '../lib/project'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'

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
  errorKind,
  initial,
  onCreate,
}: {
  config: ClientConfig
  busy: boolean
  error?: string
  errorKind?: ApiErrorKind | ''
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
  const canSubmit =
    (text.trim().length > 0 || attachments.length > 0) &&
    !busy &&
    (!config.turnstileSiteKey || turnstileToken.length > 0)

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
      <div className="mb-6 flex flex-col gap-2 sm:mb-7">
        <h1 id="editor-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('Write it. Encrypt it. Share the link.')}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {t('Encryption happens in this browser. The key stays in the URL fragment and never reaches the server.')}
        </p>
      </div>

      {initial?.clone ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm text-foreground"
        >
          {t('Cloning an existing document. Text, format and attachments are copied into this editor; password, expiry and burn settings are reset.')}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex min-h-10 flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-1 rounded-lg bg-background p-1 shadow-xs" role="tablist" aria-label="Editor mode">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'editor'}
              className={`rounded-md px-3 py-1 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring ${tab === 'editor' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setTab('editor')}
            >
              {t('Editor')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'preview'}
              className={`rounded-md px-3 py-1 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring ${tab === 'preview' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setTab('preview')}
            >
              {t('Preview')}
            </button>
          </div>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {formatBytes(bytes + attachmentBytes)} {t('text+files')}
            <span className="hidden sm:inline"> · {t('ciphertext ≤')} {formatBytes(config.maxCiphertextBytes)}</span>
          </span>
        </div>

        {tab === 'editor' ? (
          <div className="px-3 pt-3 sm:px-4 sm:pt-4">
            <Label htmlFor="paste-content" className="sr-only">
              {t('Editor')}
            </Label>
            <Textarea
              id="paste-content"
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
              className="min-h-[19rem] resize-y border-0 bg-transparent px-0 py-0 font-mono text-sm shadow-none focus-visible:ring-0"
            />
          </div>
        ) : (
          <CardContent className="min-h-[19rem] p-4">
            {text.length > 0 ? (
              <ContentRenderer text={text} format={format} />
            ) : attachments.length > 0 ? (
              <CardDescription>{t('Attachments are included; add text if you want a preview.')}</CardDescription>
            ) : (
              <CardDescription>{t('Nothing to preview yet.')}</CardDescription>
            )}
          </CardContent>
        )}

        <div className="grid gap-4 border-t bg-card p-4 sm:p-5 lg:grid-cols-[minmax(0,14rem)_minmax(0,14rem)_minmax(0,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="paste-expiry">{t('Expires')}</Label>
            <select
              id="paste-expiry"
              value={expire}
              onChange={(event) => setExpire(event.target.value as ExpireKey)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
            >
              {config.expire.map((key) => (
                <option key={key} value={key}>
                  {t(EXPIRY_LABELS[key] ?? key)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paste-format">{t('Format')}</Label>
            <select
              id="paste-format"
              value={format}
              onChange={(event) => setFormat(event.target.value as Formatter)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
            >
              {config.formatters.map((key) => (
                <option key={key} value={key}>
                  {t(FORMAT_LABELS[key] ?? key)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paste-password">{t('Password (optional)')}</Label>
            <div className="flex gap-2">
              <Input
                id="paste-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('No password')}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? t('Hide password') : t('Show password')}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 lg:col-span-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={burn}
                onChange={(event) => {
                  setBurn(event.target.checked)
                  if (event.target.checked) {
                    setDiscussion(false)
                  }
                }}
                className="size-4 accent-primary"
              />
              <span>{t('Burn after reading')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
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
                className="size-4 accent-primary"
              />
              <span>{t('Open discussion')}</span>
            </label>
          </div>
        </div>

        <div className="border-t px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FilePlus2 />
              {t('Attach files')}
            </Button>
            <span className="text-xs text-muted-foreground">
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
            <ul className="mt-3 grid gap-2">
              {attachments.map((attachment) => {
                const kind = previewKind(attachment.mime)
                return (
                  <li key={attachment.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2">
                    {kind === 'image' ? (
                      <img src={attachment.dataUrl} alt="" className="size-8 rounded border object-cover" />
                    ) : (
                      <span className="grid size-8 place-items-center rounded border text-[0.55rem] font-mono text-muted-foreground">
                        {attachment.name.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{attachment.name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`${t('Remove')} ${attachment.name}`}
                      onClick={() =>
                        setAttachments((current) => current.filter((item) => item.id !== attachment.id))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {attachments.length > 0 && attachmentBytes > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('Attachments:')} {formatFileSize(attachmentBytes)} {t('before encryption.')}
            </p>
          ) : null}
        </div>

        <CardContent className="space-y-3 border-t px-4 py-4 sm:px-5">
          {password.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('The password cannot be recovered. The recipient needs both the link and the password.')}
            </p>
          ) : null}

          {burn ? (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              {t('A burn link is prefixed with')} <code>#-</code>
              {t('. Opening it destroys the paste after one read. Send it only when the recipient is ready.')}
            </div>
          ) : null}

          {config.turnstileSiteKey ? (
            <TurnstileWidget key={turnstileKey} siteKey={config.turnstileSiteKey} onToken={setTurnstileToken} />
          ) : null}

          {fileError ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <X className="mt-0.5 size-4" />
              <span>{fileError}</span>
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {errorKind === 'rate_limit' || errorKind === 'too_large' ? (
            <div className="rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm">
              {t('Preview is shared and rate-limited. Deploy your own in one click — no limits.')}{' '}
              <a href={PROJECT.repositoryUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">
                {t('Deploy your own')}
              </a>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button size="lg" onClick={submit} disabled={!canSubmit}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Paperclip />}
              {busy ? t('Encrypting…') : t('Create paste')}
            </Button>
            <span className="text-xs text-muted-foreground">{t('⌘/Ctrl + S to submit')}</span>
          </div>
        </CardContent>
      </Card>

      {dragging ? (
        <div className="drop-overlay">
          <span>{t('Drop files to attach')}</span>
        </div>
      ) : null}

      {!config.largePastes ? (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm leading-6">
          {t('Current paste limit is about 1.8 MB; enable R2 to raise it to 10 MB.')}{' '}
          <a href="/setup" className="font-medium underline underline-offset-4">
            {t('Deployment status')}
          </a>
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        {t('Supports PrivateBin v2 pastes, comments and delete links. A Cloudflare rewrite derived from PrivateBin.')}
      </p>
    </section>
  )
}

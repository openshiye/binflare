import { useEffect, useState } from 'react'
import {
  ApiError,
  FALLBACK_CONFIG,
  createPaste,
  getClientConfig,
  readPaste,
  type ClientConfig,
  type CommentRecord,
  type ReadResponse,
} from '../lib/api-client'
import {
  CryptoError,
  createPasteCipher,
  decodeKey,
  decryptMessage,
  parseCommentPayload,
  parsePastePayload,
} from '../lib/crypto'
import { buildDeleteUrl, buildPasteUrl, readPasteTarget, readPublicPasteId, type PasteTarget } from '../lib/fragment'
import { EXPIRY_OPTIONS, type Formatter, type PastePayload } from '../lib/protocol'
import { normalizeAttachments } from '../lib/format'
import { attachmentSize, dataUrlInfo, type DraftAttachment } from '../lib/attachments'
import { Editor, type CreateInput, type EditorInitial } from './editor'
import { PasswordModal } from './password-modal'
import { Viewer, type CreatedInfo } from './viewer'
import type { DecryptedComment } from './comments'
import { SiteHeader } from './site-header'
import { useI18n } from '../lib/i18n'

type Screen = 'boot' | 'create' | 'loading' | 'burn-confirm' | 'burn-password' | 'password' | 'view' | 'error'

async function decryptComments(
  records: CommentRecord[],
  keyBase58: string,
  password: string,
): Promise<DecryptedComment[]> {
  return Promise.all(
    records.map(async (record) => {
      try {
        const decrypted = await decryptMessage(keyBase58, password, record.ct, record.adata)
        const parsed = parseCommentPayload(JSON.parse(decrypted.plaintext))
        return {
          id: record.id,
          parentid: record.parentid,
          created: record.meta.created,
          text: parsed.comment,
          nickname: parsed.nickname,
        }
      } catch {
        return {
          id: record.id,
          parentid: record.parentid,
          created: record.meta.created,
          text: '',
          error: true,
        }
      }
    }),
  )
}

function fullUrl(target: PasteTarget): string {
  const path = buildPasteUrl(window.location.pathname, target.id, target.key, target.burn)
  return new URL(path, window.location.origin).toString()
}

function messageFor(error: unknown, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (error instanceof ApiError) {
    if (error.kind === 'not_found') {
      return t('Document does not exist, has expired or has been deleted.')
    }
    if (error.kind === 'network') {
      return t('Could not reach the server.')
    }
    if (error.kind === 'too_large') {
      return t('The document is too large.')
    }
    if (error.kind === 'rate_limit') {
      const seconds = error.message.match(/(\d+)/)?.[1] ?? ''
      return t('Please wait {seconds} seconds between each post.', { seconds })
    }
    return error.message
  }
  return error instanceof Error ? error.message : t('Something went wrong.')
}

export function App() {
  const { t } = useI18n()
  const [insecure, setInsecure] = useState(false)
  const [config, setConfig] = useState<ClientConfig>(FALLBACK_CONFIG)
  const [screen, setScreen] = useState<Screen>('boot')
  const [target, setTarget] = useState<PasteTarget | null>(null)
  const [response, setResponse] = useState<ReadResponse | null>(null)
  const [payload, setPayload] = useState<PastePayload | null>(null)
  const [comments, setComments] = useState<DecryptedComment[]>([])
  const [mode, setMode] = useState<'gcm' | 'ctr' | 'cbc'>('gcm')
  const [keyBytes, setKeyBytes] = useState<Uint8Array | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<CreatedInfo | undefined>()
  const [pasteUrl, setPasteUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [editorInitial, setEditorInitial] = useState<EditorInitial | undefined>()
  const [editorKey, setEditorKey] = useState(0)
  const [cloneChildren, setCloneChildren] = useState<string[]>([])

  async function load(nextTarget: PasteTarget, nextPassword: string, silent = false): Promise<boolean> {
    if (!silent) {
      setScreen('loading')
    }
    setError('')
    try {
      const data = await readPaste(nextTarget.id)
      const decrypted = await decryptMessage(nextTarget.key, nextPassword, data.ct, data.adata)
      const parsed = parsePastePayload(JSON.parse(decrypted.plaintext))
      const decryptedComments = await decryptComments(data.comments, nextTarget.key, nextPassword)
      setTarget(nextTarget)
      setPasteUrl(fullUrl(nextTarget))
      setResponse(data)
      setPayload(parsed)
      setComments(decryptedComments)
      setMode(decrypted.mode)
      setKeyBytes(decodeKey(nextTarget.key))
      setPassword(nextPassword)
      setPasswordError('')
      setScreen('view')
      return true
    } catch (reason) {
      if (reason instanceof CryptoError && (reason.code === 'auth' || reason.code === 'decrypt')) {
        if (nextTarget.burn) {
          setError(
            nextPassword
              ? 'The document was destroyed, but the password was wrong or the document was corrupted.'
              : 'The document was destroyed. It may have required a password.',
          )
          setScreen('error')
          return false
        }
        setScreen('password')
        setPasswordError(nextPassword ? t('Wrong password. Try again.') : '')
        return false
      }
      setError(messageFor(reason, t))
      setScreen('error')
      return false
    }
  }

  function initialize(): void {
    const nextTarget = readPasteTarget(window.location.search, window.location.hash)
    setCreated(undefined)
    setPassword('')
    setPasswordError('')
    setCreateError('')
    if (!nextTarget) {
      if (readPublicPasteId(window.location.search)) {
        setError(t('This link is missing its decryption key (#fragment). Open the complete original link.'))
        setScreen('error')
        return
      }
      setTarget(null)
      setResponse(null)
      setPayload(null)
      setComments([])
      setPasteUrl('')
      setEditorInitial(undefined)
      setCloneChildren([])
      setEditorKey((value) => value + 1)
      setScreen('create')
      return
    }
    setTarget(nextTarget)
    setPasteUrl(fullUrl(nextTarget))
    if (nextTarget.burn) {
      setScreen('burn-confirm')
      return
    }
    void load(nextTarget, '')
  }

  useEffect(() => {
    void getClientConfig().then(setConfig)
    setInsecure(!window.isSecureContext || !window.crypto?.subtle)
    initialize()
    const onPopState = () => {
      initialize()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
    // initialize only reads the current location and sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePasswordSubmit(value: string): Promise<void> {
    if (!target) {
      return
    }
    setPasswordBusy(true)
    await load(target, value)
    setPasswordBusy(false)
  }

  function handleBurnConfirm(): void {
    if (!target) {
      return
    }
    setScreen('burn-password')
  }

  async function handleBurnPassword(value: string): Promise<void> {
    if (!target) {
      return
    }
    setPasswordBusy(true)
    await load(target, value)
    setPasswordBusy(false)
  }

  async function handleCreate(input: CreateInput): Promise<void> {
    setCreating(true)
    setCreateError('')
    try {
      const encrypted = await createPasteCipher(input.text, {
        password: input.password,
        expire: input.expire,
        formatter: input.format,
        discussion: input.discussion,
        burn: input.burn,
        attachments: input.attachments.map((attachment) => ({
          name: attachment.name,
          dataUrl: attachment.dataUrl,
        })),
        children: cloneChildren,
      })
      const result = await createPaste(encrypted.request, input.turnstileToken || undefined)
      const nextTarget: PasteTarget = {
        id: result.id,
        key: encrypted.keyBase58,
        burn: input.burn,
      }
      const path = buildPasteUrl(window.location.pathname, result.id, encrypted.keyBase58, input.burn)
      window.history.pushState({}, '', path)
      const ttl = EXPIRY_OPTIONS[input.expire]
      const localPayload: PastePayload = { paste: input.text }
      if (input.attachments.length > 0) {
        localPayload.attachment = input.attachments.map((attachment) => attachment.dataUrl)
        localPayload.attachment_name = input.attachments.map((attachment) => attachment.name)
      }
      if (cloneChildren.length > 0) {
        localPayload.children = cloneChildren
      }
      const createdResponse: ReadResponse = {
        status: 0,
        id: result.id,
        url: `/?${result.id}`,
        v: 2,
        adata: encrypted.request.adata,
        ct: encrypted.request.ct,
        meta: ttl > 0 ? { time_to_live: ttl } : {},
        comments: [],
        comment_count: 0,
        comment_offset: 0,
      }
      setTarget(nextTarget)
      setPasteUrl(fullUrl(nextTarget))
      setResponse(createdResponse)
      setPayload(localPayload)
      setComments([])
      setMode('gcm')
      setKeyBytes(encrypted.keyBytes)
      setPassword(input.password)
      setCreated({
        deleteUrl: buildDeleteUrl(window.location.pathname, result.id, result.deletetoken),
        keyBase58: encrypted.keyBase58,
      })
      setEditorInitial(undefined)
      setCloneChildren([])
      setScreen('view')
      window.scrollTo({ top: 0 })
    } catch (reason) {
      setCreateError(messageFor(reason, t))
    } finally {
      setCreating(false)
    }
  }

  function handleNew(): void {
    window.history.pushState({}, '', '/')
    setTarget(null)
    setResponse(null)
    setPayload(null)
    setComments([])
    setCreated(undefined)
    setPassword('')
    setPasswordError('')
    setCreateError('')
    setError('')
    setEditorInitial(undefined)
    setCloneChildren([])
    setEditorKey((value) => value + 1)
    setScreen('create')
  }

  function handleClone(source: { payload: PastePayload; format: Formatter; pasteUrl: string }): void {
    const attachments: DraftAttachment[] = normalizeAttachments(source.payload).map((attachment) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: attachment.name,
      dataUrl: attachment.url,
      size: attachmentSize(attachment.url),
      mime: dataUrlInfo(attachment.url)?.mime ?? 'application/octet-stream',
    }))
    window.history.pushState({}, '', '/')
    setEditorInitial({
      text: source.payload.paste,
      format: source.format,
      attachments,
      clone: true,
    })
    setCloneChildren([...(source.payload.children ?? []), source.pasteUrl])
    setEditorKey((value) => value + 1)
    setTarget(null)
    setResponse(null)
    setPayload(null)
    setComments([])
    setCreated(undefined)
    setPassword('')
    setPasswordError('')
    setCreateError('')
    setError('')
    setScreen('create')
    window.scrollTo({ top: 0 })
  }

  async function handleRefresh(): Promise<void> {
    if (!target) {
      return
    }
    await load(target, password, true)
  }

  return (
    <div className="app-shell">
      <SiteHeader onHome={handleNew} current="home" />

      <main className="site-main">
        {insecure ? (
          <div className="alert error" role="alert">
            {t('This site requires HTTPS. WebCrypto is unavailable in an insecure context.')}
          </div>
        ) : null}
        {screen === 'boot' || screen === 'loading' ? (
          <div className="screen-center">
            <p className="eyebrow">{t('Encrypted document')}</p>
            <p className="loading-line">{t('Decrypting locally…')}</p>
          </div>
        ) : null}

        {screen === 'create' ? (
          <Editor
            key={editorKey}
            config={config}
            busy={creating}
            error={createError}
            initial={editorInitial}
            onCreate={handleCreate}
          />
        ) : null}

        {screen === 'burn-confirm' && target ? (
          <section className="screen-center card confirm-card">
            <p className="eyebrow">{t('Burn after reading')}</p>
            <h1>{t('Read once, then it is gone.')}</h1>
            <p className="muted">
              {t('Opening this document deletes it on the server. There is no second chance and no recovery.')}
            </p>
            <div className="form-actions">
              <button type="button" className="button primary" onClick={handleBurnConfirm}>
                {t('Read and destroy')}
              </button>
              <button type="button" className="button ghost" onClick={handleNew}>
                {t('Cancel')}
              </button>
            </div>
          </section>
        ) : null}

        {screen === 'password' ? (
          <PasswordModal onSubmit={handlePasswordSubmit} error={passwordError} busy={passwordBusy} />
        ) : null}

        {screen === 'burn-password' && target ? (
          <PasswordModal
            onSubmit={handleBurnPassword}
            busy={passwordBusy}
            title={t('Password (if set)')}
            description={t('Enter the password if one was set. Reading destroys the document, even if the password is wrong.')}
            submitLabel={t('Read and destroy')}
          />
        ) : null}

        {screen === 'error' ? (
          <section className="screen-center card error-card">
            <p className="eyebrow">{t('Unable to open')}</p>
            <h1>{t('Document unavailable')}</h1>
            <p className="muted">{error}</p>
            <button type="button" className="button primary" onClick={handleNew}>
              {t('Create a new document')}
            </button>
          </section>
        ) : null}

        {screen === 'view' && target && response && payload && keyBytes ? (
          <Viewer
            target={target}
            response={response}
            payload={payload}
            comments={comments}
            mode={mode}
            keyBytes={keyBytes}
            password={password}
            turnstileSiteKey={config.turnstileSiteKey}
            pasteUrl={pasteUrl}
            created={created}
            onNew={handleNew}
            onRefresh={handleRefresh}
            onClone={handleClone}
          />
        ) : null}
      </main>

      <footer className="site-footer">
        <span>{t('Protocol-compatible with PrivateBin 2.1.0.')}</span>
        <span>{t('Not affiliated with or endorsed by the PrivateBin project.')}</span>
      </footer>
    </div>
  )
}

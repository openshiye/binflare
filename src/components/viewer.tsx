import { useState } from 'react'
import type { ReadResponse } from '../lib/api-client'
import { copyText } from '../lib/clipboard'
import { formatTimeToLive } from '../lib/format'
import type { Formatter, PastePayload } from '../lib/protocol'
import { isFormatter } from '../lib/protocol'
import type { PasteTarget } from '../lib/fragment'
import { AttachmentList, ChildrenLinks, ContentRenderer } from './content'
import { Comments, type DecryptedComment } from './comments'
import { useI18n } from '../lib/i18n'

export interface CreatedInfo {
  deleteUrl: string
  keyBase58: string
}

export function Viewer({
  target,
  response,
  payload,
  comments,
  mode,
  keyBytes,
  password,
  turnstileSiteKey,
  pasteUrl,
  created,
  onNew,
  onRefresh,
  onClone,
}: {
  target: PasteTarget
  response: ReadResponse
  payload: PastePayload
  comments: DecryptedComment[]
  mode: 'gcm' | 'ctr' | 'cbc'
  keyBytes: Uint8Array
  password: string
  turnstileSiteKey: string
  pasteUrl: string
  created?: CreatedInfo
  onNew: () => void
  onRefresh: () => Promise<void>
  onClone: (source: { payload: PastePayload; format: Formatter; pasteUrl: string }) => void
}) {
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState<'raw' | 'qr' | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const { t } = useI18n()
  const format = isFormatter(response.adata[1]) ? response.adata[1] : 'plaintext'
  const discussion = response.adata[2] === 1 && !response.burned
  const timeToLive = response.meta.time_to_live
  const canShareLink = !target.burn && !response.burned

  async function copy(value: string, message: string) {
    const copied = await copyText(value)
    setNotice(copied ? message : t('Could not copy. Select the text manually.'))
    window.setTimeout(() => setNotice(''), 2500)
  }

  function downloadText() {
    const filename = format === 'markdown' ? 'binflare.md' : 'binflare.txt'
    const url = URL.createObjectURL(new Blob([payload.paste], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  function emailLink() {
    const subject = 'Encrypted note on Binflare'
    const expiry = timeToLive !== undefined
      ? `${t('Expires in')} ${formatTimeToLive(timeToLive)}.`
      : t('No expiry')
    const warning = target.burn
      ? ' This is a burn-after-reading link: opening it destroys the document.'
      : ''
    const body = `${pasteUrl}\n\n${expiry}${warning}\n\nThe decryption key is in the link fragment.`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  async function showQr() {
    try {
      const QRCode = (await import('qrcode')).default
      const dataUrl = await QRCode.toDataURL(pasteUrl, { margin: 2, width: 360 })
      setQrDataUrl(dataUrl)
      setModal('qr')
    } catch {
      setNotice('Could not generate the QR code.')
      window.setTimeout(() => setNotice(''), 2500)
    }
  }

  return (
    <section className="viewer" aria-labelledby="document-title">
      {created ? (
        <div className="alert success" role="status">
          <strong>{t('Document created.')}</strong>{' '}
          {t('Copy the link now; the delete link is shown only in this session.')}
          <div className="created-actions">
            <button type="button" className="button secondary small" onClick={() => void copy(pasteUrl, t('Link copied.'))}>
              {t('Copy link')}
            </button>
            <a className="button secondary small" href={created.deleteUrl}>
              {t('Delete this document')}
            </a>
          </div>
          <p className="muted small">
            {t('The delete link contains a secret token. Anyone with it can delete the document.')}
          </p>
        </div>
      ) : null}

      {response.burned ? (
        <div className="alert warning" role="status">
          {t('This burn-after-reading document was destroyed after it was read. Reloading the link will not recover it.')}
        </div>
      ) : null}

      {mode !== 'gcm' ? (
        <div className="alert warning" role="status">
          {t('This legacy document uses')} <code>{mode.toUpperCase()}</code>
          {t('which is not authenticated. It is read-only for compatibility; Binflare always creates AES-GCM documents.')}
        </div>
      ) : null}

      <div className="viewer-heading">
        <div>
          <p className="eyebrow">
            {format === 'markdown' ? t('Markdown') : format === 'syntaxhighlighting' ? t('Code') : t('Text')}
            {' · '}
            {target.burn ? t('Burn after reading') : t('Document')}
          </p>
          <h1 id="document-title">{t('Shared document')}</h1>
          <p className="meta-line">
            {timeToLive !== undefined
              ? `${t('Expires in')} ${formatTimeToLive(timeToLive)}`
              : t('No expiry')}
            {discussion ? ` · ${t('Open discussion')}` : ''}
            {response.burned ? ` · ${t('Destroyed')}` : ''}
          </p>
        </div>
        <div className="viewer-actions">
          <button type="button" className="button secondary small" onClick={() => void copy(pasteUrl, t('Link copied.'))}>
            {t('Copy link')}
          </button>
          <button type="button" className="button secondary small" onClick={() => void copy(payload.paste, t('Document copied.'))}>
            {t('Copy text')}
          </button>
          <button type="button" className="button secondary small" onClick={downloadText}>
            {t('Download')}
          </button>
          <button type="button" className="button secondary small" onClick={() => setModal('raw')}>
            {t('Raw text')}
          </button>
          {canShareLink ? (
            <>
              <button type="button" className="button secondary small" onClick={emailLink}>
                {t('Email')}
              </button>
              <button type="button" className="button secondary small" onClick={() => void showQr()}>
                {t('QR code')}
              </button>
              <button
                type="button"
                className="button secondary small"
                onClick={() => onClone({ payload, format, pasteUrl })}
              >
                {t('Clone')}
              </button>
            </>
          ) : null}
          <button type="button" className="button ghost small" onClick={onNew}>
            {t('New')}
          </button>
        </div>
      </div>

      {notice ? <div className="alert info" role="status">{notice}</div> : null}

      <div className="card document-card">
        <ContentRenderer text={payload.paste} format={format} />
        <AttachmentList payload={payload} />
        <ChildrenLinks children={payload.children} />
      </div>

      {discussion ? (
        <Comments
          pasteId={target.id}
          keyBytes={keyBytes}
          password={password}
          comments={comments}
          siteKey={turnstileSiteKey}
          onPosted={onRefresh}
        />
      ) : null}

      <p className="muted small footer-note">
        {t('This page decrypted the document locally. The server only stored ciphertext.')}
      </p>

      {modal === 'raw' ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="raw-title">
          <div className="modal raw-modal">
            <p className="eyebrow">{t('Raw document')}</p>
            <h2 id="raw-title">{t('Plain text')}</h2>
            <pre className="raw-text">{payload.paste}</pre>
            <div className="form-actions">
              <button type="button" className="button secondary small" onClick={() => void copy(payload.paste, t('Document copied.'))}>
                {t('Copy text')}
              </button>
              <button type="button" className="button secondary small" onClick={downloadText}>
                {t('Download')}
              </button>
              <button type="button" className="button ghost small" onClick={() => setModal(null)}>
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'qr' ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="qr-title">
          <div className="modal qr-modal">
            <p className="eyebrow">{t('Share')}</p>
            <h2 id="qr-title">{t('QR code')}</h2>
            {qrDataUrl ? <img src={qrDataUrl} alt={t('QR code')} className="qr-image" /> : null}
            <p className="alert warning small">
              {t('This QR code contains the decryption key. Anyone who can see or scan it can read the document.')}
            </p>
            <button type="button" className="button ghost small" onClick={() => setModal(null)}>
              {t('Close')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

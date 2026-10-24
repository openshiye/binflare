import { useState } from 'react'
import type { ReadResponse } from '../lib/api-client'
import { copyText } from '../lib/clipboard'
import { formatTimeToLive } from '../lib/format'
import type { PastePayload } from '../lib/protocol'
import { isFormatter } from '../lib/protocol'
import type { PasteTarget } from '../lib/fragment'
import { AttachmentList, ChildrenLinks, ContentRenderer } from './content'
import { Comments, type DecryptedComment } from './comments'

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
}) {
  const [notice, setNotice] = useState('')
  const format = isFormatter(response.adata[1]) ? response.adata[1] : 'plaintext'
  const discussion = response.adata[2] === 1 && !response.burned
  const timeToLive = response.meta.time_to_live

  async function copy(value: string, message: string) {
    const copied = await copyText(value)
    setNotice(copied ? message : 'Could not copy. Select the text manually.')
    window.setTimeout(() => setNotice(''), 2500)
  }

  return (
    <section className="viewer" aria-labelledby="document-title">
      {created ? (
        <div className="alert success" role="status">
          <strong>Document created.</strong> Copy the link now; the delete link is shown only in
          this session.
          <div className="created-actions">
            <button type="button" className="button secondary small" onClick={() => void copy(pasteUrl, 'Link copied.')}>
              Copy link
            </button>
            <a className="button secondary small" href={created.deleteUrl}>
              Delete this document
            </a>
          </div>
          <p className="muted small">
            The delete link contains a secret token. Anyone with it can delete the document.
          </p>
        </div>
      ) : null}

      {response.burned ? (
        <div className="alert warning" role="status">
          This burn-after-reading document was destroyed after it was read. Reloading the link will
          not recover it.
        </div>
      ) : null}

      {mode !== 'gcm' ? (
        <div className="alert warning" role="status">
          This legacy document uses <code>{mode.toUpperCase()}</code>, which is not authenticated.
          It is read-only for compatibility; Binflare always creates AES-GCM documents.
        </div>
      ) : null}

      <div className="viewer-heading">
        <div>
          <p className="eyebrow">
            {format === 'markdown' ? 'Markdown' : format === 'syntaxhighlighting' ? 'Code' : 'Text'}
            {' · '}
            {target.burn ? 'Burn after reading' : 'Document'}
          </p>
          <h1 id="document-title">Shared document</h1>
          <p className="meta-line">
            {timeToLive !== undefined ? `Expires in ${formatTimeToLive(timeToLive)}` : 'No expiry'}
            {discussion ? ' · Open discussion' : ''}
            {response.burned ? ' · Destroyed' : ''}
          </p>
        </div>
        <div className="viewer-actions">
          <button type="button" className="button secondary small" onClick={() => void copy(pasteUrl, 'Link copied.')}>
            Copy link
          </button>
          <button type="button" className="button secondary small" onClick={() => void copy(payload.paste, 'Document copied.')}>
            Copy text
          </button>
          <button type="button" className="button ghost small" onClick={onNew}>
            New
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
        This page decrypted the document locally. The server only stored ciphertext.
      </p>
    </section>
  )
}

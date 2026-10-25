import { useState } from 'react'
import {
  Copy,
  Download,
  FileText,
  Link2,
  LoaderCircle,
  Mail,
  QrCode,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import type { ReadResponse } from '../lib/api-client'
import { copyText } from '../lib/clipboard'
import { formatTimeToLive } from '../lib/format'
import type { Formatter, PastePayload } from '../lib/protocol'
import { isFormatter } from '../lib/protocol'
import type { PasteTarget } from '../lib/fragment'
import { AttachmentList, ChildrenLinks, ContentRenderer } from './content'
import { Comments, type DecryptedComment } from './comments'
import { useI18n } from '../lib/i18n'
import { Button, buttonVariants } from './ui/button'
import { Card, CardContent, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { AppDialog, DialogFooter } from './ui/dialog'

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
    <section className="space-y-5" aria-labelledby="document-title">
      {created ? (
        <div
          role="status"
          className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <strong>{t('Document created.')}</strong>
            <span className="text-muted-foreground">
              {t('Copy the link now; the delete link is shown only in this session.')}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void copy(pasteUrl, t('Link copied.'))}>
              <Link2 />
              {t('Copy link')}
            </Button>
            <a
              href={created.deleteUrl}
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              <Trash2 />
              {t('Delete this document')}
            </a>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('The delete link contains a secret token. Anyone with it can delete the document.')}
          </p>
        </div>
      ) : null}

      {response.burned ? (
        <div
          role="status"
          className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
        >
          {t('This burn-after-reading document was destroyed after it was read. Reloading the link will not recover it.')}
        </div>
      ) : null}

      {mode !== 'gcm' ? (
        <div
          role="status"
          className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
        >
          {t('This legacy document uses')} <code>{mode.toUpperCase()}</code>
          {t('which is not authenticated. It is read-only for compatibility; Binflare always creates AES-GCM documents.')}
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {format === 'markdown' ? t('Markdown') : format === 'syntaxhighlighting' ? t('Code') : t('Text')}
            </Badge>
            <Badge variant={target.burn ? 'destructive' : 'outline'}>
              {target.burn ? t('Burn after reading') : t('Document')}
            </Badge>
            {response.burned ? <Badge variant="warning">{t('Destroyed')}</Badge> : null}
          </div>
          <h1 id="document-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('Shared document')}
          </h1>
          <CardDescription>
            {timeToLive !== undefined
              ? `${t('Expires in')} ${formatTimeToLive(timeToLive)}`
              : t('No expiry')}
            {discussion ? ` · ${t('Open discussion')}` : ''}
          </CardDescription>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void copy(pasteUrl, t('Link copied.'))}>
            <Link2 />
            {t('Copy link')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void copy(payload.paste, t('Document copied.'))}>
            <Copy />
            {t('Copy text')}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadText}>
            <Download />
            {t('Download')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setModal('raw')}>
            <FileText />
            {t('Raw text')}
          </Button>
          {canShareLink ? (
            <>
              <Button variant="outline" size="sm" onClick={emailLink}>
                <Mail />
                {t('Email')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void showQr()}>
                <QrCode />
                {t('QR code')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onClone({ payload, format, pasteUrl })}>
                <RotateCcw />
                {t('Clone')}
              </Button>
            </>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onNew}>
            {t('New')}
          </Button>
        </div>
      </div>

      {notice ? (
        <div role="status" className="rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm">
          {notice}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <ContentRenderer text={payload.paste} format={format} />
          <AttachmentList payload={payload} />
          <ChildrenLinks children={payload.children} />
        </CardContent>
      </Card>

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

      <p className="text-xs leading-5 text-muted-foreground">
        {t('This page decrypted the document locally. The server only stored ciphertext.')}
      </p>

      <AppDialog
        open={modal === 'raw'}
        onOpenChange={(open) => setModal(open ? 'raw' : null)}
        title={t('Plain text')}
        description={t('Raw document')}
        className="modal max-w-4xl"
      >
        <pre className="raw-text">{payload.paste}</pre>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => void copy(payload.paste, t('Document copied.'))}>
            {t('Copy text')}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadText}>
            {t('Download')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setModal(null)}>
            {t('Close')}
          </Button>
        </DialogFooter>
      </AppDialog>

      <AppDialog
        open={modal === 'qr'}
        onOpenChange={(open) => setModal(open ? 'qr' : null)}
        title={t('QR code')}
        description={t('Share')}
        className="modal max-w-md text-center"
      >
        {qrDataUrl ? <img src={qrDataUrl} alt={t('QR code')} className="qr-image" /> : <LoaderCircle className="mx-auto size-8 animate-spin" />}
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-left text-xs text-warning">
          {t('This QR code contains the decryption key. Anyone who can see or scan it can read the document.')}
        </p>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setModal(null)}>
            {t('Close')}
          </Button>
        </DialogFooter>
      </AppDialog>
    </section>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import { Download, FileText } from 'lucide-react'
import type { Formatter } from '../lib/protocol'
import { linkifyText } from '../lib/linkify'
import { normalizeAttachments, safeChildren, type Attachment } from '../lib/format'
import {
  attachmentBytes,
  attachmentSize,
  dataUrlInfo,
  decodeTextAttachment,
  formatFileSize,
  previewKind,
  sanitizeFilename,
  sanitizedSvgUrl,
} from '../lib/attachments'
import { blobPart } from '../lib/binary'
import { useI18n } from '../lib/i18n'
import { buttonVariants } from './ui/button'

let linkHookInstalled = false

async function sanitize(html: string, profile: 'html' | 'highlight'): Promise<string> {
  const DOMPurify = (await import('dompurify')).default
  if (!linkHookInstalled) {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
    linkHookInstalled = true
  }
  if (profile === 'highlight') {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['span'],
      ALLOWED_ATTR: ['class'],
    })
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):)/i,
    ADD_ATTR: ['target', 'rel'],
  })
}

function PlainText({ text }: { text: string }) {
  return (
    <div className="content plaintext">
      <span className="whitespace-pre-wrap">{linkifyText(text)}</span>
    </div>
  )
}

function Markdown({ text }: { text: string }) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { marked } = await import('marked')
      const rendered = await marked.parse(text, { gfm: true, breaks: false })
      const clean = await sanitize(typeof rendered === 'string' ? rendered : await rendered, 'html')
      if (!cancelled) {
        setHtml(clean)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [text])

  if (html === null) {
    return <PlainText text={text} />
  }
  return <div className="content markdown" dangerouslySetInnerHTML={{ __html: html }} />
}

function Highlighted({ text }: { text: string }) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const hljs = (await import('highlight.js/lib/common')).default
      const highlighted = hljs.highlightAuto(text).value
      const clean = await sanitize(highlighted, 'highlight')
      if (!cancelled) {
        setHtml(clean)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [text])

  if (html === null) {
    return <PlainText text={text} />
  }
  const lineCount = text.split('\n').length
  const lineNumbers = Array.from({ length: lineCount }, (_, index) => index + 1).join('\n')
  return (
    <div className="content highlight">
      <div className="highlight-wrap">
        <pre className="line-numbers" aria-hidden="true">
          {lineNumbers}
        </pre>
        <pre className="code">
          <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>
    </div>
  )
}

export function ContentRenderer({ text, format }: { text: string; format: Formatter }) {
  if (format === 'markdown') {
    return <Markdown text={text} />
  }
  if (format === 'syntaxhighlighting') {
    return <Highlighted text={text} />
  }
  return <PlainText text={text} />
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const { t } = useI18n()
  const info = dataUrlInfo(attachment.url)
  const kind = info ? previewKind(info.mime) : null
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [svgUrl, setSvgUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const name = sanitizeFilename(attachment.name)
  const size = attachmentSize(attachment.url)

  useEffect(() => {
    if (kind !== 'pdf') {
      return
    }
    const bytes = attachmentBytes(attachment.url)
    if (!bytes) {
      return
    }
    const url = URL.createObjectURL(new Blob([blobPart(bytes)], { type: 'application/pdf' }))
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [attachment.url, kind])

  useEffect(() => {
    if (kind !== 'svg') {
      return
    }
    let active = true
    let localUrl: string | null = null
    void sanitizedSvgUrl(attachment.url).then((url) => {
      localUrl = url
      if (active) {
        setSvgUrl(url)
      }
    })
    return () => {
      active = false
      if (localUrl) {
        URL.revokeObjectURL(localUrl)
      }
    }
  }, [attachment.url, kind])

  useEffect(() => {
    if (kind === 'text') {
      setText(decodeTextAttachment(attachment.url))
    }
  }, [attachment.url, kind])

  return (
    <li className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
        <span className="inline-flex min-w-0 items-center gap-2 font-mono text-xs">
          <FileText className="size-4 text-muted-foreground" />
          <span className="truncate">{name}</span>
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {info?.mime ?? 'unknown type'} · {formatFileSize(size)}
        </span>
      </div>
      <div className="attachment-preview p-3">
        {kind === 'image' ? <img src={attachment.url} alt={name} loading="lazy" /> : null}
        {kind === 'svg' && svgUrl ? <img src={svgUrl} alt={name} loading="lazy" /> : null}
        {kind === 'audio' ? <audio controls preload="metadata" src={attachment.url} /> : null}
        {kind === 'video' ? <video controls preload="metadata" src={attachment.url} /> : null}
        {kind === 'pdf' && objectUrl ? (
          <iframe title={name} src={objectUrl} loading="lazy" />
        ) : null}
        {kind === 'text' && text !== null ? (
          <pre className="attachment-text">{text.slice(0, 200_000)}</pre>
        ) : null}
        {kind === null ? (
          <p className="text-xs text-muted-foreground">{t('Preview is disabled for this file type. Download it to view it.')}</p>
        ) : null}
      </div>
      <div className="border-t px-3 py-2">
        <a href={attachment.url} download={name} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Download />
          {t('Download')}
        </a>
      </div>
    </li>
  )
}

export function AttachmentList({ payload }: {
  payload: { attachment?: string[] | string; attachment_name?: string[] | string }
}) {
  const { t } = useI18n()
  const attachments: Attachment[] = normalizeAttachments(payload)
  if (attachments.length === 0) {
    return null
  }
  return (
    <section className="mt-6 border-t pt-5" aria-label={t('Attachments')}>
      <h2 className="mb-3 text-base font-semibold">{t('Attachments')} ({attachments.length})</h2>
      <ul className="grid gap-3">
        {attachments.map((attachment) => (
          <AttachmentPreview
            key={`${attachment.name}-${attachment.url.slice(0, 32)}`}
            attachment={attachment}
          />
        ))}
      </ul>
    </section>
  )
}

export function ChildrenLinks({ children }: { children?: string[] }) {
  const { t } = useI18n()
  const links = safeChildren(children)
  if (links.length === 0) {
    return null
  }
  return (
    <section className="mt-6 border-t pt-5" aria-label={t('Version chain')}>
      <h2 className="mb-3 text-base font-semibold">{t('Version chain')}</h2>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link}>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-xs underline-offset-4 hover:underline"
            >
              {link}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {children}
    </div>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import type { Formatter } from '../lib/protocol'
import { linkifyText } from '../lib/linkify'
import { normalizeAttachments, safeChildren, type Attachment } from '../lib/format'

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
  return (
    <div className="content highlight">
      <pre>
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
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

export function AttachmentList({ payload }: {
  payload: { attachment?: string[] | string; attachment_name?: string[] | string }
}) {
  const attachments: Attachment[] = normalizeAttachments(payload)
  if (attachments.length === 0) {
    return null
  }
  return (
    <section className="attachments" aria-label="Attachments">
      <h2>Attachments</h2>
      <ul>
        {attachments.map((attachment) => (
          <li key={`${attachment.name}-${attachment.url.slice(0, 24)}`}>
            <a href={attachment.url} download={attachment.name} className="attachment-link">
              {attachment.name}
            </a>
          </li>
        ))}
      </ul>
      <p className="muted small">Attachment previews are not available in this version.</p>
    </section>
  )
}

export function ChildrenLinks({ children }: { children?: string[] }) {
  const links = safeChildren(children)
  if (links.length === 0) {
    return null
  }
  return (
    <section className="children" aria-label="Version chain">
      <h2>Version chain</h2>
      <ul>
        {links.map((link) => (
          <li key={link}>
            <a href={link} target="_blank" rel="noopener noreferrer">
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
    <div className="alert error" role="alert">
      {children}
    </div>
  )
}

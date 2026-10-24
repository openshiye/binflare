import { useMemo, useState } from 'react'
import { createCommentCipher } from '../lib/crypto'
import { postComment } from '../lib/api-client'
import { linkifyText } from '../lib/linkify'
import { formatCreated } from '../lib/format'
import { TurnstileWidget } from './turnstile'

export interface DecryptedComment {
  id: string
  parentid: string
  created: number
  text: string
  nickname?: string
  error?: boolean
}

function CommentForm({
  pasteId,
  parentId,
  keyBytes,
  password,
  siteKey,
  onPosted,
  onCancel,
}: {
  pasteId: string
  parentId: string
  keyBytes: Uint8Array
  password: string
  siteKey: string
  onPosted: () => Promise<void>
  onCancel?: () => void
}) {
  const [text, setText] = useState('')
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileKey, setTurnstileKey] = useState(0)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (text.trim().length === 0 || busy) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const encrypted = await createCommentCipher(
        text,
        nickname.trim(),
        pasteId,
        parentId,
        keyBytes,
        { password },
      )
      await postComment(encrypted.request, turnstileToken || undefined)
      setText('')
      setNickname('')
      setTurnstileToken('')
      setTurnstileKey((value) => value + 1)
      await onPosted()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not post the comment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="comment-form" onSubmit={submit}>
      <label className="field compact">
        <span>Nickname (optional)</span>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={80}
          autoComplete="nickname"
        />
      </label>
      <label className="field">
        <span>Comment</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          spellCheck={false}
          placeholder="Write a comment…"
        />
      </label>
      {siteKey ? <TurnstileWidget key={turnstileKey} siteKey={siteKey} onToken={setTurnstileToken} /> : null}
      {error ? <div className="alert error" role="alert">{error}</div> : null}
      <div className="form-actions">
        <button type="submit" className="button primary small" disabled={busy || text.trim().length === 0}>
          {busy ? 'Posting…' : 'Post comment'}
        </button>
        {onCancel ? (
          <button type="button" className="button ghost small" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}

function CommentThread({
  comment,
  childrenByParent,
  pasteId,
  keyBytes,
  password,
  siteKey,
  onPosted,
  depth,
  seen,
}: {
  comment: DecryptedComment
  childrenByParent: Map<string, DecryptedComment[]>
  pasteId: string
  keyBytes: Uint8Array
  password: string
  siteKey: string
  onPosted: () => Promise<void>
  depth: number
  seen: Set<string>
}) {
  const [replying, setReplying] = useState(false)
  if (seen.has(comment.id)) {
    return null
  }
  seen.add(comment.id)
  const children = childrenByParent.get(comment.id) ?? []

  return (
    <li className="comment" style={{ marginLeft: depth === 0 ? 0 : '1.25rem' }}>
      <div className="comment-meta">
        <strong className={comment.nickname ? '' : 'anonymous'}>
          {comment.nickname || 'Anonymous'}
        </strong>
        {comment.created ? <time dateTime={new Date(comment.created * 1000).toISOString()}>{formatCreated(comment.created)}</time> : null}
      </div>
      <div className="comment-body">
        {comment.error ? (
          <span className="muted">[Unable to decrypt this comment]</span>
        ) : (
          <span className="whitespace-pre-wrap">{linkifyText(comment.text)}</span>
        )}
      </div>
      {!comment.error ? (
        <button type="button" className="button ghost tiny" onClick={() => setReplying((value) => !value)}>
          {replying ? 'Close reply' : 'Reply'}
        </button>
      ) : null}
      {replying ? (
        <CommentForm
          pasteId={pasteId}
          parentId={comment.id}
          keyBytes={keyBytes}
          password={password}
          siteKey={siteKey}
          onPosted={onPosted}
          onCancel={() => setReplying(false)}
        />
      ) : null}
      {children.length > 0 ? (
        <ul className="comment-children">
          {children.map((child) => (
            <CommentThread
              key={child.id}
              comment={child}
              childrenByParent={childrenByParent}
              pasteId={pasteId}
              keyBytes={keyBytes}
              password={password}
              siteKey={siteKey}
              onPosted={onPosted}
              depth={depth + 1}
              seen={seen}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function Comments({
  pasteId,
  keyBytes,
  password,
  comments,
  siteKey,
  onPosted,
}: {
  pasteId: string
  keyBytes: Uint8Array
  password: string
  comments: DecryptedComment[]
  siteKey: string
  onPosted: () => Promise<void>
}) {
  const { roots, childrenByParent } = useMemo(() => {
    const map = new Map<string, DecryptedComment[]>()
    for (const comment of comments) {
      const list = map.get(comment.parentid) ?? []
      list.push(comment)
      map.set(comment.parentid, list)
    }
    return { roots: map.get(pasteId) ?? [], childrenByParent: map }
  }, [comments, pasteId])

  return (
    <section className="discussion" aria-labelledby="discussion-title">
      <div className="section-heading">
        <h2 id="discussion-title">Discussion</h2>
        <span className="muted small">
          {comments.length} comment{comments.length === 1 ? '' : 's'}
        </span>
      </div>
      {roots.length > 0 ? (
        <ul className="comment-list">
          {roots.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              childrenByParent={childrenByParent}
              pasteId={pasteId}
              keyBytes={keyBytes}
              password={password}
              siteKey={siteKey}
              onPosted={onPosted}
              depth={0}
              seen={new Set()}
            />
          ))}
        </ul>
      ) : (
        <p className="muted">No comments yet.</p>
      )}
      <CommentForm
        pasteId={pasteId}
        parentId={pasteId}
        keyBytes={keyBytes}
        password={password}
        siteKey={siteKey}
        onPosted={onPosted}
      />
    </section>
  )
}

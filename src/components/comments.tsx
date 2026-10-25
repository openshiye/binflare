import { useMemo, useState } from 'react'
import { LoaderCircle, MessageSquarePlus, Reply } from 'lucide-react'
import { createCommentCipher } from '../lib/crypto'
import { postComment } from '../lib/api-client'
import { linkifyText } from '../lib/linkify'
import { formatCreated } from '../lib/format'
import { TurnstileWidget } from './turnstile'
import { useI18n } from '../lib/i18n'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'

export interface DecryptedComment {
  id: string
  parentid: string
  created: number
  text: string
  nickname?: string
  error?: boolean
}

function CommentAvatar({ id }: { id: string }) {
  const cells: Array<[number, number]> = []
  for (let row = 0; row < 5; row++) {
    for (let column = 0; column < 3; column++) {
      const value = Number.parseInt(id[(row * 3 + column) % id.length] ?? '0', 16)
      if (value % 2 === 0) {
        cells.push([column, row])
        if (column !== 2) {
          cells.push([4 - column, row])
        }
      }
    }
  }
  const color = `#${id.slice(0, 6)}`
  return (
    <svg className="comment-avatar" viewBox="0 0 5 5" aria-hidden="true">
      <rect width="5" height="5" fill="transparent" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} />
      ))}
    </svg>
  )
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
  const { t } = useI18n()

  const canSubmit =
    text.trim().length > 0 && !busy && (!siteKey || turnstileToken.length > 0)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) {
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
    <form className="space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          <Label htmlFor={`nickname-${parentId}`}>{t('Nickname (optional)')}</Label>
          <Input
            id={`nickname-${parentId}`}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={80}
            autoComplete="nickname"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`comment-${parentId}`}>{t('Comment')}</Label>
          <Textarea
            id={`comment-${parentId}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            spellCheck={false}
            placeholder={t('Write a comment…')}
            className="min-h-24"
          />
        </div>
      </div>
      {siteKey ? <TurnstileWidget key={turnstileKey} siteKey={siteKey} onToken={setTurnstileToken} /> : null}
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {busy ? <LoaderCircle className="animate-spin" /> : <MessageSquarePlus />}
          {busy ? t('Posting…') : t('Post comment')}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            {t('Cancel')}
          </Button>
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
  const { t } = useI18n()
  if (seen.has(comment.id)) {
    return null
  }
  seen.add(comment.id)
  const children = childrenByParent.get(comment.id) ?? []

  return (
    <li className={`border-l-2 py-3 pl-4 ${depth === 0 ? 'border-border' : 'ml-4 border-muted-foreground/30'}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <CommentAvatar id={comment.id} />
        <strong className={comment.nickname ? 'text-foreground' : 'font-normal text-muted-foreground'}>
          {comment.nickname || t('Anonymous')}
        </strong>
        {comment.created ? (
          <time dateTime={new Date(comment.created * 1000).toISOString()} className="font-mono text-muted-foreground">
            {formatCreated(comment.created)}
          </time>
        ) : null}
      </div>
      <div className="mt-2 text-sm leading-6">
        {comment.error ? (
          <span className="text-muted-foreground">{t('[Unable to decrypt this comment]')}</span>
        ) : (
          <span className="whitespace-pre-wrap">{linkifyText(comment.text)}</span>
        )}
      </div>
      {!comment.error ? (
        <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs" onClick={() => setReplying((value) => !value)}>
          <Reply />
          {replying ? t('Close reply') : t('Reply')}
        </Button>
      ) : null}
      {replying ? (
        <div className="mt-3">
          <CommentForm
            pasteId={pasteId}
            parentId={comment.id}
            keyBytes={keyBytes}
            password={password}
            siteKey={siteKey}
            onPosted={onPosted}
            onCancel={() => setReplying(false)}
          />
        </div>
      ) : null}
      {children.length > 0 ? (
        <ul className="mt-2 space-y-1">
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
  const { t } = useI18n()

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle id="discussion-title" className="text-base">
            {t('Discussion')}
          </CardTitle>
          <CardDescription>
            {comments.length} {comments.length === 1 ? t('comment') : t('comments')}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {roots.length > 0 ? (
          <ul className="space-y-1">
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
          <CardDescription>{t('No comments yet.')}</CardDescription>
        )}
        <CommentForm
          pasteId={pasteId}
          parentId={pasteId}
          keyBytes={keyBytes}
          password={password}
          siteKey={siteKey}
          onPosted={onPosted}
        />
      </CardContent>
    </Card>
  )
}

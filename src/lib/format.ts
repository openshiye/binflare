export function formatTimeToLive(seconds: number): string {
  if (seconds <= 0) {
    return 'expired'
  }
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? '' : 's'}`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 48) {
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }
  const days = Math.floor(hours / 24)
  if (days < 60) {
    return `${days} day${days === 1 ? '' : 's'}`
  }
  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'}`
}

export function formatCreated(seconds: number): string {
  if (!seconds) {
    return ''
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(seconds * 1000))
}

export function formatExpiryDate(seconds: number | null): string {
  if (seconds === null) {
    return 'Never expires'
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(seconds * 1000))
}

export interface Attachment {
  name: string
  url: string
}

export function normalizeAttachments(payload: {
  attachment?: string[] | string
  attachment_name?: string[] | string
}): Attachment[] {
  const data = Array.isArray(payload.attachment)
    ? payload.attachment
    : typeof payload.attachment === 'string'
      ? [payload.attachment]
      : []
  const names = Array.isArray(payload.attachment_name)
    ? payload.attachment_name
    : typeof payload.attachment_name === 'string'
      ? [payload.attachment_name]
      : []
  return data
    .map((url, index) => ({
      url,
      name: names[index] ?? `attachment-${index + 1}`,
    }))
    .filter((attachment) => attachment.url.startsWith('data:'))
}

export function safeChildren(children: string[] | undefined): string[] {
  return (children ?? []).filter((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  })
}

import { base64ToBytes, bytesToBase64 } from './binary'

export interface DraftAttachment {
  id: string
  name: string
  dataUrl: string
  size: number
  mime: string
}

export function sanitizeFilename(value: string): string {
  const cleaned = value
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
  return cleaned.length > 0 ? cleaned.slice(0, 160) : 'attachment'
}

export function dataUrlInfo(dataUrl: string): { mime: string; base64: string } | null {
  if (!dataUrl.startsWith('data:')) {
    return null
  }
  const comma = dataUrl.indexOf(',')
  if (comma === -1) {
    return null
  }
  const header = dataUrl.slice(5, comma)
  if (!header.endsWith(';base64')) {
    return null
  }
  return {
    mime: header.slice(0, -7) || 'application/octet-stream',
    base64: dataUrl.slice(comma + 1),
  }
}

export function attachmentSize(dataUrl: string): number {
  const info = dataUrlInfo(dataUrl)
  if (!info) {
    return 0
  }
  const padding = info.base64.endsWith('==') ? 2 : info.base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((info.base64.length * 3) / 4) - padding)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1000) {
    return `${bytes} B`
  }
  if (bytes < 1_000_000) {
    return `${(bytes / 1000).toFixed(1)} KB`
  }
  return `${(bytes / 1_000_000).toFixed(2)} MB`
}

export function previewKind(mime: string): 'image' | 'audio' | 'video' | 'pdf' | 'text' | 'svg' | null {
  if (mime === 'image/svg+xml') {
    return 'svg'
  }
  if (mime.startsWith('image/')) {
    return 'image'
  }
  if (mime.startsWith('audio/')) {
    return 'audio'
  }
  if (mime.startsWith('video/')) {
    return 'video'
  }
  if (mime === 'application/pdf') {
    return 'pdf'
  }
  if (mime === 'text/plain' || mime === 'text/markdown' || mime === 'application/json') {
    return 'text'
  }
  return null
}

export function decodeTextAttachment(dataUrl: string): string | null {
  const info = dataUrlInfo(dataUrl)
  if (!info) {
    return null
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(info.base64))
  } catch {
    return null
  }
}

export async function fileToAttachment(file: File): Promise<DraftAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: sanitizeFilename(file.name),
    dataUrl,
    size: file.size,
    mime: file.type || 'application/octet-stream',
  }
}

export async function sanitizedSvgUrl(dataUrl: string): Promise<string | null> {
  const info = dataUrlInfo(dataUrl)
  if (!info) {
    return null
  }
  try {
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(info.base64))
    const DOMPurify = (await import('dompurify')).default
    const clean = DOMPurify.sanitize(raw, {
      USE_PROFILES: { svg: true, svgFilters: true },
    })
    return URL.createObjectURL(new Blob([clean], { type: 'image/svg+xml' }))
  } catch {
    return null
  }
}

export function attachmentBytes(dataUrl: string): Uint8Array | null {
  const info = dataUrlInfo(dataUrl)
  if (!info) {
    return null
  }
  try {
    return base64ToBytes(info.base64)
  } catch {
    return null
  }
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`
}

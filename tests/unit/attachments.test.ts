import { describe, expect, it } from 'vitest'
import {
  attachmentSize,
  dataUrlInfo,
  decodeTextAttachment,
  previewKind,
  sanitizeFilename,
} from '../../src/lib/attachments'

describe('attachment utilities', () => {
  it('parses data URLs and sizes', () => {
    const url = `data:text/plain;base64,${Buffer.from('hello').toString('base64')}`
    expect(dataUrlInfo(url)).toEqual({
      mime: 'text/plain',
      base64: Buffer.from('hello').toString('base64'),
    })
    expect(attachmentSize(url)).toBe(5)
    expect(decodeTextAttachment(url)).toBe('hello')
  })

  it('classifies safe preview kinds', () => {
    expect(previewKind('image/png')).toBe('image')
    expect(previewKind('image/svg+xml')).toBe('svg')
    expect(previewKind('audio/ogg')).toBe('audio')
    expect(previewKind('video/mp4')).toBe('video')
    expect(previewKind('application/pdf')).toBe('pdf')
    expect(previewKind('text/plain')).toBe('text')
    expect(previewKind('text/html')).toBeNull()
    expect(previewKind('application/zip')).toBeNull()
  })

  it('sanitizes filenames', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('.._.._etc_passwd')
    expect(sanitizeFilename('')).toBe('attachment')
    expect(sanitizeFilename('a\u0000b')).toBe('ab')
  })
})

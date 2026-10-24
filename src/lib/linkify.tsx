import type { ReactNode } from 'react'

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g

function trimTrailingPunctuation(value: string): { url: string; trailing: string } {
  let end = value.length
  while (end > 0 && /[.,;:!?)]/.test(value[end - 1]!)) {
    end--
  }
  return { url: value.slice(0, end), trailing: value.slice(end) }
}

export function linkifyText(text: string): ReactNode[] {
  const parts = text.split(URL_PATTERN)
  return parts.map((part, index) => {
    if (!part.startsWith('http://') && !part.startsWith('https://')) {
      return part
    }
    const { url, trailing } = trimTrailingPunctuation(part)
    return (
      <span key={`${url}-${index}`}>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
        {trailing}
      </span>
    )
  })
}

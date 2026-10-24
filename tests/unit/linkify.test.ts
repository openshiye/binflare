import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { linkifyText } from '../../src/lib/linkify'

describe('linkification', () => {
  it('links http, ftp and magnet URLs safely', () => {
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        linkifyText('see https://example.com ftp://files.example.com/a and magnet:?xt=urn:btih:abc'),
      ),
    )
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('href="ftp://files.example.com/a"')
    expect(html).toContain('href="magnet:?xt=urn:btih:abc"')
    expect(html).not.toContain('javascript:')
  })
})

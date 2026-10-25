import { expect, test, type Page } from '@playwright/test'

function unique(prefix: string): string {
  return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`
}

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

async function createPaste(
  page: Page,
  text: string,
  options: {
    format?: 'plaintext' | 'markdown' | 'syntaxhighlighting'
    password?: string
    discussion?: boolean
    burn?: boolean
  } = {},
): Promise<string> {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.locator('textarea').fill(text)
  if (options.format) {
    await page.getByLabel('Format').selectOption(options.format)
  }
  if (options.password) {
    await page.getByPlaceholder('No password').fill(options.password)
  }
  if (options.discussion) {
    await page.getByLabel('Open discussion').check()
  }
  if (options.burn) {
    await page.getByLabel('Burn after reading').check()
  }
  await page.getByRole('button', { name: 'Create paste' }).click()
  await page.getByText('Document created.').waitFor()
  return page.url()
}

function futureBody(
  ct: string,
  options: {
    burn?: 0 | 1
    discussion?: 0 | 1
    iterations?: number
    ivBytes?: number
  } = {},
): {
  v: number
  adata: [unknown[], string, number, number]
  ct: string
  meta: { expire: string }
} {
  const iv = Buffer.alloc(options.ivBytes ?? 16).toString('base64')
  const salt = Buffer.alloc(8).toString('base64')
  return {
    v: 2,
    adata: [
      [iv, salt, options.iterations ?? 100_000, 256, 128, 'aes', 'gcm', 'none'],
      'plaintext',
      options.discussion ?? 0,
      options.burn ?? 0,
    ],
    ct,
    meta: { expire: '1week' },
  }
}

test('create, open in a second context, and delete', async ({ page, context }) => {
  const errors = collectErrors(page)
  const text = unique('roundtrip')
  const url = await createPaste(page, text)
  expect(url).toMatch(/\?[a-f0-9]{16}#[1-9A-HJ-NP-Za-km-z]+$/)

  const reader = await context.newPage()
  const readerErrors = collectErrors(reader)
  await reader.goto(url, { waitUntil: 'networkidle' })
  await expect(reader.getByText(text)).toBeVisible()
  expect(errors).toEqual([])
  expect(readerErrors).toEqual([])

  await page.getByRole('link', { name: 'Delete this document' }).click()
  await expect(page.getByRole('heading', { name: 'Document deleted' })).toBeVisible()

  const gone = await context.newPage()
  await gone.goto(url, { waitUntil: 'networkidle' })
  await expect(gone.getByRole('heading', { name: 'Document unavailable' })).toBeVisible()
})

test('password prompt rejects a wrong password and unlocks with the right one', async ({
  page,
  context,
}) => {
  const text = unique('password')
  const url = await createPaste(page, text, { password: 's3cret' })
  const reader = await context.newPage()
  await reader.goto(url, { waitUntil: 'networkidle' })
  await expect(reader.getByRole('heading', { name: 'Password required' })).toBeVisible()
  await reader.locator('.modal input[type="password"]').fill('wrong')
  await reader.getByRole('button', { name: 'Unlock' }).click()
  await expect(reader.getByText('Wrong password. Try again.')).toBeVisible()
  await reader.locator('.modal input[type="password"]').fill('s3cret')
  await reader.getByRole('button', { name: 'Unlock' }).click()
  await expect(reader.getByText(text)).toBeVisible()
})

test('burn asks first, reads once, and cannot be read again', async ({ page, context }) => {
  const text = unique('burn')
  const url = await createPaste(page, text, { burn: true })
  expect(url).toContain('#-')

  const reader = await context.newPage()
  let reads = 0
  reader.on('request', (request) => {
    if (request.url().includes('pasteid=')) {
      reads++
    }
  })
  await reader.goto(url, { waitUntil: 'networkidle' })
  await expect(reader.getByRole('heading', { name: 'Read once, then it is gone.' })).toBeVisible()
  expect(reads).toBe(0)

  await reader.getByRole('button', { name: 'Read and destroy' }).click()
  await expect(reader.getByRole('heading', { name: 'Password (if set)' })).toBeVisible()
  await reader.getByRole('button', { name: 'Read and destroy' }).click()
  await expect(reader.getByText(text)).toBeVisible()
  expect(reads).toBe(1)

  await reader.reload({ waitUntil: 'networkidle' })
  await expect(reader.getByRole('heading', { name: 'Read once, then it is gone.' })).toBeVisible()
  await reader.getByRole('button', { name: 'Read and destroy' }).click()
  await reader.getByRole('button', { name: 'Read and destroy' }).click()
  await expect(reader.getByRole('heading', { name: 'Document unavailable' })).toBeVisible()
})

test('open discussion posts an encrypted comment and a reader decrypts it', async ({
  page,
  context,
}) => {
  const text = unique('discussion')
  const comment = unique('comment')
  const url = await createPaste(page, text, { discussion: true })
  await expect(page.getByRole('heading', { name: 'Discussion' })).toBeVisible()
  await page.getByPlaceholder(/Write a comment/).fill(comment)
  await page.getByRole('button', { name: 'Post comment' }).click()
  await expect(page.getByText(comment)).toBeVisible()

  const reader = await context.newPage()
  await reader.goto(url, { waitUntil: 'networkidle' })
  await expect(reader.getByText(comment)).toBeVisible()
})

test('attachments, raw/QR/download, and clone with children', async ({ page, context }) => {
  const text = unique('attachment-text')
  const attachmentText = unique('attachment-body')
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.locator('textarea').fill(text)
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: 'note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(attachmentText),
    },
    {
      name: 'icon.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>window.__svgxss=1</script><rect width="10" height="10" fill="red"/></svg>',
      ),
    },
  ])
  await expect(page.getByText('note.txt')).toBeVisible()
  await page.getByRole('button', { name: 'Create paste' }).click()
  await page.getByText('Document created.').waitFor()
  await expect(page.getByText('Attachments (2)')).toBeVisible()
  await expect(page.getByText(attachmentText)).toBeVisible()
  await expect(page.getByRole('img', { name: 'icon.svg' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __svgxss?: number }).__svgxss ?? 0)).toBe(0)
  const firstUrl = page.url()

  await page.getByRole('button', { name: 'Raw text' }).click()
  await expect(page.getByRole('heading', { name: 'Plain text' })).toBeVisible()
  await expect(page.locator('.raw-text')).toHaveText(text)
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: 'QR code' }).click()
  await expect(page.locator('.qr-image')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download' }).first().click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('binflare.txt')

  await page.getByRole('button', { name: 'Clone' }).click()
  await expect(page.locator('textarea')).toHaveValue(text)
  await expect(page.getByText('Cloning an existing document.')).toBeVisible()
  await page.getByRole('button', { name: 'Create paste' }).click()
  await page.getByText('Document created.').waitFor()
  await expect(page.getByText('Version chain')).toBeVisible()
  await expect(page.getByText(firstUrl)).toBeVisible()

  const reader = await context.newPage()
  await reader.goto(page.url(), { waitUntil: 'networkidle' })
  await expect(reader.getByText(text)).toBeVisible()
  await expect(reader.getByText(attachmentText)).toBeVisible()
})

test('language and dark theme persist', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.locator('.language-select').selectOption('zh')
  await expect(page.getByRole('heading', { name: '写下它，加密它，分享链接。' })).toBeVisible()
  await expect(page.getByPlaceholder('粘贴或输入值得保密的内容…')).toBeVisible()
  await page.getByRole('button', { name: '暗色模式' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: '写下它，加密它，分享链接。' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('link', { name: '关于' }).click()
  await expect(
    page.getByRole('heading', { name: '源自 PrivateBin 的 Cloudflare 重写。' }),
  ).toBeVisible()
})

test('markdown is sanitized and the shell CSP uses a nonce', async ({ page, request }) => {
  const url = await createPaste(
    page,
    '# title\n\n<script>window.__xss=1</script>\n\n<img src=x onerror="window.__xss=2">\n\n[bad](javascript:alert(1))',
    { format: 'markdown' },
  )
  await expect(page.getByRole('heading', { name: 'title' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss ?? 0)).toBe(0)
  const html = await page.locator('.content.markdown').innerHTML()
  expect(html).not.toContain('onerror')
  expect(html).not.toContain('<script')
  expect(html).not.toContain('javascript:')

  const shell = await request.get(url)
  const shellBody = await shell.text()
  const nonceMatch = shellBody.match(/nonce="([^"]+)"/)
  expect(nonceMatch).toBeTruthy()
  const headers = shell.headers()
  const csp = headers['content-security-policy'] ?? ''
  expect(csp).toContain("script-src 'self'")
  expect(csp).toContain(`'nonce-${nonceMatch?.[1]}'`)
  expect(csp).not.toContain("script-src 'self' 'unsafe-inline'")
  expect(headers['referrer-policy']).toBe('no-referrer')
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['cache-control']).toBe('no-store')

  const about = await request.get('/about')
  const aboutHeaders = about.headers()
  expect(aboutHeaders['content-security-policy']).toContain("'nonce-")
  expect(aboutHeaders['x-frame-options']).toBe('DENY')
  expect(aboutHeaders['cache-control']).toBe('no-store')

  await page.goto('/about', { waitUntil: 'networkidle' })
  await expect(
    page.getByRole('heading', { name: 'A Cloudflare rewrite derived from PrivateBin.' }),
  ).toBeVisible()
})

test('compat API, REST alias, 600k/12B variant, and atomic burn', async ({ request }) => {
  const ct = Buffer.from(unique('api')).toString('base64')
  const created = await request.post('/', {
    headers: { 'x-requested-with': 'JSONHttpRequest' },
    data: futureBody(ct),
  })
  const createdJson = await created.json()
  expect(createdJson.status).toBe(0)
  expect(createdJson.id).toMatch(/^[a-f0-9]{16}$/)
  expect(createdJson.deletetoken).toMatch(/^[a-f0-9]{64}$/)

  const read = await request.get(`/?pasteid=${createdJson.id}`, {
    headers: { 'x-requested-with': 'JSONHttpRequest' },
  })
  const readJson = await read.json()
  expect(readJson.status).toBe(0)
  expect(readJson.ct).toBe(ct)
  expect(readJson.comment_count).toBe(0)
  expect(read.headers()['access-control-allow-origin']).toBe('*')
  expect(read.headers()['cache-control']).toBe('no-store')

  const rest = await request.get(`/api/pastes/${createdJson.id}`)
  expect(rest.status()).toBe(200)
  expect((await rest.json()).ct).toBe(ct)

  const wrongToken = await request.delete(`/api/pastes/${createdJson.id}`, {
    headers: { authorization: `Bearer ${'0'.repeat(64)}` },
  })
  expect(wrongToken.status()).toBe(403)

  const deleted = await request.delete(`/api/pastes/${createdJson.id}`, {
    headers: { authorization: `Bearer ${createdJson.deletetoken}` },
  })
  expect(deleted.status()).toBe(204)

  const missing = await request.get(`/?pasteid=${createdJson.id}`, {
    headers: { 'x-requested-with': 'JSONHttpRequest' },
  })
  expect((await missing.json()).status).toBe(1)

  const variantCt = Buffer.from(unique('variant')).toString('base64')
  const variant = await request.post('/', {
    headers: { 'x-requested-with': 'JSONHttpRequest' },
    data: futureBody(variantCt, { iterations: 600_000, ivBytes: 12 }),
  })
  expect((await variant.json()).status).toBe(0)

  const tooLarge = await request.post('/', {
    headers: { 'x-requested-with': 'JSONHttpRequest' },
    data: futureBody('A'.repeat(13_400_004)),
  })
  const tooLargeJson = await tooLarge.json()
  expect(tooLargeJson.status).toBe(1)
  expect(tooLargeJson.message).toContain('limited to')

  const burnCt = Buffer.from(unique('burn-api')).toString('base64')
  const burn = await request.post('/', {
    headers: { 'x-requested-with': 'JSONHttpRequest' },
    data: futureBody(burnCt, { burn: 1 }),
  })
  const burnId = (await burn.json()).id as string
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      request
        .get(`/?pasteid=${burnId}`, { headers: { 'x-requested-with': 'JSONHttpRequest' } })
        .then((response) => response.json()),
    ),
  )
  expect(results.filter((result) => result.status === 0)).toHaveLength(1)
  expect(results.filter((result) => result.status === 1)).toHaveLength(19)
})

test('REST create and comment aliases use the same D1 service', async ({ request }) => {
  const ct = Buffer.from(unique('rest-create')).toString('base64')
  const body = futureBody(ct, { discussion: 1 })
  const created = await request.post('/api/pastes', { data: body })
  expect(created.status()).toBe(201)
  const createdJson = await created.json()
  expect(createdJson.id).toMatch(/^[a-f0-9]{16}$/)
  expect(createdJson.deleteToken).toMatch(/^[a-f0-9]{64}$/)

  const commentCt = Buffer.from(unique('rest-comment')).toString('base64')
  const comment = await request.post(`/api/pastes/${createdJson.id}/comments`, {
    data: {
      v: 2,
      adata: body.adata[0],
      ct: commentCt,
      parentId: createdJson.id,
    },
  })
  expect(comment.status()).toBe(201)
  expect((await comment.json()).id).toMatch(/^[a-f0-9]{16}$/)

  const read = await request.get(`/api/pastes/${createdJson.id}`)
  expect(read.status()).toBe(200)
  const readJson = await read.json()
  expect(readJson.comment_count).toBe(1)
  expect(readJson.comments[0].ct).toBe(commentCt)

  const deleted = await request.delete(`/api/pastes/${createdJson.id}`, {
    headers: { authorization: `Bearer ${createdJson.deleteToken}` },
  })
  expect(deleted.status()).toBe(204)
})


export async function verifyTurnstile(
  secret: string,
  token: string,
  remoteIp: string,
): Promise<boolean> {
  try {
    const form = new FormData()
    form.set('secret', secret)
    form.set('response', token)
    if (remoteIp && remoteIp !== 'unknown') {
      form.set('remoteip', remoteIp)
    }
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    })
    if (!response.ok) {
      return false
    }
    const result = (await response.json()) as { success?: boolean }
    return result.success === true
  } catch {
    return false
  }
}

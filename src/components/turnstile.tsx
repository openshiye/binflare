import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string
          theme?: 'light' | 'dark' | 'auto'
          callback?: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
        },
      ) => string
      remove?: (widgetId: string) => void
    }
  }
}

let scriptPromise: Promise<void> | null = null

function loadTurnstile(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve()
  }
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load Turnstile'))
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string
  onToken: (token: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onToken)
  callbackRef.current = onToken

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      return
    }
    let cancelled = false
    let widgetId: string | undefined
    void loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) {
          return
        }
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => callbackRef.current(token),
          'error-callback': () => callbackRef.current(''),
          'expired-callback': () => callbackRef.current(''),
        })
      })
      .catch(() => callbackRef.current(''))
    return () => {
      cancelled = true
      if (widgetId && window.turnstile?.remove) {
        window.turnstile.remove(widgetId)
      }
    }
  }, [siteKey])

  if (!siteKey) {
    return null
  }
  return <div ref={containerRef} className="turnstile" />
}
